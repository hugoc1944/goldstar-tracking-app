// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import { notifyStatusChanged } from '@/lib/notify';

export const runtime = 'nodejs';
const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);
const StatusOrPseudo = Status.or(z.literal('AGUARDA_VISITA'));

const PatchBody = z.object({
  action: z.enum(['status','update']),

  // action: status
  to: StatusOrPseudo.optional(),
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
    model: z.string().optional().nullable(),
    complements: z.union([z.string(), z.array(z.string())]).optional().nullable(),
    shelfHeightPct: z.number().int().min(20).max(100).optional().nullable(),
    handleKey: z.string().optional().nullable(),
    finish: z.string().optional().nullable(),
    glassTypeKey: z.string().optional().nullable(),
    acrylic: z.string().optional().nullable(),
    serigraphy: z.string().optional().nullable(),
    serigrafiaColor: z.string().optional().nullable(),
    barColor: z.string().optional().nullable(),
    visionSupport: z.string().optional().nullable(),
    towelColorMode: z.string().optional().nullable(),
    shelfColorMode: z.string().optional().nullable(),
    fixingBarMode: z.string().optional().nullable(),
    monochrome: z.string().optional().nullable(),
    tracking: z.string().optional().nullable(),
    // note: width/height/depth may also come as top-level fields (see below)
  }).optional(),

  // top-level measurements (optional) — your Edit modal sends these at top level
  widthMm:  z.number().int().positive().nullable().optional(),
  heightMm: z.number().int().positive().nullable().optional(),
  depthMm:  z.number().int().positive().nullable().optional(),

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

  // ---------- ACTION: status ----------
  if (body.action === 'status') {
    const toAny = body.to!;
    const current = order.status as z.infer<typeof Status>;

    // pseudo-status => set PREPARACAO + visitAwaiting
    if (toAny === 'AGUARDA_VISITA') {
      const now = new Date();
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
              note: body.visitAt ? 'Visita técnica agendada' : 'A aguardar visita do técnico',
            } as any,
          },
        },
        include: { customer: true },
      });

      // send emails (best-effort)
      try {
        const base =
          process.env.NEXT_PUBLIC_BASE_URL ||
          process.env.NEXTAUTH_URL ||
          'http://localhost:3000';
        const link = `${base}/pedido/${o.publicToken}`;

        const { render } = await import('@react-email/render');
        const { Resend } = await import('resend');

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

    // from here `to` must be real status
    const to = Status.parse(toAny);

    // conclude awaiting visit when explicitly setting PREPARACAO
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

      // send concluded email
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

    // normal transition validations
    if (!ALLOWED_NEXT[order.status as z.infer<typeof Status>] || !ALLOWED_NEXT[order.status as z.infer<typeof Status>].includes(to)) {
      return NextResponse.json({ error: `Transição inválida: ${order.status} → ${to}` }, { status: 400 });
    }

    // perform transition in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id: order.id },
        data: {
          status: to,
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
          from: order.status as any,
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

  // ---------- ACTION: update ----------
  if (body.action === 'update') {
    // Keep everything atomic
    await prisma.$transaction(async (tx) => {
      // 1) Update customer
      if (body.client) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            name:   body.client.name   ?? undefined,
            email:  body.client.email  ?? undefined,
            phone:  body.client.phone  ?? undefined,
            address:body.client.address ?? undefined,
            nif:    body.client.nif    ?? undefined,
            postal: body.client.postal ?? undefined,
            city:   body.client.city   ?? undefined,
          },
        });
      }

      // 1b) Update delivery block if present
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

      // 2) Order-level fields (files, tracking, measurements)
      const orderData: any = {};
      if (body.files) orderData.filesJson = body.files;
      if (body.details?.tracking !== undefined) {
        orderData.trackingNumber = body.details.tracking ?? null;
      }

      // accept top-level measurements (widthMm/heightMm/depthMm)
      if (body.widthMm !== undefined)  orderData.widthMm  = body.widthMm ?? null;
      if (body.heightMm !== undefined) orderData.heightMm = body.heightMm ?? null;
      if (body.depthMm !== undefined)  orderData.depthMm  = body.depthMm ?? null;

      if (Object.keys(orderData).length) {
        await tx.order.update({ where: { id: order.id }, data: orderData });
      }

      // 3) Details -> first item customizations (create if missing)
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
            ...(body.details.shelfHeightPct  !== undefined ? { shelfHeightPct: body.details.shelfHeightPct } : {}),
            // measurements (copy into item.customizations for legacy UI)
            ...(body.widthMm  !== undefined ? { widthMm:  body.widthMm ?? null } : {}),
            ...(body.heightMm !== undefined ? { heightMm: body.heightMm ?? null } : {}),
            ...(body.depthMm  !== undefined ? { depthMm:  body.depthMm ?? null } : {}),
          };

          const normalizeCompsInput = (raw: unknown): string | null | undefined => {
            if (raw === undefined) return undefined;
            if (raw === null) return null;

            const list =
              Array.isArray(raw)
                ? raw.map(String)
                : typeof raw === 'string'
                  ? raw.split(',')
                  : [];

            const cleaned = list
              .map(s => s.trim().toLowerCase())
              .filter(Boolean)
              .filter(c => c !== 'nenhum');

            return cleaned.length ? cleaned.join(',') : null;
          };

          const nextComplements = normalizeCompsInput(body.details.complements);
          const compsList =
            typeof nextComplements === 'string'
              ? nextComplements.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
              : [];

          if (!compsList.includes('vision')) {
            delete nextCustom.barColor;
            delete nextCustom.visionSupport;
          }
          if (!compsList.includes('toalheiro1')) {
            delete nextCustom.towelColorMode;
          }
          if (!compsList.includes('prateleira')) {
            delete nextCustom.shelfColorMode;
            delete nextCustom.shelfHeightPct;
          }

          await tx.orderItem.update({
            where: { id: detailItem.id },
            data: {
              model: body.details.model ?? undefined,
              complements: nextComplements,
              customizations: nextCustom,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  }

  // fallback (shouldn't reach)
  return NextResponse.json({ ok: false, error: 'Ação desconhecida' }, { status: 400 });
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
        model:           detailItem?.model ?? 'DIVERSOS',
        handleKey:       (detailItem?.customizations as any)?.handleKey ?? '',
        finish:          (cz.finish ?? cz.finishKey ?? ''),
        glassTypeKey:    (detailItem?.customizations as any)?.glassTypeKey ?? '',
        acrylic:         (detailItem?.customizations as any)?.acrylic ?? 'DIVERSOS',
        serigraphy:      (cz.serigraphy ?? cz.serigrafiaKey ?? 'nenhum'),
        serigrafiaColor: (detailItem?.customizations as any)?.serigrafiaColor ?? '',
        fixingBarMode:   (detailItem?.customizations as any)?.fixingBarMode ?? '',
        ...( (() => {
          const raw = detailItem?.complements;
          if (typeof raw === 'string' && raw.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(raw);
              const list = String(parsed?.code ?? '')
                .split(',')
                .map(s => s.trim().toLowerCase())
                .filter(Boolean)
                .filter(c => c !== 'nenhum');

              return {
                complements: list,
                barColor:       parsed?.barColor ?? (detailItem?.customizations as any)?.barColor ?? '',
                visionSupport:  parsed?.visionSupport ?? (detailItem?.customizations as any)?.visionSupport ?? '',
                towelColorMode: parsed?.towelColorMode ?? (detailItem?.customizations as any)?.towelColorMode ?? '',
                shelfColorMode: parsed?.shelfColorMode ?? (detailItem?.customizations as any)?.shelfColorMode ?? '',
                shelfHeightPct: parsed?.shelfHeightPct ?? (detailItem?.customizations as any)?.shelfHeightPct ?? null,
              };
            } catch {
              /* fallthrough */
            }
          }

          const list =
            typeof raw === 'string'
              ? raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).filter(c => c !== 'nenhum')
              : [];

          return {
            complements: list,
            barColor:       (detailItem?.customizations as any)?.barColor ?? '',
            visionSupport:  (detailItem?.customizations as any)?.visionSupport ?? '',
            towelColorMode: (detailItem?.customizations as any)?.towelColorMode ?? '',
            shelfColorMode: (detailItem?.customizations as any)?.shelfColorMode ?? '',
            shelfHeightPct: (detailItem?.customizations as any)?.shelfHeightPct ?? null,
            // measurements (mm) prefer order.* then fallback to customizations
            widthMm:  (order.widthMm  ?? (cz.widthMm  ?? null)),
            heightMm: (order.heightMm ?? (cz.heightMm ?? null)),
            depthMm:  (order.depthMm  ?? (cz.depthMm  ?? null)),
          };
        })() ),
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
