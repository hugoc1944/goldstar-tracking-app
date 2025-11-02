// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import { notifyStatusChanged } from '@/lib/notify';
import { use } from 'react'; // <- needed to unwrap ctx.params in Next 15

export const runtime = 'nodejs'; 
const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);
const StatusOrPseudo = Status.or(z.literal('AGUARDA_VISITA')); // <- NEW

const PatchBody = z.object({
  action: z.enum(['status','update']),

  // action: status
  to: StatusOrPseudo.optional(), // <- allow AGUARDA_VISITA to come in the body
  visitAt: z.string().datetime().nullable().optional(), 
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
    const toAny = body.to!;           // can be real status OR the pseudo 'AGUARDA_VISITA'
    const current = order.status as z.infer<typeof Status>;

    // --- Branch A: pseudo-status → store PREPARACAO + visitAwaiting=true ---
    if (toAny === 'AGUARDA_VISITA') {
      const now = new Date();

      // remember old visitAt to decide if this is the first scheduling
      const prevVisitAt = order.visitAt ?? null;

      const o = await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'PREPARACAO',
          visitAwaiting: true,
          visitAt: body.visitAt ? new Date(body.visitAt) : (order.visitAt ?? null),
          events: {
            create: {
              from: 'PREPARACAO',
              to: 'PREPARACAO',
              at: now,
              note: body.visitAt
                ? 'Visita técnica agendada'
                : 'A aguardar visita do técnico',
            } as any,
          },
        },
        include: { customer: true },
      });

      // If a date was supplied (and it’s new), email the client
      try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';
    const link = `${base}/pedido/${o.publicToken}`;

    const { render } = await import('@react-email/render');
    const { Resend } = await import('resend');

    // 1) If a date was supplied AND it changed → "Visita agendada"
    if (body.visitAt && (!prevVisitAt || +new Date(body.visitAt) !== +prevVisitAt)) {
      const { VisitScheduledEmail } = await import('@/emails/VisitScheduled');

      const when = new Intl.DateTimeFormat('pt-PT', {
        dateStyle: 'full',
        timeStyle: 'short',
      }).format(new Date(body.visitAt));

      const html = await render(
        VisitScheduledEmail({
          customerName: o.customer?.name ?? 'Cliente',
          visitAtISO: body.visitAt,
          publicLink: link,
        })
      );

      const resend = new Resend(process.env.RESEND_API_KEY!);
      const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

      await resend.emails.send({
        from: `GOLDSTAR <${fromAddr}>`,
        to: o.customer?.email ?? '',
        subject: `Visita técnica agendada - ${when}`,
        html,
      });

    // 2) If no date provided and this is the first time we move to "aguarda visita"
    } else if (!prevVisitAt && !body.visitAt) {
      const { VisitAwaitingEmail } = await import('@/emails/VisitAwaiting');

      const html = await render(
        VisitAwaitingEmail({
          customerName: o.customer?.name ?? 'Cliente',
          publicToken: link,
        })
      );

      const resend = new Resend(process.env.RESEND_API_KEY!);
      const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

      await resend.emails.send({
        from: `GOLDSTAR <${fromAddr}>`,
        to: o.customer?.email ?? '',
        subject: 'Aguarda visita — entraremos em contacto para agendar',
        html,
      });
    }
  } catch (e) {
    console.warn('Falha ao enviar email de visita (aguarda/agendada):', e);
  }
    return NextResponse.json({ ok: true });
  }

  // From here on, `to` must be a real status from your enum
  const to = Status.parse(toAny);

  // --- Branch B: flip the flag when explicitly setting PREPARACAO while visitAwaiting=true ---
  // This is NOT a status transition (we keep status=PREPARACAO), we just conclude the visit,
  // write an event and send a "visit concluded" email.
  if (to === 'PREPARACAO' && order.visitAwaiting) {
    const now = new Date();
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        visitAwaiting: false,
        events: {
          create: {
            from: 'PREPARACAO',
            to: 'PREPARACAO',
            at: now,
            note: 'Visita técnica concluída',
          } as any,
        },
      },
      include: { customer: true },
    });

    // Send a small “visit concluded — now in PREPARAÇÃO” email
    try {
      const base =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.NEXTAUTH_URL ||
        'http://localhost:3000';

      const { render } = await import('@react-email/render');
      const { OrderStatusChangedEmail } = await import('@/emails/OrderStatusChanged');

      const html = await render(
        OrderStatusChangedEmail({
          customerName: updated.customer?.name ?? 'Cliente',
          publicToken: updated.publicToken,
          newStatus: 'PREPARACAO',
          eta: null,
          trackingNumber: null,
        })
      );

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

      await resend.emails.send({
        from: `GOLDSTAR <${fromAddr}>`,
        to: updated.customer?.email ?? '',
        subject: 'Visita concluída - o seu pedido está em preparação',
        html,
      });
    } catch (e) {
      console.warn('Falha a enviar email de visita concluída:', e);
    }

    return NextResponse.json({ ok: true });
  }

  // --- Normal validations for real transitions (unchanged) ---
  if (!ALLOWED_NEXT[current]?.includes(to)) {
    return NextResponse.json({ error: `Transição inválida: ${current} → ${to}` }, { status: 400 });
  }

  // --- Normal transition (unchanged) ---
  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id: order.id },
      data: {
        status: to,
        // ETA optional when EXPEDICAO; only set if provided; clear on ENTREGUE
        ...(to === 'EXPEDICAO'
          ? (body.eta ? { eta: new Date(body.eta) } : {})
          : to === 'ENTREGUE'
          ? { eta: null }
          : {}),
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
      ...(body.details.finish          !== undefined ? { finish: body.details.finish, finishKey: body.details.finish } : {}),
      ...(body.details.serigraphy      !== undefined ? { serigraphy: body.details.serigraphy, serigrafiaKey: body.details.serigraphy } : {}),
      
      ...(body.details.handleKey       !== undefined ? { handleKey: body.details.handleKey } : {}),
      ...(body.details.glassTypeKey    !== undefined ? { glassTypeKey: body.details.glassTypeKey } : {}),
      ...(body.details.acrylic         !== undefined ? { acrylic: body.details.acrylic } : {}),
      ...(body.details.serigrafiaColor !== undefined ? { serigrafiaColor: body.details.serigrafiaColor } : {}),
      ...(body.details.fixingBarMode   !== undefined ? { fixingBarMode: body.details.fixingBarMode } : {}),
      ...(body.details.barColor        !== undefined ? { barColor: body.details.barColor } : {}),
      ...(body.details.visionSupport   !== undefined ? { visionSupport: body.details.visionSupport } : {}),
      ...(body.details.towelColorMode  !== undefined ? { towelColorMode: body.details.towelColorMode } : {}),
      ...(body.details.shelfColorMode  !== undefined ? { shelfColorMode: body.details.shelfColorMode } : {}),
    };

    // Normalize complements: if it's 'vision'/'toalheiro1'/'prateleira', store JSON with extra color modes
    let nextComplements: string | null | undefined = body.details.complements ?? undefined;

    if (typeof nextComplements === 'string') {
      // normalize "nenhum" to null if you don't want to persist the literal
      nextComplements = nextComplements === 'nenhum' ? null : nextComplements;
    } else if (nextComplements && typeof nextComplements === 'object') {
      // if something upstream ever sends an object, fall back to its 'code'
      nextComplements = (nextComplements as any).code ?? null;
    } else {
      nextComplements = null;
    }

    await tx.orderItem.update({
    where: { id: detailItem.id },
    data: {
      model: body.details.model ?? undefined,
      complements: nextComplements,      // <-- now a string or null, not an object
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
      finish:          (cz.finish ?? cz.finishKey ?? ''),
      glassTypeKey:    (detailItem?.customizations as any)?.glassTypeKey ?? '',
      acrylic:         (detailItem?.customizations as any)?.acrylic ?? 'DIVERSOS',
      serigraphy:      (cz.serigraphy ?? cz.serigrafiaKey ?? 'nenhum'),
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
    state: {                                   
      status:        order.status,
      visitAwaiting: order.visitAwaiting ?? false,
      visitAt:       order.visitAt ?? null,
    },
  },
});
}
