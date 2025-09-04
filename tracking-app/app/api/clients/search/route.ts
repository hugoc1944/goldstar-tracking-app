// app/api/customers/search/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  await requireAdminSession(); // protect it

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const take = Math.min(Number(searchParams.get('limit') ?? 5), 10); // hard cap

  if (!q) return NextResponse.json({ items: [] });

  const items = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      nif: true,
      address: true,
      postal: true,
      city: true,
    },
    take,
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ items });
}
