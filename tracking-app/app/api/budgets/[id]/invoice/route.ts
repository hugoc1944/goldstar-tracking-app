// app/api/budgets/[id]/invoice/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: { id: string } }) {
  await requireAdminSession();
  const budgetId = ctx.params.id;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'Blob token missing' }, { status: 500 });
  }

  // Parse uploaded file
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!/pdf$/i.test(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 415 });
  }

  // Upload to Blob
  const buf = Buffer.from(await file.arrayBuffer());
  const key = `invoices/${budgetId}-${Date.now()}.pdf`;

  const { put } = await import('@vercel/blob');
  const blob = await put(key, buf, { access: 'public', token });

  // Read existing filesJson
  const existing = await prisma.budget.findUnique({
    where: { id: budgetId },
    select: { filesJson: true },
  });

  type FileItem = { kind: string; label: string; url: string };

  const rawFiles = Array.isArray(existing?.filesJson) ? existing.filesJson : [];

  const prevFiles: FileItem[] = rawFiles
    .map((f: any) =>
      f && typeof f === 'object' && typeof f.url === 'string'
        ? { kind: f.kind ?? 'unknown', label: f.label ?? 'Anexo', url: f.url }
        : null
    )
    .filter(Boolean) as FileItem[];

  const invoiceFile: FileItem = {
    kind: 'invoice',
    label: 'Fatura',
    url: blob.url,
  };

  const alreadyExists = prevFiles.some((f) => f.url === invoiceFile.url);

  // Update DB and RETURN a response
  const saved = await prisma.budget.update({
    where: { id: budgetId },
    data: {
      invoicePdfUrl: blob.url,
      filesJson: alreadyExists ? prevFiles : [...prevFiles, invoiceFile],
    },
    select: { id: true, invoicePdfUrl: true, filesJson: true },
  });

  return NextResponse.json(saved);   // ✅ YOU WERE MISSING THIS
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  await requireAdminSession();
  const budgetId = ctx.params.id;

  await prisma.budget.update({
    where: { id: budgetId },
    data: { invoicePdfUrl: null },
  });

  return NextResponse.json({ ok: true });
}
