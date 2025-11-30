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
// ------------------------------------------------------------
export async function GET(req: Request) {
  await requireAdminSession();

  const url = new URL(req.url);
  const rawSearch = (url.searchParams.get('search') ?? '').trim();
  const sortParam = (url.searchParams.get('sort') ?? 'best') as
    | 'best'
    | 'recent'
    | 'name';

  const take = Math.min(
    parseInt(url.searchParams.get('take') ?? '20', 10) || 20,
    50
  );
  const cursor = url.searchParams.get('cursor');

  let search = rawSearch;
  if (search.startsWith('#')) search = search.slice(1);

      // WHERE
    const where: any = {
      deletedAt: null, 
    };  
    if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // ORDER BY (DB level – OK as an approximation)
  // - "best": more orders first
  // - "recent": most recent order first (approx)
  // - "name": A–Z
 
// ORDER BY must be handled in JS because Prisma < 5.16
let orderBy: any;

if (sortParam === "name") {
  orderBy = { name: "asc" };
} else {
  // fallback DB ordering (minimal): by name
  // we will re-sort fully in JS after fetching
  orderBy = { name: "asc" };
}

const clients = await prisma.customer.findMany({
  where,
  take: take + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy,
  include: {
    _count: { select: { orders: true } },
    orders: {
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  },
});

// --------------------------------------------------
// --------------------------------------------------
const sorted = clients.slice(0, take).sort((a, b) => {
  if (sortParam === "name") {
    return a.name.localeCompare(b.name);
  }

  const aCount = a._count.orders;
  const bCount = b._count.orders;

  const aLast = a.orders[0]?.createdAt
    ? new Date(a.orders[0].createdAt).getTime()
    : 0;
  const bLast = b.orders[0]?.createdAt
    ? new Date(b.orders[0].createdAt).getTime()
    : 0;

  if (sortParam === "best") {
    // 1. More orders
    if (bCount !== aCount) return bCount - aCount;

    // 2. If tied → most recent last order
    return bLast - aLast;
  }

  if (sortParam === "recent") {
    // Only sort by last order date
    return bLast - aLast;
  }

  return 0;
});

const rows = sorted.map((c) => {
  const lastOrder = c.orders[0] || null;
  const ordersCount = c._count.orders;

  const status: "Novo cliente" | "Cliente usual" =
    ordersCount <= 1 ? "Novo cliente" : "Cliente usual";

  return {
    id: c.id,
    shortId: "#" + c.id.slice(0, 4),
    name: c.name,
    email: c.email ?? "",
    ordersCount,
    lastOrderAt: lastOrder ? lastOrder.createdAt.toISOString() : null,
    status,
  };
});

return NextResponse.json({
  rows,
  total: await prisma.customer.count({ where }),
  nextCursor: clients.length > take ? clients[clients.length - 1].id : null,
});

}
// ------------------------------------------------------------

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
