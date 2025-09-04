// app/api/clients/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
// If you want to hard-gate this to admins, uncomment the next line:
// import { requireAdminSession } from '@/lib/auth-helpers';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // await requireAdminSession(); // optional but recommended in admin-only routes

  const c = await prisma.customer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      nif: true,
      address: true,
      postal: true,
      city: true,
    },
  });

  if (!c) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
  return NextResponse.json(c);
}
