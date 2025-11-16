// app/api/budgets/[id]/invoice/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs'; // needed for Blob

export async function POST(req: Request, { params }: { params: { id: string } }) {
  await requireAdminSession();
  const budgetId = params.id;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: 'Blob token missing' }, { status: 500 });

  // multipart/form-data with a single "file" (PDF)
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!/pdf$/i.test(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 415 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const key = `invoices/${budgetId}-${Date.now()}.pdf`;

  const { put } = await import('@vercel/blob');
  const blob = await put(key, buf, { access: 'public', token });

  // Save URL on the budget
  const saved = await prisma.budget.update({
    where: { id: budgetId },
    data: { invoicePdfUrl: blob.url },
    select: { id: true, invoicePdfUrl: true },
  });

  return NextResponse.json(saved);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await requireAdminSession();
  const budgetId = params.id;

  // We only clear the pointer; (optional) you could also delete from Blob.
  await prisma.budget.update({
    where: { id: budgetId },
    data: { invoicePdfUrl: null },
  });

  return NextResponse.json({ ok: true });
}
