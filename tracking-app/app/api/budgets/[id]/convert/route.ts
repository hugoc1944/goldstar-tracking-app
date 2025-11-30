// app/api/budgets/[id]/convert/route.ts
import React from 'react';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/auth-helpers';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

async function performSendBudget(jobId: string) {
  const job = await prisma.sendBudgetJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING' }
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
  publicToken: string;
  customerId: string;
  emailStatus: 'sent' | 'failed' | 'skipped';
}> {
  // 1) load budget
  const budget = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!budget) throw new Error('not found');
  if (!budget.email) throw new Error('missing customer email');

  // 2) render PDF (react-pdf)
  const { OrcamentoPDF } = await import('@/app/admin/orcamentos/OrcamentoPDF');
  const { pdf } = await import('@react-pdf/renderer');
  const element = (await import('react')).createElement(OrcamentoPDF as any, { b: budget }) as any;
  const buffer = await (pdf as any)(element).toBuffer();

  // 3) upload to blob
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('blob token missing');
  const key = `quotes/${budgetId}-${Date.now()}.pdf`;
  const blob = await (await import('@vercel/blob')).put(key, buffer as unknown as ArrayBuffer, { access: 'public', token });

  // GUARANTEED return variables
  let pdfUrl: string = blob.url;
  let publicToken: string = '';
  let customerId: string = '';
  let emailStatus: 'sent' | 'failed' | 'skipped' = 'skipped';

  // 4) read saved budget (so we have photoUrls, invoicePdfUrl, etc)
  const saved = await prisma.budget.findUnique({ where: { id: budgetId } });
  if (!saved) throw new Error('budget not found after upload');

  // 5) build files array — ALWAYS MERGE WITH EXISTING filesJson
  type FileItem = { kind: string; label: string; url: string };

  // We will remove any *old invoice entries* so we never duplicate the invoice URL.
  const invoiceUrl = saved.invoicePdfUrl ?? null;

  // normalize existing filesJson, removing invoice duplicates
  // normalize existing filesJson, removing invoice duplicates AND old quotes
const existingFilesRaw = Array.isArray(saved.filesJson) ? saved.filesJson : [];
const existingFiles: FileItem[] = existingFilesRaw
  .map((f: any) => {
    if (!f || typeof f !== 'object' || typeof f.url !== 'string') return null;

    const kind = f.kind ?? 'unknown';
    const label = f.label ?? 'Anexo';
    const url = f.url as string;

    if (kind === 'quote' || label === 'Orçamento') return null;

    if (invoiceUrl && url === invoiceUrl) return null;

    return { kind, label, url };
  })
  .filter(Boolean) as FileItem[];
  // NEW QUOTE PDF
  const quoteFile: FileItem = {
    kind: 'quote',
    label: 'Orçamento',
    url: blob.url,
  };

  // Check if this exact blob already exists (same URL)


  // invoice (single canonical entry)
  const invoiceFile: FileItem | null = invoiceUrl
    ? { kind: 'invoice', label: 'Fatura', url: invoiceUrl }
    : null;

  // photos
  const photoFiles: FileItem[] = Array.isArray(saved.photoUrls)
    ? (saved.photoUrls as any[])
        .filter((u: any) => !!u)
        .map((u: any) => ({ kind: 'photo', label: 'Foto', url: String(u) }))
    : [];

  // FINAL MERGED FILE LIST (now guaranteed to have max 1 invoice)
  const files: FileItem[] = [
    ...existingFiles,
    quoteFile,
    ...(invoiceFile ? [invoiceFile] : []),
    ...photoFiles,
  ];

  // 6) upsert customer
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
  customerId = customer.id;

  // 7) publicToken handling + persist filesJson + quotedPdfUrl + sentAt
  // Try to keep DB token if present; otherwise generate and save.
  const existingToken = (saved as any).publicToken;
  if (existingToken) {
    publicToken = String(existingToken);
  } else {
    const cryptoMod = await import('node:crypto');
    publicToken = cryptoMod.randomBytes(24).toString('base64url');
  }

  // 7) persist merged filesJson + quotedPdfUrl + token + sentAt
  await prisma.budget.update({
    where: { id: saved.id },
    data: {
      quotedPdfUrl: blob.url,
      filesJson: files,     // FINAL merged list
      publicToken,
      sentAt: new Date(),
    },
  });

  // 8) build email html using BudgetSent template
  try {
    if (process.env.DISABLE_EMAIL_SENDING === '1') {
      emailStatus = 'skipped';
    } else {
      const renderMod = await import('@react-email/render');
      const render = (renderMod as any).render ?? (renderMod as any).default ?? renderMod;
      const templateMod = await import('@/emails/BudgetSent');
      const BudgetSentComponent =
        (templateMod as any).BudgetSent ??
        (templateMod as any).BudgetSentEmail ??
        (templateMod as any).default ??
        (templateMod as any);

      const base = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      const confirmUrl = `${base}/pedido/${publicToken}?confirm=1`;
      const backofficeUrl = `${base}/admin/orcamentos/${saved.id}`;

      const html = render(
        typeof BudgetSentComponent === 'function'
          ? BudgetSentComponent({
              customerName: saved.name ?? 'Cliente',
              confirmUrl,
              pdfUrl: blob.url,
              backofficeUrl,
            })
          : (BudgetSentComponent as any).default
          ? (BudgetSentComponent as any).default({
              customerName: saved.name ?? 'Cliente',
              confirmUrl,
              pdfUrl: blob.url,
              backofficeUrl,
            })
          : `<p>Olá ${saved.name ?? 'Cliente'}</p><p>O seu orçamento está pronto: <a href="${confirmUrl}">${confirmUrl}</a></p>`
      );

      // 9) build attachments (fetch from blob/uploaded urls)
      const attachments: { name: string; data: string }[] = [];
      // attach generated quote (fetch the blob to avoid runtime library mismatches)
      try {
        const r = await fetch(blob.url);
        if (r.ok) {
          const ab = await r.arrayBuffer();
          attachments.push({ name: `Orcamento-${saved.id}.pdf`, data: Buffer.from(new Uint8Array(ab)).toString('base64') });
        } else {
          console.warn('Failed to fetch generated PDF for attachments', r.status);
        }
      } catch (err) {
        console.warn('Could not fetch generated PDF for attachment', err);
      }

      // invoice
      if (saved.invoicePdfUrl) {
        try {
          const r = await fetch(saved.invoicePdfUrl);
          if (r.ok) {
            const ab = await r.arrayBuffer();
            attachments.push({ name: `Fatura-${saved.id}.pdf`, data: Buffer.from(new Uint8Array(ab)).toString('base64') });
          }
        } catch (err) {
          console.warn('Could not fetch invoice for attachment', err);
        }
      }

      // photos (optional)
      if (Array.isArray(saved.photoUrls)) {
        for (const [i, u] of (saved.photoUrls as string[]).entries()) {
          try {
            const r = await fetch(u);
            if (!r.ok) {
              console.warn('Failed fetch photo', u, r.status);
              continue;
            }
            const ab = await r.arrayBuffer();
            attachments.push({ name: `Foto-${i + 1}-${saved.id}.jpg`, data: Buffer.from(new Uint8Array(ab)).toString('base64') });
          } catch (err) {
            console.warn('Failed to fetch photo for attachment', u, err);
          }
        }
      }

      // 10) send with Resend
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY!);
      const fromAddr = process.env.EMAIL_FROM || 'no-reply@goldstar';
      const toAddr = String(saved.email || '').trim();
      const textFallback = `Olá ${saved.name ?? 'Cliente'},\n\nO seu orçamento está pronto. Confirme em: ${confirmUrl}\n\nPDF: ${blob.url}\n\nObrigado.`;

      const htmlResolved = String(await Promise.resolve(html));
      const resendAttachments = (attachments || []).map((a) => {
        // Optional: attempt to guess common content types by filename extension
        let type: string | undefined;
        if (a.name?.toLowerCase().endsWith('.pdf')) type = 'application/pdf';
        else if (a.name?.toLowerCase().endsWith('.jpg') || a.name?.toLowerCase().endsWith('.jpeg')) type = 'image/jpeg';
        else if (a.name?.toLowerCase().endsWith('.png')) type = 'image/png';

        // Resend requires either `content` (base64) or `path`.
        return {
          filename: a.name,        // filename expected by many email SDKs
          content: a.data,         // base64 string you already built
          // optional: type
          ...(type ? { type } : {}),
        } as any;
      });
      const sendResult = await resend.emails.send({
        from: `GOLDSTAR <${fromAddr}>`,
        to: toAddr,
        subject: 'Orçamento GOLDSTAR - confirme o seu orçamento',
        html: htmlResolved,
        text: textFallback,
        attachments: resendAttachments,
      });

      // normalize response id
      const messageId = (sendResult && (sendResult as any).id) || (sendResult && (sendResult as any).data && (sendResult as any).data.id) || (sendResult && (sendResult as any).messageId) || null;

      if (!messageId || typeof messageId !== 'string') {
        console.error('Resend did not return a valid message id', { sendResult });
        throw new Error('Resend did not return a message id');
      }

      emailStatus = 'sent';
      // persist a send job trace (optional)
      try {
        await prisma.sendBudgetJob.create({
          data: {
            budgetId: saved.id,
            status: 'SUCCEEDED',
            pdfUrl: blob.url,
            idempotencyKey: `resend_${messageId}_${Date.now()}`,
            lastError: null as any,
          } as any,
        });
      } catch (e) {
        console.warn('Could not persist sendBudgetJob record (non-fatal)', e);
      }
    } // end DISABLE_EMAIL_SENDING check
  } catch (err) {
    console.error('sendBudgetAndEmail — email send failed', err);
    emailStatus = 'failed';
  }

  // final return
  return {
    pdfUrl,
    publicToken,
    customerId,
    emailStatus,
  };
} // end sendBudgetAndEmail

// ---- convert route ----
const ConvertSchema = z.object({
  priceCents: z.number().int().nonnegative().optional(),
  installPriceCents: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

type Ctx = { params: { id: string } }; // or Promise<{id:string}>
export async function POST(req: Request, ctx: Ctx) {
  await requireAdminSession();
  const id = ctx.params.id;
  const budgetId = id;

  const url = new URL(req.url);
  const forceSync = url.searchParams.get('sync') === '1';

  const preferHeader = req.headers.get('prefer') || '';
  const preferAsyncHeader = /respond-async/i.test(preferHeader) || req.headers.get('x-prefer-async') === '1';
  const preferAsync = !forceSync && preferAsyncHeader;
  const idem = req.headers.get('x-idempotency-key') ?? null;

  if (preferAsync) {
    const existing = await prisma.sendBudgetJob.findFirst({
      where: {
        OR: [{ budgetId, status: { in: ['QUEUED', 'RUNNING'] } }, ...(idem ? [{ idempotencyKey: idem }] : [])],
      },
    });
    if (existing) return NextResponse.json({ jobId: existing.id, status: existing.status }, { status: 202 });

    const job = await prisma.sendBudgetJob.create({ data: { budgetId, idempotencyKey: idem || null, status: 'QUEUED' } });

    // fire-and-forget
    void performSendBudget(job.id);
    return NextResponse.json({ jobId: job.id, status: 'QUEUED' }, { status: 202 });
  }

  // accept optional updates
  let updates: z.infer<typeof ConvertSchema> | undefined;
  if (req.headers.get('content-type')?.includes('application/json')) {
    const raw = await req.json().catch(() => undefined);
    if (raw) {
      const parsed = ConvertSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 422 });
      updates = parsed.data;
    }
  }

  if (updates) {
    const data: any = {};
    if (typeof updates.priceCents === 'number') data.priceCents = updates.priceCents;
    if (typeof updates.installPriceCents === 'number') data.installPriceCents = updates.installPriceCents;
    if (typeof updates.notes === 'string') data.notes = updates.notes;

    if (Object.keys(data).length) {
      await prisma.budget.update({ where: { id }, data });
    }
  }

  try {
    const result = await sendBudgetAndEmail(id);
    if (result.emailStatus !== 'sent') {
      return NextResponse.json({ error: `Email status: ${result.emailStatus}`, pdf: result.pdfUrl, id }, { status: 502 });
    }

    return NextResponse.json({
      id,
      status: 'converted',
      pdf: result.pdfUrl,
      email: result.emailStatus,
      publicToken: result.publicToken,
      customerId: result.customerId,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Falha na conversão/envio' }, { status: 500 });
  }
}
