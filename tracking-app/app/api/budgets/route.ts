// app/api/budgets/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, bad } from '@/lib/http';
import { BudgetCreateSchema } from '@/lib/zod-budget';
import { Prisma } from '@prisma/client';
import { render } from '@react-email/render';
import { Resend } from 'resend';
import { BudgetReceivedEmail } from '@/emails/BudgetReceived';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Pagination
  const take = Math.min(Number(searchParams.get('take') ?? 50), 200);
  const cursor = searchParams.get('cursor') ?? undefined; // id cursor

  // Basic filters
  const q = (searchParams.get('q') ?? '').trim();
  const includeDeleted = searchParams.get('includeDeleted') === '1';

  // Advanced filters
  const status = searchParams.get('status') ?? undefined; // 'not_sent' | 'awaiting_confirmation' | 'confirmed'
  const hasPdf = searchParams.get('hasPdf') === '1';

  const minPrice = searchParams.get('minPrice') ?? undefined; // euros string
  const maxPrice = searchParams.get('maxPrice') ?? undefined; // euros string

  const dateFrom = searchParams.get('dateFrom') ?? undefined; // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo') ?? undefined;     // YYYY-MM-DD

  const sort = searchParams.get('sort') ?? 'createdAt_desc';

  // Text search across key fields
  const qFilter: Prisma.BudgetWhereInput | undefined = q
    ? {
        OR: [
          { name:     { contains: q, mode: 'insensitive' as const } },
          { email:    { contains: q, mode: 'insensitive' as const } },
          { phone:    { contains: q, mode: 'insensitive' as const } },
          { modelKey: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  // Workflow status (ignores deleted items by definition)
  const statusFilter: Prisma.BudgetWhereInput | undefined =
    status === 'not_sent'
      ? { sentAt: null, deletedAt: null }
      : status === 'awaiting_confirmation'
      ? { sentAt: { not: null }, confirmedAt: null, deletedAt: null }
      : status === 'confirmed'
      ? { confirmedAt: { not: null }, deletedAt: null }
      : undefined;

  // Price filters (min / max in euros → cents)
  const priceFilter: Prisma.BudgetWhereInput | undefined =
    minPrice || maxPrice
      ? {
          priceCents: {
            ...(minPrice
              ? { gte: Math.round(Number(minPrice.replace(',', '.')) * 100) }
              : {}),
            ...(maxPrice
              ? { lte: Math.round(Number(maxPrice.replace(',', '.')) * 100) }
              : {}),
          },
        }
      : undefined;

  // Date range filter
  const dateFilter: Prisma.BudgetWhereInput | undefined =
    dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo
              ? { lte: new Date(dateTo + 'T23:59:59.999Z') }
              : {}),
          },
        }
      : undefined;

  // Has PDF filter
  const pdfFilter: Prisma.BudgetWhereInput | undefined = hasPdf
    ? { quotedPdfUrl: { not: null } }
    : undefined;

  // Base deleted filter + all the others
  const where: Prisma.BudgetWhereInput = {
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...(qFilter ?? {}),
    ...(statusFilter ?? {}),
    ...(priceFilter ?? {}),
    ...(dateFilter ?? {}),
    ...(pdfFilter ?? {}),
  };

  // Sorting
  let orderBy: any = undefined;

  if (sort === "price_desc") {
    orderBy = { priceCents: "desc" };
  } else if (sort === "price_asc") {
    orderBy = { priceCents: "asc" };
  } else if (sort === "createdAt_asc") {
    orderBy = { createdAt: "asc" };
  } else if (sort === "name_asc") {
    orderBy = { name: "asc" };
  } else if (sort === "name_desc") {
    orderBy = { name: "desc" };
  } else {
    orderBy = { createdAt: "desc" };
  }

  const items = await prisma.budget.findMany({
    where,
    orderBy,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      name: true,
      email: true,
      modelKey: true,
      deletedAt: true,
      sentAt: true,
      confirmedAt: true,
      quotedPdfUrl: true,
      invoicePdfUrl: true,
      priceCents: true,
      installPriceCents: true,
    },
  });
  if (sort === "price_desc") {
  items.sort((a, b) => {
    const pa = a.priceCents;
    const pb = b.priceCents;

    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;   // null LAST
    if (pb == null) return -1;  // null LAST

    return pb - pa; // highest first
  });
}

if (sort === "price_asc") {
  items.sort((a, b) => {
    const pa = a.priceCents;
    const pb = b.priceCents;

    if (pa == null && pb == null) return 0;
    if (pa == null) return 1;
    if (pb == null) return -1;

    return pa - pb; // lowest first
  });
}

  const nextCursor = items.length > take ? items[take].id : null;
  if (nextCursor) items.pop();

  return ok({ items, nextCursor });
}
function normalizeComplementos(raw: any): string | null {
  if (!raw) return null;

  const arr =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw.split(',')
        : [];

  const cleaned = arr
    .map(s => String(s).trim().toLowerCase())
    .filter(Boolean)
    .filter(c => c !== 'nenhum');

  return cleaned.length ? cleaned.join(',') : null;
}


export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = BudgetCreateSchema.safeParse(raw);
    if (!parsed.success) return bad(parsed.error.message, 422);

    const data = parsed.data;

  const { complementos, ...rest } = data;  // <-- strip invalid field

  const created = await prisma.budget.create({
    data: {
      ...rest,
      complemento: normalizeComplementos(complementos) ?? 'nenhum',
      photoUrls: data.photoUrls as any,
    },
  });
    // Fire-and-forget confirmation email to the requester (does not set sentAt)
    try {
      if (process.env.RESEND_API_KEY && created.email) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = await render(
          BudgetReceivedEmail({
            customerName: created.name || 'Cliente',
          })
        );
        const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        await resend.emails.send({
          from: `GOLDSTAR <${fromAddr}>`,
          to: created.email,
          subject: 'Recebemos o seu pedido de orçamento',
          html,
        });
      }
    } catch (e) {
      console.warn('BudgetReceived email failed:', e);
    }

    return ok({ id: created.id }, 201);
  } catch (e: any) {
    // TEMP: help debugging during dev
    console.error('POST /api/budgets failed:', e);
    return bad(e?.message ?? 'Erro ao criar orçamento', 500);
  }
}
