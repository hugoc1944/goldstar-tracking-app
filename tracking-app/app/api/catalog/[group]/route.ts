// app/api/catalog/[group]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs'; 
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ group: string }> }
) {
  const { group } = await params; // 👈 Next 15: params is a Promise
  const GROUP = group.toUpperCase(); // e.g. MODEL | ACRYLIC | SERIGRAPHY | MONOCHROME

  const rows = await prisma.catalogOption.findMany({
    where: { group: GROUP, active: true },
    orderBy: [{ category: 'asc' }, { sort: 'asc' }],
    select: { value: true, label: true, category: true }, // 👈 keep `value` (not `code`)
  });

  return NextResponse.json(rows);
}
