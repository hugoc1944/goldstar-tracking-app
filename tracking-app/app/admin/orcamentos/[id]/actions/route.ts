// app/admin/orcamentos/[id]/actions/route.ts
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminSession();

  const origin = new URL(req.url).origin; // absolute base for internal fetches
  const form = await req.formData();
  const action = String(form.get('action') ?? 'save');

  // small helper: "12,34" → 1234 cents
  const toCents = (v: FormDataEntryValue | null | undefined) => {
    if (v == null || v === '') return undefined;
    const n = Number(String(v).replace(',', '.'));
    if (Number.isNaN(n)) return undefined;
    return Math.round(n * 100);
  };

  // Soft delete / restore shortcuts (no price payload needed)
  if (action === 'delete') {
    await prisma.budget.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.redirect(`${origin}/admin/orcamentos`, { status: 303 });
  }
  if (action === 'restore') {
    await prisma.budget.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.redirect(`${origin}/admin/orcamentos`, { status: 303 });
  }

  // Save price/notes (no-op if fields are missing)
  const patchPayload = {
    priceCents: toCents(form.get('priceCents')),
    installPriceCents: toCents(form.get('installPriceCents')),
    notes: (form.get('notes') as string) || undefined,
  };

  await fetch(`${origin}/api/budgets/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patchPayload),
  });

  // Convert + email + order?
  if (action === 'send') {
    const res = await fetch(`${origin}/api/budgets/${id}/convert`, { method: 'POST' });
    if (!res.ok) {
      const txt = await res.text();
      return new NextResponse(`Falha ao enviar orçamento: ${txt}`, { status: 500 });
    }
  }

  return NextResponse.redirect(`${origin}/admin/orcamentos/${id}`, { status: 303 });
}
