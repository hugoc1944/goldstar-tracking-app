import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  await requireAdminSession();
  const p = ctx.params as any;
  const { id } = typeof p?.then === 'function' ? await p : p;
  
  const [order, delivered] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        filesJson: true,
        customer: {
          select: {
            name: true, email: true, phone: true, address: true,
            nif: true, postal: true, city: true,
          },
        },
        items: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, model: true, description: true, quantity: true, customizations: true, complements: true },
        },
      },
    }),
    prisma.statusEvent.findFirst({
      where: { orderId: id, to: 'ENTREGUE' },
      orderBy: { at: 'desc' },
      select: { at: true },
    }),
  ]);

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
type FileMeta = { url: string; name: string; size: number; mime?: string | null };

function nameFromUrl(u: string) {
  try {
    const url = new URL(u, 'http://localhost'); // base only for parsing
    const last = url.pathname.split('/').filter(Boolean).pop() || 'Ficheiro';
    return decodeURIComponent(last);
  } catch {
    const last = (u || '').split('?')[0].split('/').pop() || 'Ficheiro';
    return decodeURIComponent(last);
  }
}

const rawFiles = (order.filesJson as any[]) ?? [];
const files: FileMeta[] = rawFiles
  .map((raw) => {
    // Support both: string URL or object with url/name/size/mime
    let url = '';
    if (typeof raw === 'string') {
      url = raw;
    } else if (raw && typeof raw.url === 'string') {
      url = raw.url;
    } else if (raw && typeof raw.href === 'string') {
      url = raw.href; // fallback if someone stored "href"
    } else if (raw != null) {
      // sometimes the value itself is a URL-like stringable value
      url = String(raw);
    }

    url = (url || '').trim();
    if (!url) return null;

    const name =
      (typeof raw === 'object' && raw?.name && String(raw.name).trim()) ||
      nameFromUrl(url);

    const size =
      (typeof raw === 'object' && Number.isFinite(Number(raw?.size)) ? Number(raw.size) : 0);

    const mime =
      (typeof raw === 'object' && (raw?.mime ?? raw?.contentType)) || null;

    return { url, name, size, mime: mime as string | null };
  })
  .filter(Boolean) as FileMeta[];

  
  return NextResponse.json({
    id: order.id,
    shortId: (order as any).shortId ?? order.id, // keep your existing shortId if present
    deliveredAt: delivered?.at ?? null,
    customer: order.customer,
    items: order.items,
    files,                        // ⬅️ use normalized files
    budget: (order as any).createdFromBudget
      ? {
          id: (order as any).createdFromBudgetId ?? null,
          pdfUrl: (order as any).createdFromBudget?.pdfUrl ?? null,
        }
      : null,
});
}