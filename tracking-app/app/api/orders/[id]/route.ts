// app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import { notifyStatusChanged } from '@/lib/notify';

const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);

const PatchBody = z.object({
  action: z.enum(['status','update']),
  // action: status
  to: Status.optional(),
  eta: z.string().datetime().nullable().optional(),
  note: z.string().max(500).optional(),
  // action: update
  client: z.object({
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    nif: z.string().optional().nullable(),
  }).optional(),
  details: z.object({
    model: z.string().optional(),
    finish: z.string().optional().nullable(),
    acrylic: z.string().optional().nullable(),
    serigraphy: z.string().optional().nullable(),
    monochrome: z.string().optional().nullable(),
    tracking: z.string().optional().nullable(),
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

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdminSession();
  const body = PatchBody.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { id: params.id },
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
          byAdminId: admin.id, // requireAdminSession returns { id, email }
          note: body.note ?? null,
        },
      });

      return o;
    });

    // email para o cliente (notify.ts espera `customer` aninhado + status, etc.)
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

  // action: 'update' (dados do cliente + detalhes + ficheiros)
  await prisma.$transaction(async (tx) => {
    if (body.client) {
      await tx.customer.update({
        where: { id: order.customerId },
        data: {
          phone: body.client.phone ?? undefined,
          address: body.client.address ?? undefined,
          nif: body.client.nif ?? undefined,
        },
      });
    }

    const orderData: any = {};
    if (body.files) orderData.filesJson = body.files;
    if (body.details?.tracking !== undefined) {
      orderData.trackingNumber = body.details.tracking ?? null;
    }
    if (Object.keys(orderData).length) {
      await tx.order.update({ where: { id: order.id }, data: orderData });
    }

    if (body.details) {
      const detailItem = order.items[0]; // item sintético
      if (detailItem) {
        await tx.orderItem.update({
          where: { id: detailItem.id },
          data: {
            model: body.details.model ?? undefined,
            customizations: {
              ...(detailItem.customizations as any),
              ...(body.details.finish !== undefined ? { finish: body.details.finish } : {}),
              ...(body.details.acrylic !== undefined ? { acrylic: body.details.acrylic } : {}),
              ...(body.details.serigraphy !== undefined ? { serigraphy: body.details.serigraphy } : {}),
              ...(body.details.monochrome !== undefined ? { monochrome: body.details.monochrome } : {}),
            },
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}
