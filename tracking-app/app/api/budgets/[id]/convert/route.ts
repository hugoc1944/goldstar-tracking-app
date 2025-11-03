// app/api/budgets/[id]/convert/route.ts
import React from 'react';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import { Prisma } from '@prisma/client';


export const runtime = 'nodejs';

async function performSendBudget(jobId: string) {
  // Claim job
  const job = await prisma.sendBudgetJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING' },
  });

  try {
    const { pdfUrl } = await sendBudgetAndEmail(job.budgetId);
    await prisma.sendBudgetJob.update({
      where: { id: jobId },
      data: { status: 'SUCCEEDED', pdfUrl },
    });
  } catch (e: any) {
    await prisma.sendBudgetJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', lastError: String(e?.message ?? e) },
    });
  }
}

async function sendBudgetAndEmail(
  budgetId: string
): Promise<{
  pdfUrl: string;
  orderId: string;
  publicToken: string;
  customerId: string;
  emailStatus: 'sent' | 'failed' | 'skipped';
}> {  // 🔽 Everything below is your current sync pipeline, but parameterized by "budgetId"
  // Load budget (must have email)
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) throw new Error('not found');
  if (!budget.email) throw new Error('missing customer email');

  // If you want to accept body-updates in async too, either pass them into this fn
  // or load the latest saved values. For now stick to saved values.

  // 4) Render PDF
  const { OrcamentoPDF } = await import('@/app/admin/orcamentos/OrcamentoPDF');
  const { pdf } = await import('@react-pdf/renderer');
  const element = (await import('react')).createElement(OrcamentoPDF as any, { b: budget }) as any;
  const buffer = await (pdf as any)(element).toBuffer();

  // 5) Upload to Blob
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('blob token missing');
  const key = `quotes/${budgetId}-${Date.now()}.pdf`;
  const blob = await (await import('@vercel/blob')).put(key, buffer as unknown as ArrayBuffer, { access: 'public', token });

  // 6) Save PDF url on Budget
  const saved = await prisma.budget.update({
    where: { id: budgetId },
    data: { quotedPdfUrl: blob.url },
  });

  // 8) Upsert Customer
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

  // 9) Create Order (+ delivery fields when available)
  const cryptoMod = await import('node:crypto');
  const publicToken = cryptoMod.randomBytes(24).toString('base64url');
  const baseOrderData: Prisma.OrderCreateArgs['data'] = {
    customer: { connect: { id: customer.id } },
    status: 'PREPARACAO',
    confirmedAt: null,
    eta: null,
    trackingNumber: null,
    publicToken,
    filesJson: Array.isArray(saved.photoUrls) ? (saved.photoUrls as any) : undefined,
  };

  let order: { id: string; publicToken: string };
  try {
    order = await prisma.order.create({
      data: {
        ...baseOrderData,
        deliveryType: saved.deliveryType ?? null,
        housingType:  saved.housingType  ?? null,
        floorNumber:  saved.floorNumber  ?? null,
        hasElevator:  saved.hasElevator  ?? null,
      } as any,
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
      throw new Error('Order creation failed: ' + msg);
    }
  }

  await prisma.budget.update({
    where: { id: saved.id },
    data: { convertedOrderId: order.id },
  });

  // 11) Email via Resend
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const { Resend } = await import('resend');
    const { render } = await import('@react-email/render');
    const { BudgetSentEmail } = await import('@/emails/BudgetSent');
    const resend = new Resend(resendKey);
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      'http://localhost:3000';

    const confirmUrl = `${base}/pedido/${order.publicToken}?confirm=1`;
    const backofficeUrl = `${base}/admin/orcamentos/${saved.id}`;
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
      await prisma.budget.update({ where: { id: saved.id }, data: { sentAt: new Date() } });
    }
  } else {
    console.warn('RESEND_API_KEY missing; skipping email send');
  }

  return {
    pdfUrl: blob.url,
    orderId: order.id,
    publicToken: order.publicToken,
    customerId: customer.id,
    emailStatus,
  };
}

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

  const budgetId = id;
  const prefer = req.headers.get('prefer') || '';
  const preferAsync = /respond-async/i.test(prefer) || req.headers.get('x-prefer-async') === '1';
  const idem = req.headers.get('x-idempotency-key') ?? null;

if (preferAsync) {
    // Idempotency: if a running/queued job for this budget or same key exists, return it
    const existing = await prisma.sendBudgetJob.findFirst({
      where: {
        OR: [
          { budgetId, status: { in: ['QUEUED', 'RUNNING'] } },
          ...(idem ? [{ idempotencyKey: idem }] : []),
        ],
      },
    });
    if (existing) {
      return NextResponse.json({ jobId: existing.id, status: existing.status }, { status: 202 });
    }

    // Enqueue new job
    const job = await prisma.sendBudgetJob.create({
      data: { budgetId, idempotencyKey: idem || null, status: 'QUEUED' },
    });

    // Fire and forget (Node runtime only)
    // Don’t await; return 202 immediately
    void performSendBudget(job.id);

    return NextResponse.json({ jobId: job.id, status: 'QUEUED' }, { status: 202 });
  }

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
// 2) Apply updates (if present) BEFORE generating/sending
if (updates) {
  const data: any = {};
  if (typeof updates.priceCents === 'number')        data.priceCents = updates.priceCents;
  if (typeof updates.installPriceCents === 'number') data.installPriceCents = updates.installPriceCents;
  if (typeof updates.notes === 'string')             data.notes = updates.notes;

  if (Object.keys(data).length) {
    await prisma.budget.update({ where: { id }, data });
  }
}

// 3) Run the same pipeline synchronously via the helper
try {
  const result = await sendBudgetAndEmail(id);
  return NextResponse.json({
    id,
    status: 'converted',
    pdf: result.pdfUrl,
    email: result.emailStatus,
    orderId: result.orderId,
    publicToken: result.publicToken,
    customerId: result.customerId,
  });
} catch (e: any) {
  return NextResponse.json({ error: e?.message ?? 'Falha na conversão/envio' }, { status: 500 });
}
}
