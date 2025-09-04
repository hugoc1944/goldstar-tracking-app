// app/api/pedido/[publicToken]/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { notifySupportMessage } from '@/lib/notify';


const Body = z.object({
  text: z.string().trim().min(1).max(4000),
});

type Ctx =
  | { params: { publicToken: string } }
  | Promise<{ params: { publicToken: string } }>;

type Params = { params: Promise<{ publicToken: string }> };

export async function GET(_req: Request, { params }: Params) {
  // ✅ In app routes, params is a Promise — await it
  const { publicToken } = await params;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      // history of status changes
      events: {
        orderBy: { at: 'asc' },
        select: { from: true, to: true, at: true, note: true },
      },
      // items (first item = “Detalhes do produto”, but we send all)
      items: {
        select: {
          description: true,
          quantity: true,
          model: true,
          complements: true,
          customizations: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      customer: { select: { name: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    ref: order.id,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    eta: order.eta ? order.eta.toISOString() : null,
    clientName: order.customer?.name ?? null,
    // keep payload light but complete enough for your UI
    items: order.items.map(it => ({
      description: it.description,
      quantity: it.quantity,
      model: it.model ?? null,
      complements: it.complements ?? null,
      customizations: (it.customizations as Record<string, string | null> | null) ?? null,
    })),
    events: order.events.map(e => ({
      from: e.from,
      to: e.to,
      at: e.at.toISOString(),
      note: e.note,
    })),
  });
}

export async function POST(req: Request, ctx: Ctx) {
  // Next 15: params can be a Promise
  const { params } =
    typeof (ctx as any).then === 'function' ? (require('react') as any).use(ctx) : (ctx as any);
  const { publicToken } = params;

  const { text } = Body.parse(await req.json());

  // fetch the order via publicToken
  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      customer: { select: { name: true, email: true, phone: true, address: true, nif: true } },
    },
  });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

  // persist message (assumes you already have a Message model related to Order)
  // direction/source fields are optional; keep/remove if your schema differs
  await prisma.message.create({
    data: {
      orderId: order.id,
      text,
      direction: 'IN',     // <- if your enum exists; otherwise remove this line
      source: 'PUBLIC',    // <- idem
    } as any,
  });

  // email support
  try {
  await notifySupportMessage({
    orderId: order.id,
    publicToken: order.publicToken,
    customer: {
      name: order.customer?.name ?? 'Cliente',
      email: order.customer?.email ?? '',
    },
    message: text,   // <-- was `text`, keep same variable name but pass as `message`
  });
  } catch (e) {
    console.warn('notifySupportMessage failed:', e);
  }

  return NextResponse.json({ ok: true });
}