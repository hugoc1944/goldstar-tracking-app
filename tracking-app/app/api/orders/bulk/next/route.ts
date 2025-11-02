// app/api/orders/bulk/next/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';

export const runtime = 'nodejs';
const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);
type StatusT = z.infer<typeof Status>;

const FLOW: Record<StatusT, StatusT | null> = {
  PREPARACAO: 'PRODUCAO',
  PRODUCAO: 'EXPEDICAO',
  EXPEDICAO: 'ENTREGUE',
  ENTREGUE: null,
};

const Body = z.object({ ids: z.array(z.string().uuid()).min(1) });

export async function POST(req: Request) {
  const admin = await requireAdminSession();
  const { ids } = Body.parse(await req.json());

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      visitAwaiting: true,
      eta: true,
      trackingNumber: true,
      publicToken: true,
      customer: { select: { email: true, name: true } },
    },
  });

  const updates: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  // email queues
  const concludedToEmail: { id: string; publicToken: string; email: string|null; name: string|null }[] = [];
  const statusChangedToEmail: { id: string; publicToken: string; email: string|null; name: string|null; newStatus: StatusT; eta: string|null; tracking: string|null }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const ord of orders) {
      const current = ord.status as StatusT;
      const next = FLOW[current];
      const now = new Date();

      if (!next) {
        skipped.push({ id: ord.id, reason: 'Sem próximo estado' });
        continue;
      }

      // ✅ only conclude visit if we are CURRENTLY in PREPARACAO and awaiting visit
      if (current === 'PREPARACAO' && ord.visitAwaiting) {
        await tx.order.update({
          where: { id: ord.id },
          data: {
            visitAwaiting: false,
            events: {
              create: {
                from: 'PREPARACAO',
                to: 'PREPARACAO',
                at: now,
                byAdminId: admin.id,
                note: 'Visita técnica concluída',
              } as any,
            },
          },
        });

        concludedToEmail.push({
          id: ord.id,
          publicToken: ord.publicToken!,
          email: ord.customer?.email ?? null,
          name: ord.customer?.name ?? null,
        });

        updates.push(ord.id);
        continue; // we only concluded; we don't also jump state in this click
      }

      // Normal “advance to next” — also clear visitAwaiting if we’re leaving PREPARACAO
      const updated = await tx.order.update({
        where: { id: ord.id },
        data: {
          status: next,
          ...(next === 'ENTREGUE' ? { eta: null } : {}),
          ...(current === 'PREPARACAO' ? { visitAwaiting: false } : {}), // 🔒 clear leaked flags
        },
        select: {
          id: true, status: true, eta: true, publicToken: true, trackingNumber: true,
          customer: { select: { email: true, name: true } },
        },
      });

      await tx.statusEvent.create({
        data: {
          orderId: ord.id,
          from: current,
          to: next,
          byAdminId: admin.id,
          note: null,
        },
      });

      statusChangedToEmail.push({
        id: ord.id,
        publicToken: updated.publicToken!,
        email: updated.customer?.email ?? null,
        name: updated.customer?.name ?? null,
        newStatus: next,
        eta: updated.eta ? updated.eta.toISOString() : null, // string|null for template
        tracking: updated.trackingNumber ?? null,
      });

      updates.push(ord.id);
    }
  });

  // send emails (same queues you already use in bulk routes)
  try {
    const { render } = await import('@react-email/render');
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    if (concludedToEmail.length) {
      const { OrderStatusChangedEmail } = await import('@/emails/OrderStatusChanged');
      for (const x of concludedToEmail) {
        if (!x.email) continue;
        const html = await render(
          OrderStatusChangedEmail({
            customerName: x.name ?? 'Cliente',
            publicToken: x.publicToken,
            newStatus: 'PREPARACAO',
            eta: null,
            trackingNumber: null,
          })
        );
        await resend.emails.send({
          from: `GOLDSTAR <${fromAddr}>`,
          to: x.email,
          subject: 'Visita concluída — o seu pedido está em preparação',
          html,
        });
      }
    }

    if (statusChangedToEmail.length) {
      const { OrderStatusChangedEmail } = await import('@/emails/OrderStatusChanged');
      for (const x of statusChangedToEmail) {
        if (!x.email) continue;
        const html = await render(
          OrderStatusChangedEmail({
            customerName: x.name ?? 'Cliente',
            publicToken: x.publicToken,
            newStatus: x.newStatus,
            eta: x.eta,
            trackingNumber: x.tracking,
          })
        );
        await resend.emails.send({
          from: `GOLDSTAR <${fromAddr}>`,
          to: x.email,
          subject: `Atualização do seu pedido — ${
            x.newStatus === 'EXPEDICAO' ? 'Em expedição'
            : x.newStatus === 'PRODUCAO' ? 'Em produção'
            : x.newStatus === 'ENTREGUE' ? 'Entregue'
            : 'Em preparação'
          }`,
          html,
        });
      }
    }
  } catch (e) {
    console.warn('Falha a enviar emails em bulk/next:', e);
  }

  return NextResponse.json({ ok: true, updated: updates.length, skipped });
}
