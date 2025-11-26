// Replace the whole POST function with this implementation
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { render } from '@react-email/render';
import { VisitAwaitingEmail } from '@/emails/VisitAwaiting';
import React from 'react';
export const runtime = 'nodejs';
type Params = { params: Promise<{ publicToken: string }> };

function nameFromUrl(u: string) {
  try {
    const url = new URL(u, 'http://localhost'); // base for parsing only
    const last = url.pathname.split('/').filter(Boolean).pop() || 'Orcamento!.pdf';
    return decodeURIComponent(last);
  } catch {
    return decodeURIComponent((u.split('?')[0].split('/').pop() || 'Orcamento!.pdf'));
  }
}

export async function POST(_req: Request, { params }: Params) {
  const { publicToken } = await params;

  // 1) Try to find an order by token (may exist if convert previously created it)
  let order = await prisma.order.findUnique({
    where: { publicToken },
    include: { customer: true, createdFromBudget: true },
  });

  // If order exists and already confirmed -> idempotent success
  if (order && order.confirmedAt) {
    return NextResponse.json({ ok: true, already: true });
  }

  // 2) If no order, try to find a budget with this token
  let budget = null;
  if (!order) {
    budget = await prisma.budget.findUnique({ where: { publicToken } });
    if (!budget) {
      return NextResponse.json({ error: 'Pedido / Orçamento não encontrado' }, { status: 404 });
    }
  } else {
    budget = order.createdFromBudget ?? null;
  }

  const now = new Date();

  // 3) Transaction: create or update order; seed items; attach files; update budget
  const updatedOrder = await prisma.$transaction(async (tx) => {
    // `o` will hold the order object (post-create/update)
    let o = order ?? null;

    if (!o) {
      // Create or upsert customer from budget
      const cust = await tx.customer.upsert({
        where: { email: (budget as any).email },
        update: {
          name: (budget as any).name ?? undefined,
          phone: (budget as any).phone ?? null,
          nif: (budget as any).nif ?? null,
          address: (budget as any).address ?? null,
          postal: (budget as any).postalCode ?? null,
          city: (budget as any).city ?? null,
        },
        create: {
          name: (budget as any).name ?? undefined,
          email: (budget as any).email,
          phone: (budget as any).phone ?? null,
          nif: (budget as any).nif ?? null,
          address: (budget as any).address ?? null,
          postal: (budget as any).postalCode ?? null,
          city: (budget as any).city ?? null,
        },
      });

      // create order using budget data (attach publicToken so link stays same)
      o = await tx.order.create({
        data: {
        customer: { connect: { id: cust.id } },
        status: 'PREPARACAO',
        confirmedAt: now,
        visitAwaiting: true,
        publicToken: (budget as any).publicToken ?? publicToken,
        filesJson: (() => {
              if (!budget) return [];

              const raw = Array.isArray((budget as any).filesJson)
                ? (budget as any).filesJson
                : [];

              const out: any[] = [];

              for (const f of raw) {
                if (!f) continue;

                const url = typeof f === 'string'
                  ? f
                  : (f as any).url;

                if (!url) continue;

                const name =
                  typeof f === 'object' && (f as any).name
                    ? (f as any).name
                    : nameFromUrl(url);

                const size =
                  typeof f === 'object' && typeof (f as any).size === 'number'
                    ? (f as any).size
                    : 0;

                const mime =
                  typeof f === 'object' && typeof (f as any).mime === 'string'
                    ? (f as any).mime
                    : url.endsWith('.pdf')
                    ? 'application/pdf'
                    : null;

                out.push({ url, name, size, mime });
              }

              // Ensure we have entries for the quoted PDF and invoice, even if they weren't in filesJson
              const ensure = (url?: string | null) => {
                if (!url) return;
                if (out.some((f) => f.url === url)) return;
                out.push({
                  url,
                  name: nameFromUrl(url),
                  size: 0,
                  mime: url.endsWith('.pdf') ? 'application/pdf' : null,
                });
              };

              ensure((budget as any).quotedPdfUrl);
              ensure((budget as any).invoicePdfUrl);

              // De-duplicate by URL (keep the first entry)
              const seen = new Set<string>();
              return out.filter((f) => {
                if (seen.has(f.url)) return false;
                seen.add(f.url);
                return true;
              });
            })(),
        // *** copy measures from budget (stored in mm) ***
        widthMm: (budget as any).widthMm ?? null,
        heightMm: (budget as any).heightMm ?? null,
        depthMm: (budget as any).depthMm ?? null,
        // copy delivery fields
        deliveryType: (budget as any).deliveryType ?? null,
        housingType: (budget as any).housingType ?? null,
        floorNumber: (budget as any).floorNumber ?? null,
        hasElevator: (budget as any).hasElevator ?? null,
      },
        include: { customer: true, createdFromBudget: true },
      });

      // link budget -> order (mark as confirmed)
      await tx.budget.update({
        where: { id: (budget as any).id },
        data: { confirmedAt: now, convertedOrderId: o!.id },
      });
    } else {
      // order existed but not confirmed — update it
      o = await tx.order.update({
        where: { id: o!.id },
        data: {
          confirmedAt: now,
          status: 'PREPARACAO',
          visitAwaiting: true,
          widthMm: (budget as any).widthMm ?? undefined,
          heightMm: (budget as any).heightMm ?? undefined,
          depthMm: (budget as any).depthMm ?? undefined,
        },
        include: { customer: true, createdFromBudget: true },
      });

      if (budget) {
        await tx.budget.update({
          where: { id: (budget as any).id },
          data: { confirmedAt: now, convertedOrderId: o!.id },
        });
      }
    }

    // create an initial status event (no-op if duplicate events are okay)
      await tx.statusEvent.create({
        data: {
          orderId: o!.id,
          from: 'PREPARACAO',
          to: 'PREPARACAO',
          at: now,
          note: 'Cliente confirmou orçamento - a aguardar visita do técnico',
        },
      });

    // seed items if budget present and items don't exist yet
    if (budget) {
      const existingItems = await tx.orderItem.findMany({ where: { orderId: o!.id }});
      if (existingItems.length === 0) {
        const customizations: Record<string, any> = {
          finishKey: (budget as any).finishKey ?? null,
          acrylicKey: (budget as any).acrylicKey ?? null,
          serigrafiaKey: (budget as any).serigrafiaKey ?? null,
          serigrafiaColor: (budget as any).serigrafiaColor ?? null,
          glassTypeKey: (budget as any).glassTypeKey ?? null,
          handleKey: (budget as any).handleKey ?? null,
          fixingBarMode: (budget as any).fixingBarMode ?? null,
          barColor: (budget as any).complemento === 'vision' ? (budget as any).barColor ?? null : null,
          visionSupport: (budget as any).complemento === 'vision' ? (budget as any).visionSupport ?? null : null,
          towelColorMode: (budget as any).complemento === 'toalheiro1' ? (budget as any).towelColorMode ?? null : null,
          shelfColorMode: (budget as any).complemento === 'prateleira' ? (budget as any).shelfColorMode ?? null : null,
          priceCents: (budget as any).priceCents ?? null,
          installPriceCents: (budget as any).installPriceCents ?? null,
        };

        await tx.orderItem.create({
          data: {
            orderId: o!.id,
            description: 'Detalhes do produto',
            quantity: 1,
            model: (budget as any).modelKey,
            complements: (budget as any).complemento ?? 'nenhum',
            customizations,
          },
        });
      }

      // attach quoted PDF if present, dedupe by url
      if ((budget as any).quotedPdfUrl) {
        const fresh = await tx.order.findUnique({ where: { id: o!.id }, select: { filesJson: true }});
        const prev = Array.isArray(fresh?.filesJson) ? (fresh!.filesJson as any[]) : [];
        const file = { url: (budget as any).quotedPdfUrl, name: nameFromUrl((budget as any).quotedPdfUrl), size: 0, mime: null as string | null };
        const exists = prev.some((r) => typeof r === 'string' ? r === file.url : (r && typeof r === 'object' && r.url === file.url));
        if (!exists) {
          await tx.order.update({ where: { id: o!.id }, data: { filesJson: [...prev, file] } as any });
        }
      }
      // --- attach INVOICE PDF if present ---
      if ((budget as any).invoicePdfUrl) {
        const fresh = await tx.order.findUnique({
          where: { id: o!.id },
          select: { filesJson: true }
        });

        const prev = Array.isArray(fresh?.filesJson) ? (fresh!.filesJson as any[]) : [];

        const file = {
          url: (budget as any).invoicePdfUrl,
          name: nameFromUrl((budget as any).invoicePdfUrl),
          size: 0,
          mime: 'application/pdf'
        };

        const exists = prev.some((r) =>
          typeof r === 'string'
            ? r === file.url
            : r && typeof r === 'object' && r.url === file.url
        );

        if (!exists) {
          await tx.order.update({
            where: { id: o!.id },
            data: { filesJson: [...prev, file] } as any
          });
        }
      }
    }

    return o;
  }, {
    timeout: 15000,
    maxWait: 10000,
  } as any);
  // Sanity runtime check — TS still thinks updatedOrder might be null, so guard and fail early.
  if (!updatedOrder) {
    // Something went wrong in the transaction (shouldn't happen) — return 500
    return NextResponse.json({ error: 'Falha ao confirmar pedido' }, { status: 500 });
  }
  // 4) After transaction — send VisitAwaiting email (outside tx)
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  const html = await render(VisitAwaitingEmail({
    customerName: (updatedOrder!.customer?.name) ?? 'Cliente',
    publicToken,
  }));

  await resend.emails.send({
    from: `GOLDSTAR <${fromAddr}>`,
    to: updatedOrder!.customer?.email ?? '',
    subject: 'Pedido confirmado - a aguardar visita do técnico',
    html,
  });

  return NextResponse.json({ ok: true });
}
