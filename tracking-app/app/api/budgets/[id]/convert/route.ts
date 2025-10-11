// app/api/budgets/[id]/convert/route.ts
import React from 'react';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { put } from '@vercel/blob';
import { Resend } from 'resend';
import { z } from 'zod';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { render } from '@react-email/render';
import { BudgetSentEmail } from '@/emails/BudgetSent';

export const runtime = 'nodejs';

const ConvertSchema = z.object({
  priceCents: z.number().int().nonnegative().optional(),
  installPriceCents: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

// 👇 Next 15 dynamic route params
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  await requireAdminSession();
  const { id } = await params;

  // 1) Optional updates from body (price/install/notes)
  let updates: z.infer<typeof ConvertSchema> | undefined;
  if (req.headers.get('content-type')?.includes('application/json')) {
    const raw = await req.json().catch(() => undefined);
    if (raw) {
      const parsed = ConvertSchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 422 });
      }
      updates = parsed.data;
    }
  }

  // 2) Load budget (must have email)
  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (!budget.email) return NextResponse.json({ error: 'missing customer email' }, { status: 400 });

  // 3) Apply updates before rendering PDF
  const bForPdf = updates
    ? await prisma.budget.update({
        where: { id },
        data: {
          priceCents: updates.priceCents ?? budget.priceCents,
          installPriceCents: updates.installPriceCents ?? budget.installPriceCents,
          notes: updates.notes ?? budget.notes,
        },
      })
    : budget;

  // 4) Render PDF (keep your component; cast element for @react-pdf)
  const { OrcamentoPDF } = await import('@/app/admin/orcamentos/OrcamentoPDF');
  const { pdf } = await import('@react-pdf/renderer');

  const element = React.createElement(
    OrcamentoPDF as React.ComponentType<{ b: any }>,
    { b: bForPdf }
  ) as unknown as React.ReactElement;

  const buffer = await (pdf as any)(element).toBuffer();

  // 5) Upload to Vercel Blob
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: 'blob token missing' }, { status: 500 });

  const key = `quotes/${id}-${Date.now()}.pdf`;
  const blob = await put(key, buffer as unknown as ArrayBuffer, { access: 'public', token });

  // 6) Persist PDF url
  const saved = await prisma.budget.update({
    where: { id },
    data: { quotedPdfUrl: blob.url },
  });

 

  // 8) Upsert Customer (by email)
  const customer = await prisma.customer.upsert({
    where: { email: saved.email },
    update: {
      name: saved.name,
      phone: saved.phone ?? null,
      nif: saved.nif ?? null,
      address: saved.address ?? null,
      postal: saved.postalCode ?? null,
      city: saved.city ?? null,
    },
    create: {
      name: saved.name,
      email: saved.email,
      phone: saved.phone ?? null,
      nif: saved.nif ?? null,
      address: saved.address ?? null,
      postal: saved.postalCode ?? null,
      city: saved.city ?? null,
    },
  });

  // 9) Create Order (+ synthetic “Detalhes do produto” item)
  const publicToken = crypto.randomBytes(24).toString('base64url');

  // Pack customizations the way your Orders UI reads them
  // 9) Create a MINIMAL pending Order (no createdFromBudgetId here)
const baseOrderData: Prisma.OrderCreateArgs['data'] = {
  customer: { connect: { id: customer.id } },
  status: 'PREPARACAO',     // it will only become visible after confirm if your admin lists filter by confirmedAt
  confirmedAt: null,        // explicitly pending
  eta: null,
  trackingNumber: null,
  publicToken,
  filesJson: Array.isArray(saved.photoUrls) ? (saved.photoUrls as any) : undefined,
  // NOTE: intentionally NOT creating items here; add later if you want after confirm
};

// Try with delivery fields (if they exist in your schema); fallback if not
const withDelivery: any = {
  ...baseOrderData,
  deliveryType: saved.deliveryType ?? null,
  housingType:  saved.housingType  ?? null,
  floorNumber:  saved.floorNumber  ?? null,
  hasElevator:  saved.hasElevator  ?? null,
};

let order: { id: string; publicToken: string };
try {
  order = await prisma.order.create({
    data: withDelivery,
    select: { id: true, publicToken: true },
  });
} catch (e: any) {
  const msg = String(e?.message ?? '');
  const looksLikeUnknownArg =
    e instanceof Prisma.PrismaClientValidationError &&
    (msg.includes('Unknown arg `deliveryType`') ||
     msg.includes('Unknown arg `housingType`') ||
     msg.includes('Unknown arg `floorNumber`') ||
     msg.includes('Unknown arg `hasElevator`'));

  if (looksLikeUnknownArg) {
    order = await prisma.order.create({
      data: baseOrderData,
      select: { id: true, publicToken: true },
    });
  } else {
    console.warn('Order creation failed:', e);
    return NextResponse.json({ error: 'Order creation failed', detail: msg }, { status: 500 });
  }
}
// 10) Link Budget → Order (1–1) using convertedOrderId on Budget
await prisma.budget.update({
  where: { id: saved.id },
  data: { convertedOrderId: order.id },
});

// 11) Email via Resend — with "Confirmo o Orçamento" CTA (AFTER order exists)
let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
const resendKey = process.env.RESEND_API_KEY;
if (resendKey) {
  const resend = new Resend(resendKey);
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000';

  const confirmUrl = `${base}/pedido/${order.publicToken}?confirm=1`;
  const backofficeUrl = `${base}/admin/orcamentos/${saved.id}`;

  // NOTE: await render(...) to satisfy the "Promise<string>" type
  const html = await render(
    BudgetSentEmail({
      customerName: saved.name ?? 'Cliente',
      confirmUrl,
      pdfUrl: blob.url,
      backofficeUrl,
    })
  );

  const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const result = await resend.emails.send({
    from: `GOLDSTAR <${fromAddr}>`,
    to: saved.email,
    subject: 'Orçamento GOLDSTAR',
    html,
    attachments: [{ filename: 'orcamento.pdf', path: blob.url }],
  });

  if (result?.error) {
    console.warn('Resend send error:', result.error);
    emailStatus = 'failed';
  } else {
    emailStatus = 'sent';
  }

  // Mark as sent
  await prisma.budget.update({
    where: { id: saved.id },
    data: { sentAt: new Date() },
  });
} else {
  console.warn('RESEND_API_KEY missing; skipping email send');
}

  return NextResponse.json({
  id: saved.id,
  status: 'converted',
  pdf: blob.url,
  email: emailStatus,
  orderId: order.id,
  publicToken: order.publicToken,
  customerId: customer.id,
});
}
