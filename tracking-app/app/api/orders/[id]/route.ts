// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import { notifyStatusChanged } from '@/lib/notify';
import { use } from 'react'; // <- needed to unwrap ctx.params in Next 15

export const runtime = 'nodejs'; 
const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);

const PatchBody = z.object({
  action: z.enum(['status','update']),

  // action: status
  to: Status.optional(),
  eta: z.string().datetime().nullable().optional(),
  note: z.string().max(500).optional(),

  // action: update
  client: z.object({
    name:  z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    nif: z.string().optional().nullable(),
    postal: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
  }).optional(),

  details: z.object({
    // SUMMARY FIELDS
    model: z.string().optional().nullable(),
    complements: z.string().optional().nullable(),

    // FULL CUSTOMIZATION KEYS (match Admin/Public forms)
    handleKey: z.string().optional().nullable(),
    finish: z.string().optional().nullable(),
    glassTypeKey: z.string().optional().nullable(),
    acrylic: z.string().optional().nullable(),

    serigraphy: z.string().optional().nullable(),
    serigrafiaColor: z.string().optional().nullable(),

    barColor: z.string().optional().nullable(),      // Vision only
    visionSupport: z.string().optional().nullable(), // Vision only

    towelColorMode: z.string().optional().nullable(), // Toalheiro 1
    shelfColorMode: z.string().optional().nullable(), // Prateleira

    fixingBarMode: z.string().optional().nullable(),  // Models with fixing bar

    // legacy if you still use it anywhere:
    monochrome: z.string().optional().nullable(),

    // tracking code (kept from your previous schema)
    tracking: z.string().optional().nullable(),
  }).optional(),

  delivery: z.object({
    deliveryType: z.string().nullable().optional(),
    housingType:  z.string().nullable().optional(),
    floorNumber:  z.number().int().nullable().optional(),
    hasElevator:  z.boolean().nullable().optional(),
  }).optional(),
  files: z.array(z.object({
    url: z.string().url(),
    name: z.string(),
    size: z.number(),
    mime: z.string().nullable().optional(),
  })).optional(),
});

const ALLOWED_NEXT: Record<z.infer<typeof Status>, z.infer<typeof Status>[]> = {
  PREPARACAO: ['PRODUCAO'],
  PRODUCAO: ['EXPEDICAO'],
  EXPEDICAO: ['ENTREGUE'],
  ENTREGUE: [],
};

// -------- PATCH (status / update)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  // Unwrap params for Next 15
  const p = (ctx.params as any);
  const { id } = typeof p?.then === 'function' ? await p : p;

  const admin = await requireAdminSession();
  const body = PatchBody.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { orderBy: { createdAt: 'asc' } }, // 1º item = “Detalhes do produto”
    },
  });
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

  if (body.action === 'status') {
  const to = body.to!;
  const current = order.status as z.infer<typeof Status>;

  if (!ALLOWED_NEXT[current]?.includes(to)) {
    return NextResponse.json({ error: `Transição inválida: ${current} → ${to}` }, { status: 400 });
  }
  if (to === 'EXPEDICAO' && !body.eta) {
    return NextResponse.json({ error: 'ETA é obrigatória para Expedição.' }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        eta: to === 'EXPEDICAO'
          ? new Date(body.eta!)
          : (to === 'ENTREGUE' ? null : order.eta),
      },
      select: { id: true, status: true, eta: true, publicToken: true, trackingNumber: true },
    });

    await tx.statusEvent.create({
      data: {
        orderId: order.id,
        from: current,
        to,
        byAdminId: admin.id,
        note: body.note ?? null,
      },
    });

    return o;
  });

  try {
    await notifyStatusChanged({
      id: order.id,
      publicToken: order.publicToken,
      status: updated.status,
      eta: updated.eta ?? null,
      trackingNumber: updated.trackingNumber ?? null,
      customer: { name: order.customer.name, email: order.customer.email },
    });
  } catch (e) {
    console.warn('notifyStatusChanged falhou:', e);
  }

  return NextResponse.json({ ok: true, status: updated.status, eta: updated.eta });
}

/* ---------- action: 'update' ---------- */
await prisma.$transaction(async (tx) => {
  // 1) Update customer (now includes name/email too)
  if (body.client) {
  await tx.customer.update({
    where: { id: order.customerId },
    data: {
      name:   body.client.name   ?? undefined,
      email:  body.client.email  ?? undefined,
      phone:  body.client.phone  ?? undefined,
      address:body.client.address?? undefined,
      nif:    body.client.nif    ?? undefined,
      postal: body.client.postal ?? undefined,
      city:   body.client.city   ?? undefined,
    },
  });
}
if (body.delivery) {
  await tx.order.update({
    where: { id: order.id },
    data: {
      deliveryType: body.delivery.deliveryType ?? undefined,
      housingType:  body.delivery.housingType  ?? undefined,
      floorNumber:  body.delivery.floorNumber  ?? undefined,
      hasElevator:  body.delivery.hasElevator  ?? undefined,
    },
  });
}

  // 2) Order-level fields (files & tracking)
  const orderData: any = {};
  if (body.files) orderData.filesJson = body.files;
  if (body.details?.tracking !== undefined) {
    orderData.trackingNumber = body.details.tracking ?? null;
  }
  if (Object.keys(orderData).length) {
    await tx.order.update({ where: { id: order.id }, data: orderData });
  }

  // 3) Details → first item customizations (create if missing)
  if (body.details) {
  const detailItem = order.items[0];
  if (detailItem) {
    const prev = (detailItem.customizations as any) ?? {};
    const nextCustom = {
      ...prev,
      ...(body.details.handleKey       !== undefined ? { handleKey: body.details.handleKey } : {}),
      ...(body.details.finish          !== undefined ? { finish: body.details.finish } : {}),
      ...(body.details.glassTypeKey    !== undefined ? { glassTypeKey: body.details.glassTypeKey } : {}),
      ...(body.details.acrylic         !== undefined ? { acrylic: body.details.acrylic } : {}),
      ...(body.details.serigraphy      !== undefined ? { serigraphy: body.details.serigraphy } : {}),
      ...(body.details.serigrafiaColor !== undefined ? { serigrafiaColor: body.details.serigrafiaColor } : {}),
      ...(body.details.fixingBarMode   !== undefined ? { fixingBarMode: body.details.fixingBarMode } : {}),
      ...(body.details.barColor        !== undefined ? { barColor: body.details.barColor } : {}),
      ...(body.details.visionSupport   !== undefined ? { visionSupport: body.details.visionSupport } : {}),
      ...(body.details.towelColorMode  !== undefined ? { towelColorMode: body.details.towelColorMode } : {}),
      ...(body.details.shelfColorMode  !== undefined ? { shelfColorMode: body.details.shelfColorMode } : {}),
    };

    // Normalize complements: if it's 'vision'/'toalheiro1'/'prateleira', store JSON with extra color modes
    let nextComplements: any = body.details.complements ?? undefined;
    if (typeof nextComplements === 'string' && nextComplements && nextComplements !== 'nenhum') {
      nextComplements = {
        code: nextComplements,
        barColor:      body.details.barColor ?? prev.barColor ?? undefined,
        visionSupport: body.details.visionSupport ?? prev.visionSupport ?? undefined,
        towelColorMode:body.details.towelColorMode ?? prev.towelColorMode ?? undefined,
        shelfColorMode:body.details.shelfColorMode ?? prev.shelfColorMode ?? undefined,
      };
    }

    await tx.orderItem.update({
      where: { id: detailItem.id },
      data: {
        model:        body.details.model ?? undefined,
        complements:  nextComplements,
        customizations: nextCustom,
      },
    });
  }
}
});

return NextResponse.json({ ok: true });
}

// -------- GET (used by EditOrderModal loader)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  // Unwrap params for Next 15
  const p = (ctx.params as any);
  const { id } = typeof p?.then === 'function' ? await p : p;

  await requireAdminSession();
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: {
        select: { name: true, email: true, phone: true, address: true, nif: true, postal: true, city: true },
      },
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          model: true,
          description: true,
          quantity: true,
          customizations: true,
          complements: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });

  const detailItem = order.items[0];
  const cz = (detailItem?.customizations as any) ?? {};
  return NextResponse.json({
  id: order.id,
  trackingNumber: order.trackingNumber ?? null,
  filesJson: order.filesJson ?? [],
  customer: order.customer,
  items: order.items,
  forModal: {
    id: order.id,
    client: {
      name:  order.customer?.name  ?? '',
      email: order.customer?.email ?? '',
      phone: order.customer?.phone ?? '',
      address: order.customer?.address ?? '',
      postal:  order.customer?.postal  ?? '',
      city:    order.customer?.city    ?? '',
    },
    delivery: {
      deliveryType: order.deliveryType ?? '',
      housingType:  order.housingType  ?? '',
      floorNumber:  order.floorNumber  ?? null,
      hasElevator:  order.hasElevator  ?? null,
    },
    details: {
      // item 0
      model:           detailItem?.model ?? 'DIVERSOS',
      // read from customizations:
      handleKey:       (detailItem?.customizations as any)?.handleKey ?? '',
      finish:          (detailItem?.customizations as any)?.finish ?? 'DIVERSOS',
      glassTypeKey:    (detailItem?.customizations as any)?.glassTypeKey ?? '',
      acrylic:         (detailItem?.customizations as any)?.acrylic ?? 'DIVERSOS',
      serigraphy:      (detailItem?.customizations as any)?.serigraphy ?? 'DIVERSOS',
      serigrafiaColor: (detailItem?.customizations as any)?.serigrafiaColor ?? '',
      fixingBarMode:   (detailItem?.customizations as any)?.fixingBarMode ?? '',
      // complements (normalize)
      ...( (() => {
          const raw = detailItem?.complements;
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return {
              complements:    parsed?.code ?? (typeof raw === 'string' ? raw : 'DIVERSOS'),
              barColor:       parsed?.barColor ?? (detailItem?.customizations as any)?.barColor ?? '',
              visionSupport:  parsed?.visionSupport ?? (detailItem?.customizations as any)?.visionSupport ?? '',
              towelColorMode: parsed?.towelColorMode ?? (detailItem?.customizations as any)?.towelColorMode ?? '',
              shelfColorMode: parsed?.shelfColorMode ?? (detailItem?.customizations as any)?.shelfColorMode ?? '',
            };
          } catch {
            return {
              complements:    typeof raw === 'string' ? raw : 'DIVERSOS',
              barColor:       (detailItem?.customizations as any)?.barColor ?? '',
              visionSupport:  (detailItem?.customizations as any)?.visionSupport ?? '',
              towelColorMode: (detailItem?.customizations as any)?.towelColorMode ?? '',
              shelfColorMode: (detailItem?.customizations as any)?.shelfColorMode ?? '',
            };
          }
        })()
      ),
    },
    files: (order.filesJson as any[]) ?? [],
  },
});
}
