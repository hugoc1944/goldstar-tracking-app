// app/api/uploads/route.ts
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminSession } from '@/lib/auth-helpers';
import crypto from 'node:crypto';

// Make sure this route runs on Node, not Edge
export const runtime = 'nodejs';

export async function POST(req: Request) {
  // 1) Protect: only admin
  await requireAdminSession();

  // 2) Read multipart form
  const form = await req.formData();
  const file = form.get('file');

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }

  // TS friendly cast
  const f = file as unknown as File;

  // Optional size guard (20MB)
  if (f.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  // 3) Ensure we have a blob token
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('BLOB_READ_WRITE_TOKEN is missing');
    return NextResponse.json({ error: 'blob token missing' }, { status: 500 });
  }

  // 4) Upload to Vercel Blob
  const key = `orders/${crypto.randomUUID()}-${(f.name || 'file').replace(/\s+/g, '_')}`;

  const blob = await put(key, file, {
    access: 'public',
    token, // explicitly pass so it also works in dev
  });

  // 5) Return metadata used by your form
  return NextResponse.json({
    url: blob.url,
    name: f.name || 'file',
    size: f.size,
    mime: f.type || null,
  });
}
