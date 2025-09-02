// app/api/pedido/[publicToken]/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: { publicToken: string } };

export async function GET(_req: Request, { params }: Params) {
  const order = await prisma.order.findUnique({
    where: { publicToken: params.publicToken },
    include: {
      events: {
        orderBy: { at: 'asc' },
        select: { from: true, to: true, at: true, note: true },
      },
      items: {
        select: { description: true, quantity: true },
      },
      customer: {
        select: { name: true },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ref: order.id, // ou outro identificador legível
    status: order.status,
    createdAt: order.createdAt,
    eta: order.eta,
    clientName: order.customer?.name ?? null,
    items: order.items,
    // ✅ map from "events"
    events: order.events.map(e => ({
      from: e.from,
      to: e.to,
      at: e.at,
      note: e.note,
    })),
  });
}
