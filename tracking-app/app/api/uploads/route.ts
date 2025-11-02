// app/api/uploads/route.ts
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAdminSession } from '@/lib/auth-helpers';
import crypto from 'node:crypto';
import sharp from 'sharp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function cleanName(name: string) {
  return (name || 'ficheiro').normalize('NFKD').replace(/[^\w.\-]+/g, '_');
}

// Avoid Buffer<T> generic headaches by copying into a fresh ArrayBuffer
function toArrayBuffer(src: Buffer | Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(src.byteLength);
  const view = new Uint8Array(ab);
  view.set(src as Uint8Array);
  return ab;
}

export async function POST(req: Request) {
  await requireAdminSession();

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }

  const f = file as unknown as File;

  // Hard cap (adjust if you want)
  if (f.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error('BLOB_READ_WRITE_TOKEN is missing');
    return NextResponse.json({ error: 'blob token missing' }, { status: 500 });
  }

  const originalName = cleanName(f.name || 'file.bin');
  let outName = originalName;
  let contentType = f.type || 'application/octet-stream';

  // Read to Node Buffer for sharp
  let buf: Buffer = Buffer.from(await f.arrayBuffer());

  // Compress/resize large images
  if (f.size > 1_000_000 && contentType.startsWith('image/')) {
    try {
      buf = await sharp(buf)
        .rotate()
        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

      contentType = 'image/jpeg';
      if (!/\.jpe?g$/i.test(outName)) {
        outName = outName.replace(/\.[^.]+$/i, '') + '.jpg';
      }
    } catch (e) {
      console.warn('Compression failed, uploading original:', e);
      buf = Buffer.from(await f.arrayBuffer());
      contentType = f.type || 'application/octet-stream';
    }
  }

  // Wrap into a Blob (type-safe for @vercel/blob)
  const dataBlob = new Blob([toArrayBuffer(buf)], { type: contentType });

  const key = `orders/${Date.now()}-${crypto.randomUUID()}-${outName}`;
  const blob = await put(key, dataBlob, {
    access: 'public',
    contentType,
    token,
    addRandomSuffix: false,
  });

  return NextResponse.json({
    url: blob.url,
    name: outName,
    size: buf.byteLength,
    mime: contentType,
  });
}
