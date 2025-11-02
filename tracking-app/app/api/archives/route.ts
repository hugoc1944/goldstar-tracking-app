import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

function decodeCursor(s?: string | null) {
  if (!s) return null;
  const [iso, eid] = s.split('|');
  const at = new Date(iso);
  if (!eid || Number.isNaN(+at)) return null;
  return { at, eid };
}

// Helper type for the include we’re using
type EventWithOrder = {
  id: string;
  at: Date;
  order: {
    id: string;
    status: 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';
    publicToken: string | null;
    customer: { name: string | null } | null;
    items: { model: string | null }[];
  };
};

export async function GET(req: Request) {
  await requireAdminSession();

  const { searchParams } = new URL(req.url);
  const search = (searchParams.get('search') || '').trim();
  const sort = (searchParams.get('sort') || 'newest') === 'oldest' ? 'oldest' : 'newest';
  const take = Math.min(Math.max(Number(searchParams.get('take') || 20), 1), 100);
  const cursorRaw = searchParams.get('cursor');
  const cursor = decodeCursor(cursorRaw);

  // Filter StatusEvent by to='ENTREGUE' and related order fields
  const where: any = {
    to: 'ENTREGUE',
    order: {
      status: 'ENTREGUE',
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { customer: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
  };

  if (cursor) {
    if (sort === 'newest') {
      where.OR = [{ at: { lt: cursor.at } }, { at: cursor.at, id: { lt: cursor.eid } }];
    } else {
      where.OR = [{ at: { gt: cursor.at } }, { at: cursor.at, id: { gt: cursor.eid } }];
    }
  }

  const events = (await prisma.statusEvent.findMany({
    where,
    orderBy: [
      { at: sort === 'newest' ? 'desc' : 'asc' },
      { id: sort === 'newest' ? 'desc' : 'asc' },
    ],
    take: take + 1,
    include: {
      order: {
        select: {
          id: true,
          status: true,
          publicToken: true,
          customer: { select: { name: true } },
          items: {
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { model: true },
          },
        },
      },
    },
  })) as EventWithOrder[];

  const hasMore = events.length > take;
  const slice = hasMore ? events.slice(0, take) : events;

  const rows = slice.map((ev) => ({
    id: ev.order.id,
    shortId: ev.order.id.slice(0, 8),                  // computed short id
    customer: { name: ev.order.customer?.name || '' },
    deliveredAt: ev.at.toISOString(),                  // string (ISO) for the UI
    model: ev.order.items?.[0]?.model ?? null,
  }));

  const next = hasMore ? slice[slice.length - 1] : null;
  const nextCursor = next ? `${next.at.toISOString()}|${next.id}` : null;

  return NextResponse.json({
    rows,
    total: rows.length + (hasMore ? 1 : 0),
    nextCursor,
  });
}
