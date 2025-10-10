// app/api/uploads/budget/route.ts
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Make sure this route runs on Node, not Edge
export const runtime = 'nodejs';

// Optional: per-file size limit (20MB) & total files cap
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const files = form.getAll('files').filter(Boolean);

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Máximo ${MAX_FILES} ficheiros` }, { status: 413 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error('BLOB_READ_WRITE_TOKEN is missing');
      return NextResponse.json({ error: 'Configuração de blob em falta' }, { status: 500 });
    }

    const urls: string[] = [];

    for (const anyFile of files) {
      if (!(anyFile instanceof Blob)) continue;
      // TS-friendly
      const f = anyFile as unknown as File;

      if (f.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: 'Ficheiro demasiado grande (máx. 20MB)' }, { status: 413 });
      }

      // Very light mime guard (optional)
      const okMime =
        (f.type || '').startsWith('image/') ||
        (f.name || '').match(/\.(png|jpe?g|webp|svg)$/i);
      if (!okMime) {
        return NextResponse.json({ error: 'Apenas imagens são permitidas' }, { status: 415 });
      }

      const safeName = (f.name || 'foto').replace(/\s+/g, '_');
      const key = `budgets/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

      const uploaded = await put(key, f, {
        access: 'public',
        token, // pass explicitly for dev
      });

      urls.push(uploaded.url);
    }

    return NextResponse.json({ urls });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? 'Falha no upload' }, { status: 500 });
  }
}
