// app/api/orders/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

export async function GET() {
  await requireAdminSession();

  // Count only non-deleted orders
  const grouped = await prisma.order.groupBy({
    by: ['status'],
    where: {
      deletedAt: null,
    },
    _count: { _all: true },
  });

  let preparacao = 0;
  let producao = 0;
  let expedicao = 0;
  let entregue = 0;

  for (const g of grouped) {
    if (g.status === 'PREPARACAO') preparacao = g._count._all;
    if (g.status === 'PRODUCAO') producao = g._count._all;
    if (g.status === 'EXPEDICAO') expedicao = g._count._all;
    if (g.status === 'ENTREGUE') entregue = g._count._all;
  }

  return NextResponse.json({
    PREPARACAO: preparacao,
    PRODUCAO: producao,
    EXPEDICAO: expedicao,
    ENTREGUE: entregue,
  });
}
