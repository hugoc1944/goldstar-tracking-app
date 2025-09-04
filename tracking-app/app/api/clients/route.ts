// app/api/clients/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = (url.searchParams.get('search') ?? '').trim();
  const take = Math.min(parseInt(url.searchParams.get('take') ?? '20', 10) || 20, 50);
  const cursor = url.searchParams.get('cursor');

  const where: any = {};
  if (search) {
    where.name = { contains: search, mode: 'insensitive' };
  }

  const clients = await prisma.customer.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { orders: true } },
    },
  });

  const hasMore = clients.length > take;
  const page = hasMore ? clients.slice(0, take) : clients;

  const rows = page.map((c) => ({
    id: c.id,
    shortId: `#${c.id.slice(0,4)}`,                                  // unified short id
    name: c.name,
    email: c.email,
    ordersCount: c._count.orders,
    status: (c._count.orders > 1 ? 'Cliente usual' : 'Novo cliente') as
      'Novo cliente' | 'Cliente usual',
  }));

  const total = await prisma.customer.count({ where });

  return NextResponse.json({
    rows,
    total,
    nextCursor: hasMore ? clients[clients.length - 1].id : null,
  });
}
