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

// ------------------------------------------------------------
// ⭐ GET (supports scope=active|trash|all, search, pagination)
// ------------------------------------------------------------
export async function GET(req: Request) {
  const url = new URL(req.url);

  // NEW
  const scope = url.searchParams.get('scope') ?? 'active'; // 'active' | 'trash' | 'all'

  const rawSearch = url.searchParams.get('search')?.trim() ?? '';
  const take = Math.min(parseInt(url.searchParams.get('take') ?? '20', 10), 100);
  const cursor = url.searchParams.get('cursor');

  let search = rawSearch;
  if (search.startsWith('#')) search = search.slice(1);

  // BUILD WHERE
  const where: any = {};

  // 1) Soft-delete filtering
  if (scope === 'active') {
    where.deletedAt = null;
  } else if (scope === 'trash') {
    where.deletedAt = { not: null };
  }
  // scope=all -> no deletedAt filter

  // 2) Search filter
  if (search) {
    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  // QUERY
  const rowsDb = await prisma.customer.findMany({
    where,
    take: take + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      deletedAt: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
  });

  const hasMore = rowsDb.length > take;
  const page = hasMore ? rowsDb.slice(0, take) : rowsDb;

  const mapped = page.map(c => ({
    id: c.id,
    shortId: `#${c.id.slice(0, 4)}`,
    name: c.name,
    email: c.email,
    phone: c.phone,
    ordersCount: c._count.orders,
    deletedAt: c.deletedAt,
    status: c.deletedAt ? 'Eliminado' : (c._count.orders > 0 ? 'Cliente usual' : 'Novo cliente'),
    createdAt: c.createdAt.toISOString(),
  }));

  return NextResponse.json({
    rows: mapped,
    total: await prisma.customer.count({ where }),
    nextCursor: hasMore ? rowsDb[rowsDb.length - 1].id : null,
  });
}

// ------------------------------------------------------------
// ⭐ POST (unchanged except soft-delete awareness)
// ------------------------------------------------------------
export async function POST(req: Request) {
  await requireAdminSession();
  const body = CreateClient.parse(await req.json());

  // optional: dedupe by email but ignore deleted clients
  const existing = await prisma.customer.findFirst({
    where: { email: body.email, deletedAt: null },
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

  return NextResponse.json({ ok: true, client: c }, { status: 201 });
}
