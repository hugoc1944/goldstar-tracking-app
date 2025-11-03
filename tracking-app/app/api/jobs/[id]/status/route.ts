// app/api/jobs/[id]/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers'; // remove this line if you want it public

export const runtime = 'nodejs';

// Next 15 dynamic route params pattern
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  // If only admins should see job status, keep this. If you want public polling, remove.
  await requireAdminSession();

  const { id } = await params;

  const job = await prisma.sendBudgetJob.findUnique({
    where: { id },
    select: {
      status: true,
      pdfUrl: true,
      lastError: true,
      budgetId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(job);
}
