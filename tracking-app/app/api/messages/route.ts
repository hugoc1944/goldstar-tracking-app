// app/api/messages/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { notifySupportMessage, notifyAdminMessageToClient } from '@/lib/notify';
import { AuthorType } from '@prisma/client';

// One body schema, two shapes (CLIENTE vs ADMIN)
const Body = z.union([
  z.object({
    author: z.literal('CLIENTE'),
    publicToken: z.string().min(8),
    body: z.string().min(1).max(2000),
  }),
  z.object({
    author: z.literal('ADMIN'),
    orderId: z.string().uuid(),
    body: z.string().min(1).max(2000),
  }),
]);

export async function POST(req: Request) {
  const payload = Body.parse(await req.json());

  // --- CLIENTE → ADMIN (public, no auth) -------------------------------
  if (payload.author === 'CLIENTE') {
    const order = await prisma.order.findUnique({
      where: { publicToken: payload.publicToken },
      include: {
        customer: { select: { name: true, email: true, phone: true, nif: true, address: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Save message
    await prisma.message.create({
      data: {
        orderId: order.id,
        authorType: AuthorType.CLIENTE,
        body: payload.body,
      },
    });

    // Email support
    try {
      await notifySupportMessage({
        orderId: order.id,
        publicToken: order.publicToken,
        customer: {
          name: order.customer?.name ?? 'Cliente',
          email: order.customer?.email ?? '',
        },
        message: payload.body,
      });
    } catch (e) {
      console.warn('notifySupportMessage failed:', e);
      // we still return ok because message is already stored
    }

    return NextResponse.json({ ok: true });
  }

  // --- ADMIN → CLIENTE (protected) -------------------------------------
  // Require session for admin messages
  const admin = await requireAdminSession();

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    include: {
      customer: { select: { name: true, email: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
  }

  // Save message
  await prisma.message.create({
    data: {
      orderId: order.id,
      authorType: AuthorType.ADMIN,
      body: payload.body,
    },
  });

  // Email customer
  try {
    await notifyAdminMessageToClient(
      {
        id: order.id,
        publicToken: order.publicToken,
        customer: {
          name: order.customer?.name ?? 'Cliente',
          email: order.customer?.email ?? '',
        },
      },
      payload.body
    );
  } catch (e) {
    console.warn('notifyAdminMessageToClient failed:', e);
  }

  return NextResponse.json({ ok: true });
}
