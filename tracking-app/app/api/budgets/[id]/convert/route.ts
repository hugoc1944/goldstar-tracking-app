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

  // 7) Email via Resend (optional)
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const total = ((saved.priceCents ?? 0) + (saved.installPriceCents ?? 0)) / 100;
    const fromAddr = process.env.EMAIL_FROM || 'onboarding@resend.dev';

    const result = await resend.emails.send({
      from: `GOLDSTAR <${fromAddr}>`,
      to: saved.email,
      subject: 'Orçamento GOLDSTAR',
      text: [
        `Olá ${saved.name},`,
        ``,
        `Segue em anexo o seu orçamento.`,
        `Total: ${total.toFixed(2)} €`,
        ``,
        `Cumprimentos,`,
        `GOLDSTAR`,
      ].join('\n'),
      attachments: [{ filename: 'orcamento.pdf', path: blob.url }],
    });

    if (result?.error) {
      console.warn('Resend send error:', result.error);
      emailStatus = 'failed';
    } else {
      emailStatus = 'sent';
    }
  } else {
    console.warn('RESEND_API_KEY missing; skipping email send');
  }

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
  const customizations: Record<string, any> = {
    finish: saved.finishKey ?? null,
    acrylic: saved.acrylicKey ?? null,
    serigraphy: saved.serigrafiaKey ?? null,
    serigrafiaColor: saved.serigrafiaColor ?? null,
    glassTypeKey: saved.glassTypeKey ?? null,
    handleKey: saved.handleKey ?? null,
    fixingBarMode: saved.fixingBarMode ?? null,

    barColor: saved.complemento === 'vision' ? saved.barColor ?? null : null,
    visionSupport: saved.complemento === 'vision' ? saved.visionSupport ?? null : null,
    towelColorMode: saved.complemento === 'toalheiro1' ? saved.towelColorMode ?? null : null,
    shelfColorMode: saved.complemento === 'prateleira' ? saved.shelfColorMode ?? null : null,
  };

  const baseOrderData: Prisma.OrderCreateArgs['data'] = {
    customer: {
      connect: { id: customer.id },
    },
    status: 'PREPARACAO',
    eta: null,
    trackingNumber: null,
    publicToken,
    filesJson: Array.isArray(saved.photoUrls) ? (saved.photoUrls as any) : undefined,
    items: {
      create: [
        {
          description: 'Detalhes do produto',
          quantity: 1,
          model: saved.modelKey,
          complements: saved.complemento ?? 'nenhum',
          customizations,
        },
      ],
    },
  };

  // Delivery fields were recently added—try with them, fall back if schema doesn’t have them
  const withDelivery: any = {
    ...baseOrderData,
    deliveryType: saved.deliveryType ?? null,
    housingType:  saved.housingType ?? null,
    floorNumber:  saved.floorNumber ?? null,
    hasElevator:  saved.hasElevator ?? null,
  };

  let orderId: string | null = null;
  try {
    const order = await prisma.order.create({ data: withDelivery, select: { id: true } });
    orderId = order.id;
  } catch (e: any) {
    // If delivery fields aren’t in the schema, retry without them
    const msg = String(e?.message ?? '');
    const looksLikeUnknownArg =
      e instanceof Prisma.PrismaClientValidationError &&
      (msg.includes('Unknown arg `deliveryType`') ||
       msg.includes('Unknown arg `housingType`') ||
       msg.includes('Unknown arg `floorNumber`') ||
       msg.includes('Unknown arg `hasElevator`'));

    if (looksLikeUnknownArg) {
      const order = await prisma.order.create({ data: baseOrderData, select: { id: true } });
      orderId = order.id;
    } else {
      console.warn('Order creation failed:', e);
      // Surface as 500 so the UI knows Order wasn’t created
      return NextResponse.json({ error: 'Order creation failed', detail: msg }, { status: 500 });
    }
  }

  return NextResponse.json({
    id: saved.id,
    status: 'converted',
    pdf: blob.url,
    email: emailStatus,
    orderId,
    customerId: customer.id,
  });
}
