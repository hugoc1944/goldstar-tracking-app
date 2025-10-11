import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import crypto from 'node:crypto';
import { notifyOrderCreated } from '@/lib/notify';

export const runtime = 'nodejs';

const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);

const FileZ = z.object({
  url: z.string().url(),
  name: z.string(),
  size: z.number(),
  mime: z.string().nullable().optional(),
});

const CreateBody = z.object({
  client: z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().optional().nullable(),
    nif: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    postal: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
  }),
  order: z.object({
    // core
    model: z.string(),                                  // -> OrderItem.model
    finish: z.string().optional().nullable(),
    acrylic: z.string().optional().nullable(),
    serigraphy: z.string().optional().nullable(),
    serigrafiaColor: z.string().optional().nullable(),  // <— NEW
    glassTypeKey: z.string().optional().nullable(),     // <— NEW
    handleKey: z.string().optional().nullable(),        // <— NEW

    // complements + per-complement colors
    complements: z.string().optional().nullable(),      // e.g. "vision" | "toalheiro1" | "prateleira" | "nenhum"
    barColor: z.string().optional().nullable(),         // vision only
    visionSupport: z.string().optional().nullable(),    // vision only
    towelColorMode: z.string().optional().nullable(),   // toalheiro1 only: "padrao" | "acabamento"
    shelfColorMode: z.string().optional().nullable(),   // prateleira only: "padrao" | "acabamento"
    fixingBarMode: z.string().optional().nullable(),    // rule: 'padrao' | 'acabamento'

    // status / meta
    initialStatus: Status,
    eta: z.string().datetime().nullable().optional(),

    // files + extra items
    files: z.array(FileZ).optional().default([]),
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive().default(1),
    })).optional().default([]),

    // NEW: delivery block
    delivery: z.object({
      deliveryType: z.string().optional().nullable(),   // "entrega" | "entrega_instalacao"
      housingType:  z.string().optional().nullable(),   // livre
      floorNumber:  z.number().int().optional().nullable(),
      hasElevator:  z.boolean().optional().nullable(),
    }).optional(),
  }),
});

export async function POST(req: Request) {
  const admin = await requireAdminSession();
  const { client, order } = CreateBody.parse(await req.json());

  if (order.initialStatus === 'EXPEDICAO' && !order.eta) {
    return NextResponse.json({ error: 'ETA é obrigatória para Expedição.' }, { status: 400 });
  }

  // Upsert cliente por email (ou refresh se veio id)
  let customer;
  if (client.id) {
    customer = await prisma.customer.findUnique({ where: { id: client.id } });
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }
    customer = await prisma.customer.update({
      where: { id: client.id },
      data: {
        name:    client.name,
        phone:   client.phone ?? null,
        nif:     client.nif ?? null,
        address: client.address ?? null,
        postal:  client.postal ?? null,
        city:    client.city ?? null,
      },
    });
  } else {
    customer = await prisma.customer.upsert({
      where: { email: client.email },
      update: {
        name:    client.name,
        phone:   client.phone ?? null,
        nif:     client.nif ?? null,
        address: client.address ?? null,
        postal:  client.postal ?? null,
        city:    client.city ?? null,
      },
      create: {
        name:    client.name,
        email:   client.email,
        phone:   client.phone ?? null,
        nif:     client.nif ?? null,
        address: client.address ?? null,
        postal:  client.postal ?? null,
        city:    client.city ?? null,
      },
    });
  }

  const publicToken = crypto.randomBytes(24).toString('base64url');

  const created = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        customerId: customer.id,
        status: order.initialStatus,
        eta: order.eta ? new Date(order.eta) : null,
        trackingNumber: null,
        publicToken,

        // files
        filesJson: order.files?.length ? order.files : undefined,

        // NEW — delivery on Order
        deliveryType: order.delivery?.deliveryType ?? null,
        housingType:  order.delivery?.housingType  ?? null,
        floorNumber:  order.delivery?.floorNumber  ?? null,
        hasElevator:  typeof order.delivery?.hasElevator === 'boolean'
          ? order.delivery!.hasElevator
          : null,
      },
      select: { id:true, status:true, eta:true, publicToken:true, createdAt:true }
    });

    // Item sintético com os detalhes do produto
    await tx.orderItem.create({
      data: {
        orderId: o.id,
        description: 'Detalhes do produto',
        quantity: 1,
        model: order.model,

        // guardamos o código simples do complemento; cores/“modes” ficam em customizations
        complements: order.complements ?? 'nenhum',

        // tudo o resto segue para customizations (para o EditOrderModal pré-preencher)
        customizations: {
          handleKey: order.handleKey ?? null,
          finish: order.finish ?? null,
          glassTypeKey: order.glassTypeKey ?? null,
          acrylic: order.acrylic ?? null,
          serigraphy: order.serigraphy ?? null,
          serigrafiaColor: order.serigrafiaColor ?? null,
          fixingBarMode: order.fixingBarMode ?? null,

          // complement-specific
          barColor: order.barColor ?? null,
          visionSupport: order.visionSupport ?? null,
          towelColorMode: order.towelColorMode ?? null,
          shelfColorMode: order.shelfColorMode ?? null,
        },
      },
    });

    // Itens extra, se vierem
    if (order.items?.length) {
      await tx.orderItem.createMany({
        data: order.items.map(it => ({
          orderId: o.id,
          description: it.description,
          quantity: it.quantity ?? 1,
        })),
      });
    }

    // Evento inicial se não for PREPARACAO
    if (order.initialStatus !== 'PREPARACAO') {
      await tx.statusEvent.create({
        data: {
          orderId: o.id,
          from: 'PREPARACAO',
          to: order.initialStatus,
          byAdminId: admin.id,
          note: null,
        },
      });
    }

    return o;
  });

  // Email de criação (best-effort)
  try {
    await notifyOrderCreated({
      id: created.id,
      publicToken: created.publicToken,
      customer: { name: customer.name, email: customer.email },
    });
  } catch (e) {
    console.warn('notifyOrderCreated falhou:', e);
  }

  return NextResponse.json({ id: created.id, publicToken: created.publicToken });
}

// ---------- GET (unchanged) ----------
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawSearch = (url.searchParams.get('search') ?? '').trim();
  const status = url.searchParams.get('status') as
    | 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE' | null;
  const model = url.searchParams.get('model') ?? '';
  const take = Math.min(parseInt(url.searchParams.get('take') ?? '20', 10) || 20, 50);
  const cursor = url.searchParams.get('cursor');

  let search = rawSearch;
  if (search.startsWith('#')) search = search.slice(1);

  const where: any = {};
  where.confirmedAt = { not: null };
  if (status) where.status = status;

  if (search) {
    where.OR = [
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      { id: { startsWith: search } },
      { id: { contains: search } },
      { publicToken: { contains: search } },
      { trackingNumber: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (model) {
    where.items = { some: { model } };
  }

  const orders = await prisma.order.findMany({
    where,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      customer: { select: { name: true } },
      items: { select: { model: true }, take: 1, orderBy: { createdAt: 'asc' } },
    },
  });

  const hasMore = orders.length > take;
  const page = hasMore ? orders.slice(0, take) : orders;

  const rows = page.map(o => ({
    id: o.id,
    shortId: '#' + o.id.slice(0, 4),
    customer: { name: o.customer?.name ?? '' },
    status: o.status,
    eta: o.eta ? o.eta.toISOString() : null,
    model: o.items[0]?.model ?? null,
    createdAt: o.createdAt.toISOString(),
  }));

  return NextResponse.json({
    rows,
    total: await prisma.order.count({ where }),
    nextCursor: hasMore ? orders[orders.length - 1].id : null,
  });
}
