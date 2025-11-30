// app/api/clients/[id]/trash/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  await requireAdminSession();
  const id = params.id;

  // soft delete: mark as deleted, but keep row
  await prisma.customer.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
