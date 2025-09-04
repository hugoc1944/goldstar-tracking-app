import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import crypto from 'node:crypto';
import { notifyOrderCreated } from '@/lib/notify';


const Status = z.enum(['PREPARACAO','PRODUCAO','EXPEDICAO','ENTREGUE']);

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
    model: z.string(),                                  // coloca-se em OrderItem.model
    finish: z.string().optional().nullable(),
    acrylic: z.string().optional().nullable(),
    serigraphy: z.string().optional().nullable(),
    monochrome: z.string().optional().nullable(),
    complements: z.string().optional().nullable(),
    initialStatus: Status,
    eta: z.string().datetime().nullable().optional(),   // ISO quando EXPEDICAO
    files: z.array(z.object({
      url: z.string().url(),
      name: z.string(),
      size: z.number(),
      mime: z.string().nullable().optional()
    })).optional().default([]),
    items: z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().int().positive().default(1),
    })).optional().default([]),
  }),
});

async function searchCustomersByNameOrEmail(q: string) {
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, phone: true, nif: true, address: true, postal: true, city: true },
  });
  return customers;
}

export async function POST(req: Request) {
  const admin = await requireAdminSession(); // garante admin; deve devolver pelo menos { id, email }
  const { client, order } = CreateBody.parse(await req.json());

  if (order.initialStatus === 'EXPEDICAO' && !order.eta) {
    return NextResponse.json({ error: 'ETA é obrigatória para Expedição.' }, { status: 400 });
  }

  // Upsert cliente por email
  let customer;
  if (client.id) {
    customer = await prisma.customer.findUnique({ where: { id: client.id } });
    if (!customer) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }
    // Optionally refresh fields if UI allowed editing after selection:
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
        filesJson: order.files?.length ? order.files : undefined,
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
        complements: order.complements,
        customizations: {
          finish: order.finish ?? null,
          acrylic: order.acrylic ?? null,
          serigraphy: order.serigraphy ?? null,
          monochrome: order.monochrome ?? null,
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
          byAdminId: admin.id,     // ⚠️ usa "id" (o helper deve devolver { id: string })
          note: null,
        },
      });
    }

    return o;
  });

  // Email de criação
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

// helper to build a short human ID like “#1250”
function shortIdFromDate(dt: Date): string {
  // example: yymmddHH (or whatever you prefer)
  // if you want sequential numbers instead, store and increment a counter
  const pad = (n:number)=> String(n).padStart(2,'0');
  const d = new Date(dt);
  return `#${String(d.getFullYear()).slice(2)}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
}
export async function GET(req: Request) {
  const url = new URL(req.url);
  // NOTE: the page sends `search` in the querystring for the API call
  const rawSearch = (url.searchParams.get('search') ?? '').trim();
  const status = url.searchParams.get('status') as
    | 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE' | null;
  const model = url.searchParams.get('model') ?? '';
  const take = Math.min(parseInt(url.searchParams.get('take') ?? '20', 10) || 20, 50);
  const cursor = url.searchParams.get('cursor');

  // Normalize search input
  // Accept: "#91ce" | "91ce" (short prefix), full UUID, publicToken, tracking, or customer name
  let search = rawSearch;
  if (search.startsWith('#')) search = search.slice(1);

  const where: any = {};
  if (status) where.status = status;

  if (search) {
    where.OR = [
      // Customer name
      { customer: { name: { contains: search, mode: 'insensitive' } } },
      // Short id prefix (first 4)
      { id: { startsWith: search } },
      // Full UUID or any longer prefix (contains covers copy/pastes)
      { id: { contains: search } },
      // Public tracking token (from public page/email)
      { publicToken: { contains: search } },
      // Carrier tracking number
      { trackingNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Filter by model = first OrderItem.model (“Detalhes do produto” row)
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
    shortId: '#' + o.id.slice(0, 4),       // <-- unified short ref
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