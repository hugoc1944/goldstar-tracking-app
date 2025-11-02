// app/api/orders/bulk/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';

export const runtime = 'nodejs';

const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);
const StatusOrPseudo = Status.or(z.literal('AGUARDA_VISITA'));

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1),
  to: StatusOrPseudo,
  visitAt: z.string().datetime().nullable().optional(),
  eta: z.string().datetime().nullable().optional(),
  note: z.string().max(500).optional(),
});

const ALLOWED_NEXT: Record<z.infer<typeof Status>, z.infer<typeof Status>[]> = {
  PREPARACAO: ['PRODUCAO'],
  PRODUCAO: ['EXPEDICAO'],
  EXPEDICAO: ['ENTREGUE'],
  ENTREGUE: [],
};

export async function POST(req: Request) {
  const admin = await requireAdminSession();
  const body = Body.parse(await req.json());
  const { ids, to, visitAt, eta, note } = body;

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    include: { customer: true },
  });

  const toReal = Status.safeParse(to).success ? (to as z.infer<typeof Status>) : null;

  const updates: { id: string }[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const scheduledToEmail: { id: string; publicToken: string; email: string | null; name: string | null; whenISO: string }[] = [];
  const concludedToEmail: { id: string; publicToken: string; email: string | null; name: string | null }[] = [];
  const statusChangedToEmail: { id: string; publicToken: string; email: string | null; name: string | null; newStatus: z.infer<typeof Status>; eta: string | null; tracking: string | null }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const ord of orders) {
      try {
        const now = new Date();

        // PSEUDO — AGUARDA_VISITA  → set PREPARACAO + visitAwaiting=true (+optional visitAt)
        if (to === 'AGUARDA_VISITA') {
          const prevVisitAt = ord.visitAt ?? null;
          const changedVisitDate = !!(visitAt && (+new Date(visitAt) !== +(prevVisitAt ?? 0)));

          await tx.order.update({
            where: { id: ord.id },
            data: {
              status: 'PREPARACAO',
              visitAwaiting: true,
              visitAt: visitAt ? new Date(visitAt) : (ord.visitAt ?? null),
              events: {
                create: {
                  from: 'PREPARACAO',
                  to: 'PREPARACAO',
                  at: now,
                  byAdminId: admin.id,
                  note: visitAt ? 'Visita técnica agendada' : 'A aguardar visita do técnico',
                } as any,
              },
            },
          });

          if (changedVisitDate) {
            scheduledToEmail.push({
              id: ord.id,
              publicToken: ord.publicToken!,
              email: ord.customer?.email ?? null,
              name: ord.customer?.name ?? null,
              whenISO: visitAt!,
            });
          }

          updates.push({ id: ord.id });
          continue;
        }

        // REAL STATUS path
        const current = ord.status as z.infer<typeof Status>;

        // PREPARACAO while visitAwaiting=true → conclude visit (stay in PREPARACAO)
        if (toReal === 'PREPARACAO' && ord.visitAwaiting) {
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

          updates.push({ id: ord.id });
          continue;
        }

        if (!toReal) {
          skipped.push({ id: ord.id, reason: 'Estado destino inválido' });
          continue;
        }
        if (!ALLOWED_NEXT[current]?.includes(toReal)) {
          skipped.push({ id: ord.id, reason: `Transição inválida: ${current} → ${toReal}` });
          continue;
        }

        const updated = await tx.order.update({
          where: { id: ord.id },
          data: {
            status: toReal,
            ...(toReal === 'EXPEDICAO'
              ? (eta ? { eta: new Date(eta) } : {})
              : toReal === 'ENTREGUE'
              ? { eta: null }
              : {}),
          },
          select: { id: true, status: true, eta: true, publicToken: true, trackingNumber: true },
        });

        await tx.statusEvent.create({
          data: {
            orderId: ord.id,
            from: current,
            to: toReal,
            byAdminId: admin.id,
            note: note ?? null,
          },
        });

        statusChangedToEmail.push({
            id: ord.id,
            publicToken: ord.publicToken!,
            email: ord.customer?.email ?? null,
            name: ord.customer?.name ?? null,
            newStatus: updated.status,
            eta: updated.eta ? updated.eta.toISOString() : null,
            tracking: updated.trackingNumber ?? null,
            });

        updates.push({ id: ord.id });
      } catch (e: any) {
        skipped.push({ id: ord.id, reason: e?.message ?? 'Erro' });
      }
    }
  });

  // Send emails AFTER the transaction
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const { render } = await import('@react-email/render');
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    // 1) Visit scheduled
    if (scheduledToEmail.length) {
      const { VisitScheduledEmail } = await import('@/emails/VisitScheduled');
      for (const x of scheduledToEmail) {
        if (!x.email) continue;
        const html = await render(
          VisitScheduledEmail({
            customerName: x.name ?? 'Cliente',
            publicLink: `${base}/pedido/${x.publicToken}`,
            visitAtISO: x.whenISO,
          })
        );
        await resend.emails.send({
          from: `GOLDSTAR <${fromAddr}>`,
          to: x.email,
          subject: 'Visita técnica agendada',
          html,
        });
      }
    }

    // 2) Visit concluded → use your standard status template (“PREPARACAO”)
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

    // 3) Normal status changes
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
          subject: `Atualização do seu pedido — ${x.newStatus === 'EXPEDICAO' ? 'Em expedição' : x.newStatus === 'PRODUCAO' ? 'Em produção' : x.newStatus === 'ENTREGUE' ? 'Entregue' : 'Em preparação'}`,
          html,
        });
      }
    }
  } catch (e) {
    console.warn('Falha ao enviar emails em bulk:', e);
  }

  return NextResponse.json({ ok: true, updated: updates.length, skipped });
}
