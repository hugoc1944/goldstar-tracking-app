// app/api/pedido/[publicToken]/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { notifySupportMessage } from '@/lib/notify';
import { $Enums } from '@prisma/client'; // ✅ Prisma v5 enums

export const runtime = 'nodejs';

// ---------- helpers ----------
const Body = z.object({
  text: z.string().trim().min(1).max(4000),
});
function pickUrl(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  return val.url ?? val.href ?? val.fileUrl ?? val.downloadUrl ?? val.src ?? null;
}
// Remove null/empty and drop fields whose value is exactly "Nenhum" (case-insensitive)
function cleanCustomizations(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;

    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) continue;
      if (s.localeCompare('nenhum', undefined, { sensitivity: 'accent' }) === 0) continue;
      out[k] = s;
      continue;
    }

    if (Array.isArray(v)) {
      const arr = v
        .map(x => (typeof x === 'string' ? x.trim() : x))
        .filter(x => {
          if (x == null || x === '') return false;
          if (typeof x === 'string' && x.toLowerCase() === 'nenhum') return false;
          return true;
        });
      if (arr.length) out[k] = arr;
      continue;
    }

    // number/boolean/object: keep as-is
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Complements: hide when exactly "Nenhum"
const mapComplements = (c: unknown) =>
  typeof c === 'string' && c.trim().toLowerCase() === 'nenhum' ? null : c ?? null;

// Accept both the "params is an object" and "params is a Promise" calling styles
async function resolveCtx(ctx: any): Promise<{ params: { publicToken: string } }> {
  if (ctx && typeof ctx.then === 'function') {
    // it's a Promise<{ params }>
    return await ctx;
  }
  return ctx;
}

// ---------- GET ----------
export async function GET(_req: Request, ctx: any) {
  const { params } = await resolveCtx(ctx);
  const { publicToken } = params;

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      events: {
        orderBy: { at: 'asc' },
        select: { from: true, to: true, at: true, note: true },
      },
      
      items: {
        select: {
          description: true,
          quantity: true,
          model: true,
          complements: true,
          customizations: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      customer: { select: { name: true } },
      createdFromBudget: {
        select: {
          sentAt: true,
          confirmedAt: true,
          quotedPdfUrl: true,  
          widthMm: true,        
          heightMm: true,      
          depthMm: true,        
          willSendLater: true, 
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const requiresConfirmation = order.confirmedAt == null;

  return NextResponse.json({
    ref: order.id,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    eta: order.eta ? order.eta.toISOString() : null,
    clientName: order.customer?.name ?? null,
    requiresConfirmation,
    visitAwaiting: order.visitAwaiting,
    pdfUrl: order.createdFromBudget?.quotedPdfUrl ?? null,
    
    delivery: {
    deliveryType: order.deliveryType ?? null,
    housingType:  order.housingType ?? null,
    floorNumber:  order.floorNumber ?? null,
    hasElevator:  order.hasElevator ?? null,
    },
    measures: order.createdFromBudget
      ? {
          widthMm:      order.createdFromBudget.widthMm ?? null,
          heightMm:     order.createdFromBudget.heightMm ?? null,
          depthMm:      order.createdFromBudget.depthMm ?? null,
          willSendLater: order.createdFromBudget.willSendLater ?? null,
        }
      : null,

    items: requiresConfirmation
      ? []
      : order.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          model: it.model ?? null,
          complements: it.complements ?? null,
          customizations:
            (it.customizations as Record<string, string | null> | null) ?? null,
        })),
    events: requiresConfirmation
      ? []
      : order.events.map((e) => ({
          from: e.from,
          to: e.to,
          at: e.at.toISOString(),
          note: e.note,
        })),
  });
}

// ---------- POST (public message -> notifies support, stores message) ----------
export async function POST(req: Request, ctx: any) {
  const { params } = await resolveCtx(ctx);
  const { publicToken } = params;

  const { text } = Body.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: {
      customer: { select: { name: true, email: true, phone: true, address: true, nif: true } },
    },
  });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

  // ✅ Prisma v5 enum usage
  await prisma.message.create({
    data: {
      orderId: order.id,
      authorType: $Enums.AuthorType.CLIENTE,
      body: text,
    },
  });

  try {
    await notifySupportMessage({
      orderId: order.id,
      publicToken: order.publicToken,
      customer: {
        name: order.customer?.name ?? 'Cliente',
        email: order.customer?.email ?? '',
      },
      message: text,
    });
  } catch (e) {
    console.warn('notifySupportMessage failed:', e);
  }

  return NextResponse.json({ ok: true });
}
