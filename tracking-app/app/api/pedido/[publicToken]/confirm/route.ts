import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { render } from '@react-email/render';
import { OrderCreatedEmail } from '@/emails/OrderCreated';
import React from 'react';

export const runtime = 'nodejs';
type Params = { params: Promise<{ publicToken: string }> };
export async function POST(_req: Request, { params }: Params) {
    const { publicToken } = await params;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      customer: true,
      createdFromBudget: true, // back relation to Budget
    },
  });
  if (!order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
  }
  if (order.confirmedAt) {
    return NextResponse.json({ ok: true, already: true });
  }

  const now = new Date();
  const budget = order.createdFromBudget ?? null;

  const updated = await prisma.$transaction(async (tx) => {
    // 1) Mark order confirmed + add initial event
    const o = await tx.order.update({
        where: { id: order.id },
        data: {
            confirmedAt: now,
            status: 'PREPARACAO',
        },
        include: { customer: true },
        });

    // 2) Seed item(s) from Budget now (order was minimal at convert time)
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
        // optional: carry prices so the public page can show them
        priceCents: budget.priceCents ?? null,
        installPriceCents: budget.installPriceCents ?? null,
      };

      await tx.order.update({
        where: { id: o.id },
        data: {
          items: {
            create: [
              {
                description: 'Detalhes do produto',
                quantity: 1,
                model: budget.modelKey,
                complements: budget.complemento ?? 'nenhum',
                customizations,
              },
            ],
          },
        },
      });

      // 3) Tag the budget as confirmed
      await tx.budget.update({
        where: { id: budget.id },
        data: { confirmedAt: now },
      });
    }

    return o;
  });

  // 4) Send the usual "Order Created" email
// 4) Send the usual "Order Created" email
const { Resend } = await import('resend');
const resend = new Resend(process.env.RESEND_API_KEY!);
const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

// Build a React element (no JSX in .ts files) and AWAIT the render -> string
const emailElement = React.createElement(
  OrderCreatedEmail as React.ComponentType<{ customerName: string; publicToken: string }>,
  {
    customerName: updated.customer?.name ?? 'Cliente',
    publicToken,
  }
);
const html = await render(emailElement);

await resend.emails.send({
  from: `GOLDSTAR <${fromAddr}>`,
  to: updated.customer?.email ?? '',
  subject: 'O seu pedido foi criado',
  html,
});

  return NextResponse.json({ ok: true });
}
