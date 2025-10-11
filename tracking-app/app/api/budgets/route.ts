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
  const take = Math.min(Number(searchParams.get('take') ?? 20), 100);
  const cursor = searchParams.get('cursor') ?? undefined; // id cursor
  const q = (searchParams.get('q') ?? '').trim();
  const includeDeleted = searchParams.get('includeDeleted') === '1';

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

  const where: Prisma.BudgetWhereInput = {
    ...(includeDeleted ? {} : { deletedAt: null }), // or { deletedAt: { equals: null } }
    ...(qFilter ?? {}),
  };

  const items = await prisma.budget.findMany({
  where,
  orderBy: { createdAt: 'desc' },
  take: take + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  select: {
    id: true,
    createdAt: true,
    name: true,
    email: true,
    modelKey: true,
    deletedAt: true,
    // NEW: states for the table
    sentAt: true,
    confirmedAt: true,
    // (optional but often shown)
    quotedPdfUrl: true,
    priceCents: true,
    installPriceCents: true,
  },
});

  const nextCursor = items.length > take ? items[take].id : null;
  if (nextCursor) items.pop();

  return ok({ items, nextCursor });
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = BudgetCreateSchema.safeParse(raw);
    if (!parsed.success) return bad(parsed.error.message, 422);

    const data = parsed.data;

    const created = await prisma.budget.create({
      data: {
        ...data,
        // keep JSONB cast if needed:
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
