import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

function decodeCursor(s?: string | null) {
  if (!s) return null;
  const [iso, oid] = s.split('|');
  const at = new Date(iso);
  if (!oid || Number.isNaN(+at)) return null;
  return { at, oid };
}

export async function GET(req: Request) {
  await requireAdminSession();

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const search = (searchParams.get('search') || '').trim();
  const sort = (searchParams.get('sort') || 'newest') === 'oldest' ? 'oldest' : 'newest';
  const take = Math.min(Math.max(Number(searchParams.get('take') || 20), 1), 100);
  const cursorRaw = searchParams.get('cursor');
  const cursor = decodeCursor(cursorRaw);

  // Query Order directly — status='ENTREGUE' is the source of truth.
  // The previous implementation queried StatusEvent (to='ENTREGUE'), which
  // excluded orders that reached ENTREGUE status without a matching event record.
  const where: any = {
    status: 'ENTREGUE',
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { customer: { name: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Month/year filter: match against the StatusEvent that recorded the ENTREGUE transition.
  // Orders with no StatusEvent (legacy data) will only appear when no period filter is active.
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month'); // "1".."12" or ""

  if (yearParam) {
    const y = Number(yearParam);
    if (!Number.isNaN(y) && y > 1900 && y < 3000) {
      let start: Date;
      let end: Date;

      if (monthParam) {
        const m = Number(monthParam); // 1..12
        if (!Number.isNaN(m) && m >= 1 && m <= 12) {
          start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
          end =
            m === 12
              ? new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0))
              : new Date(Date.UTC(y, m, 1, 0, 0, 0));
        } else {
          start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
          end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));
        }
      } else {
        start = new Date(Date.UTC(y, 0, 1, 0, 0, 0));
        end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));
      }

      where.events = {
        some: {
          to: 'ENTREGUE',
          at: { gte: start, lt: end },
        },
      };
    }
  }

  // Cursor-based pagination on updatedAt (updated when status changes to ENTREGUE)
  if (cursor) {
    const cursorCond =
      sort === 'newest'
        ? {
            OR: [
              { updatedAt: { lt: cursor.at } },
              { updatedAt: cursor.at, id: { lt: cursor.oid } },
            ],
          }
        : {
            OR: [
              { updatedAt: { gt: cursor.at } },
              { updatedAt: cursor.at, id: { gt: cursor.oid } },
            ],
          };

    where.AND = [...(where.AND ?? []), cursorCond];
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: [
      { updatedAt: sort === 'newest' ? 'desc' : 'asc' },
      { id: sort === 'newest' ? 'desc' : 'asc' },
    ],
    take: take + 1,
    select: {
      id: true,
      updatedAt: true,
      customer: { select: { name: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { model: true },
      },
      // Include the ENTREGUE event for an accurate delivery timestamp
      events: {
        where: { to: 'ENTREGUE' },
        orderBy: { at: 'desc' },
        take: 1,
        select: { at: true },
      },
    },
  });

  const hasMore = orders.length > take;
  const slice = hasMore ? orders.slice(0, take) : orders;

  const rows = slice.map((o) => ({
    id: o.id,
    shortId: o.id.slice(0, 8),
    customer: { name: o.customer?.name || '' },
    // Use the StatusEvent timestamp when available; fall back to updatedAt
    deliveredAt: (o.events[0]?.at ?? o.updatedAt).toISOString(),
    model: o.items[0]?.model ?? null,
  }));

  const next = hasMore ? slice[slice.length - 1] : null;
  const nextCursor = next
    ? `${next.updatedAt.toISOString()}|${next.id}`
    : null;

  const total = await prisma.order.count({ where });

  return NextResponse.json({
    rows,
    total,
    nextCursor,
  });
}
