// app/api/budgets/[id]/route.ts
import { NextRequest,NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, bad } from '@/lib/http';
import { BudgetCreateSchema } from '@/lib/zod-budget';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';


const BudgetUpdateSchema = BudgetCreateSchema.partial().merge(
  z.object({
    priceCents:        z.number().int().nonnegative().optional(),
    installPriceCents: z.number().int().nonnegative().optional(),
    quotedPdfUrl:      z.string().url().optional(),
    notes:             z.string().optional(),
    deletedAt:         z.coerce.date().optional(),
  })
);

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdminSession();
  const b = await prisma.budget.findUnique({ where: { id: params.id } });
  if (!b) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(b);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await req.json();
  const parsed = BudgetUpdateSchema.safeParse(raw);
  if (!parsed.success) return bad(parsed.error.message, 422);
const data = parsed.data;

// --- FIX: strip complementos & generate complemento + complements ---
const { complementos, ...rest } = data;

const cleanComps = (complementos ?? [])
  .map((c: string) => String(c).trim().toLowerCase())
  .filter(Boolean)
  .filter(c => c !== 'nenhum');

const normalizedComplemento =
  cleanComps.length ? cleanComps.join(',') : 'nenhum';

const updated = await prisma.budget.update({
  where: { id },
  data: {
    ...rest,
    complemento: normalizedComplemento,   // ONLY this — canonical field
  }
});
  return ok(updated);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // method override for DELETE from admin table
  await requireAdminSession();
  const form = await req.formData().catch(() => null);
  const method = form?.get('_method');
  if (method === 'DELETE') {
    await prisma.budget.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.redirect(new URL('/admin/orcamentos', req.url));
  }
  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await requireAdminSession();
  const deleted = await prisma.budget.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });
  return NextResponse.json({ id: deleted.id, deletedAt: deleted.deletedAt });
}