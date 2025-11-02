// app/api/clients/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';


const CreateClient = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  postal: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
});

export const runtime = 'nodejs'; 
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const take = Math.min(parseInt(searchParams.get('take') || '20', 10), 100);
  const cursor = searchParams.get('cursor');

  // 🔧 List ALL clients (including those with zero orders)
  const where: any = search
    ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }
    : undefined;

  const rowsDb = await prisma.customer.findMany({
    where,
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { orders: true } },   // 👈 count orders safely
    },
  });

  const total = await prisma.customer.count({ where }); // 👈 use SAME where

  const mapped = rowsDb.map((c) => ({
    id: c.id,
    shortId: `#${c.id.slice(0, 4)}`,          // adapt if you persist shortId
    name: c.name,
    email: c.email,
    ordersCount: c._count.orders,
    status: c._count.orders > 0 ? 'Cliente usual' : 'Novo cliente',
  }));

  const nextCursor = rowsDb.length === take ? rowsDb[rowsDb.length - 1].id : null;

  return NextResponse.json({
    rows: mapped,
    total,
    nextCursor,
  });
}

export async function POST(req: Request) {
  await requireAdminSession(); // only admins
  const body = CreateClient.parse(await req.json());

  // Optional: dedupe by email
  const existing = await prisma.customer.findFirst({
    where: { email: body.email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Já existe um cliente com este email.' }, { status: 409 });
  }

  const c = await prisma.customer.create({
    data: {
      name: body.name,
      email: body.email,
      phone: body.phone ?? undefined,
      nif: body.nif ?? undefined,
      address: body.address ?? undefined,
      postal: body.postal ?? undefined,
      city: body.city ?? undefined,
    },
    select: { id: true, name: true, email: true },
  });

  return NextResponse.json({ ok: true, client: c }, { status: 201});
}
