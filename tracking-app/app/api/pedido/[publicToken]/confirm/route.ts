import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { render } from '@react-email/render';
import { OrderCreatedEmail } from '@/emails/OrderCreated';
import { VisitAwaitingEmail } from '@/emails/VisitAwaiting';
import React from 'react';
export const runtime = 'nodejs';
type Params = { params: Promise<{ publicToken: string }> };

function nameFromUrl(u: string) {
  try {
    const url = new URL(u, 'http://localhost'); // base for parsing only
    const last = url.pathname.split('/').filter(Boolean).pop() || 'Orcamento.pdf';
    return decodeURIComponent(last);
  } catch {
    return decodeURIComponent((u.split('?')[0].split('/').pop() || 'Orcamento.pdf'));
  }
}

export async function POST(_req: Request, { params }: Params) {
  const { publicToken } = await params;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      customer: true,
      createdFromBudget: true,
    },
  });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
  if (order.confirmedAt) return NextResponse.json({ ok: true, already: true });

  const now = new Date();
  const budget = order.createdFromBudget ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    // 1) mark confirmed + flag visitAwaiting
    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        confirmedAt: now,
        status: 'PREPARACAO',
        visitAwaiting: true,
      },
      include: { customer: true }, // scalars (filesJson, etc.) come by default
    });

    // 2) event
    await tx.statusEvent.create({
      data: {
        orderId: order.id,
        from: 'PREPARACAO',
        to: 'PREPARACAO',
        at: now,
        note: 'Cliente confirmou orçamento - a aguardar visita do técnico',
      },
    });

    // 3) seed items + attach quoted PDF (if exists) + mark budget confirmed
    if (budget) {
      const customizations: Record<string, any> = {
        finishKey: budget.finishKey ?? null,
        acrylicKey: budget.acrylicKey ?? null,
        serigrafiaKey: budget.serigrafiaKey ?? null,
        serigrafiaColor: budget.serigrafiaColor ?? null,
        glassTypeKey: budget.glassTypeKey ?? null,
        handleKey: budget.handleKey ?? null,
        fixingBarMode: budget.fixingBarMode ?? null,
        barColor: budget.complemento === 'vision' ? budget.barColor ?? null : null,
        visionSupport: budget.complemento === 'vision' ? budget.visionSupport ?? null : null,
        towelColorMode: budget.complemento === 'toalheiro1' ? budget.towelColorMode ?? null : null,
        shelfColorMode: budget.complemento === 'prateleira' ? budget.shelfColorMode ?? null : null,
        priceCents: budget.priceCents ?? null,
        installPriceCents: budget.installPriceCents ?? null,
      };

      await tx.orderItem.create({
        data: {
          orderId: o.id,
          description: 'Detalhes do produto',
          quantity: 1,
          model: budget.modelKey,
          complements: budget.complemento ?? 'nenhum',
          customizations,
        },
      });

      if (budget?.quotedPdfUrl) {
        const file = {
          url: budget.quotedPdfUrl,
          name: nameFromUrl(budget.quotedPdfUrl),
          size: 0,
          mime: null as string | null,
        };

        // read FRESH inside the tx
        const fresh = await tx.order.findUnique({
          where: { id: o.id },
          select: { filesJson: true },
        });

        const prev = Array.isArray(fresh?.filesJson) ? (fresh!.filesJson as any[]) : [];

        // dedupe by URL (supports string or {url})
        const exists = prev.some((r) =>
          typeof r === 'string' ? r === file.url : (r && typeof r === 'object' && r.url === file.url)
        );

        if (!exists) {
          await tx.order.update({
            where: { id: o.id },
            data: { filesJson: [...prev, file] as any },
          });
        }
      }

      await tx.budget.update({
        where: { id: budget.id },
        data: { confirmedAt: now },
      });
    }

    return o;
  }, {
    // optional: raise the interactive transaction timeout
    timeout: 15000,   // 15s
    maxWait: 10000,   // 10s to obtain a connection
  } as any);

  // 4) email AFTER the tx
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = await render(
    VisitAwaitingEmail({
      customerName: updated.customer?.name ?? 'Cliente',
      publicToken,
    })
  );

  await resend.emails.send({
    from: `GOLDSTAR <${fromAddr}>`,
    to: updated.customer?.email ?? '',
    subject: 'Pedido confirmado - a aguardar visita do técnico',
    html,
  });

  return NextResponse.json({ ok: true });
}
