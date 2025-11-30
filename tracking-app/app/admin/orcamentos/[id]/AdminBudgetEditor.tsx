'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';

/* ---------------- Schema (admin version) ---------------- */
/* --- Loader (Goldstar) --- */
function GsSpinner({ size = 16, stroke = 2, className = '' }: { size?: number; stroke?: number; className?: string }) {
  const s = { width: size, height: size, borderWidth: stroke } as React.CSSProperties;
  return (
    <span
      className={[
        "inline-block animate-spin rounded-full border-neutral-300 border-t-[#FFD200]",
        className,
      ].join(' ')}
      style={s}
      aria-hidden
    />
  );
}
const NumOpt = z.preprocess(
  (v) => {
    if (v === '' || v == null) return undefined;
    if (typeof v === 'string') return Number(v.replace(',', '.'));
    return v;
  },
  z.number().positive().optional()
);
function parseEuro(s: string) {
  if (!s) return 0;
  const n = globalThis.Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const bonusNiceLabel = (v?: string) =>
  v === 'gelGOLDSTAR' ? 'Gel de Banho GOLDSTAR' : 'Shampoo GOLDSTAR';

// Only admin: no “willSendLater” checkbox here. Width/height optional but numeric when present.
export const AdminBudgetSchema = z.object({
  // cliente
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  nif: z.string().optional(),
  address: z.string().min(1),
  postalCode: z.string().min(1),
  city: z.string().min(1),

  // escolhas
  modelKey: z.string().min(1),
  handleKey: z.string().optional(),
  finishKey: z.string().min(1),

  barColor: z.string().optional(),
  visionSupport: z.string().optional(),

  glassTypeKey: z.string().min(1),
  acrylicKey: z.string().optional(),
  serigrafiaKey: z.string().optional(),
  serigrafiaColor: z.string().optional(),

  fixingBarMode: z.enum(['padrao','acabamento']).optional(),

  // ✅ NEW canonical field
  complementos: z.array(z.string()).default([]),

  towelColorMode: z.enum(['padrao','acabamento']).optional(),
  shelfColorMode: z.enum(['padrao','acabamento']).optional(),
  shelfHeightPct: z
    .union([z.number().int(), z.string().transform(v => parseInt(v, 10))])
    .optional(),

  cornerChoice: z.string().optional(),
  cornerColorMode: z.string().optional(),

  // medidas (form em CM)
  widthMm: NumOpt,
  heightMm: NumOpt,
  depthMm: NumOpt,

  // logística
  deliveryType: z.string().min(1),
  housingType: z.string().optional(),
  floorNumber: z.preprocess(
    (v) => (v === '' || v == null ? undefined : typeof v === 'string' ? parseInt(v, 10) : v),
    z.number().int().optional()
  ),
  hasElevator: z.boolean().optional(),

  photoUrls: z.array(z.string().url()).optional(),
  notes: z.string().optional(),
}).superRefine((val, ctx) => {
  const comps = val.complementos ?? [];

  if (comps.includes('vision')) {
    if (!val.barColor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['barColor'] });
    }
    if (!val.visionSupport) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['visionSupport'] });
    }
  }

  if (comps.includes('toalheiro1')) {
    if (!val.towelColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Toalheiro.', path: ['towelColorMode'] });
    }
  }

  if (comps.includes('prateleira')) {
    if (!val.shelfColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Prateleira.', path: ['shelfColorMode'] });
    }
  }
  // Serigrafia → color required & cannot be Anodizado/Cromado
  if (val.serigrafiaKey && val.serigrafiaKey !== 'nenhum') {
    const c = (val.serigrafiaColor ?? '').trim().toLowerCase();
    if (!c) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Escolha a cor da serigrafia.',
        path: ['serigrafiaColor'],
      });
    } else if (c === 'anodizado' || c === 'cromado') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cor indisponível para serigrafia.',
        path: ['serigrafiaColor'],
      });
    }
  }
});
type FormValues = z.infer<typeof AdminBudgetSchema>;
type RHFResolver = Resolver<FormValues, any, FormValues>;


const parseComps = (raw?: string | null) =>
  (raw ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
    .filter(c => c !== 'nenhum');

/* ---------------- Types from /api/catalog ---------------- */
type CatItem = { value: string; label: string; order?: number };
type Catalog = Record<string, CatItem[]>;

type ModelRuleDTO = {
  hideHandles?: boolean;
  removeFinishes?: string[];
  allowAcrylicAndPoly?: boolean;
  allowTowel1?: boolean;
  hasFixingBar?: boolean;
};

// - euros helpers (comma or dot)
function euroToCents(s: string | undefined | null) {
  if (!s) return undefined;
  const n = Number(String(s).replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}
function centsToEuro(c?: number | null) {
  if (c == null) return '';
  return (c / 100).toFixed(2).replace('.', ',');
}
function normalizeForPatch(values: any) {
  // turn "" → undefined for optional/nullable columns
  const out: any = { ...values };
  const emptyToUndef = (k: string) => { if (out[k] === '') out[k] = undefined; };

  [
    'phone','nif','handleKey','barColor','visionSupport',
    'acrylicKey','serigrafiaKey','serigrafiaColor',
    'fixingBarMode','towelColorMode','shelfColorMode',
    'cornerChoice','cornerColorMode','housingType','notes'
  ].forEach(emptyToUndef);
 // ✅ complementos → complements (legacy string) + complemento fallback
  const cleanComps = (out.complementos ?? [])
    .map((c: string) => String(c).trim().toLowerCase())
    .filter(Boolean)
    .filter((c: string) => c !== 'nenhum');

  out.complementos = cleanComps;
  out.complements = cleanComps.length ? cleanComps.join(',') : null;
  out.complemento = cleanComps.length ? cleanComps.join(',') : 'nenhum';
  return out;
}
/* ---------------- Editor ---------------- */

export default function AdminBudgetEditor({ budget }: { budget: any }) {

  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(AdminBudgetSchema) as RHFResolver,
    defaultValues: {
      // map current budget → form
      name: budget.name,
      email: budget.email,
      phone: budget.phone ?? '',
      nif: budget.nif ?? '',
      address: budget.address,
      postalCode: budget.postalCode,
      city: budget.city,

      modelKey: budget.modelKey,
      handleKey: budget.handleKey ?? undefined,
      finishKey: budget.finishKey,

      barColor: budget.barColor ?? undefined,
      visionSupport: budget.visionSupport ?? undefined,

      glassTypeKey: budget.glassTypeKey,
      acrylicKey: budget.acrylicKey ?? 'nenhum',
      serigrafiaKey: budget.serigrafiaKey ?? 'nenhum',
      serigrafiaColor: budget.serigrafiaColor ?? undefined,

      fixingBarMode: budget.fixingBarMode ?? undefined,
      complementos: parseComps(
        (budget as any).complements ??   // legacy string
        (budget as any).complemento      // legacy single
      ),
      towelColorMode: budget.towelColorMode ?? undefined,
      shelfColorMode: budget.shelfColorMode ?? undefined,

      cornerChoice: budget.cornerChoice ?? undefined,
      cornerColorMode: budget.cornerColorMode ?? undefined,
      shelfHeightPct: budget.shelfHeightPct ?? 100,

      widthMm:  budget.widthMm  != null ? budget.widthMm  / 10 : undefined,
      heightMm: budget.heightMm != null ? budget.heightMm / 10 : undefined,
      depthMm:  budget.depthMm  != null ? budget.depthMm  / 10 : undefined,

      deliveryType: budget.deliveryType || 'entrega',
      housingType: budget.housingType ?? undefined,
      floorNumber: budget.floorNumber ?? undefined,
      hasElevator: budget.hasElevator ?? undefined,

      photoUrls: Array.isArray(budget.photoUrls) ? budget.photoUrls : [],
      notes: budget.notes ?? '',
    },
  });

  

  // local pricing in € (editable)
  const [priceEuro, setPriceEuro] = React.useState<string>(centsToEuro(budget.priceCents));
  const [installEuro, setInstallEuro] = React.useState<string>(centsToEuro(budget.installPriceCents));
  const totalEuro = parseEuro(priceEuro) + parseEuro(installEuro);

  // Catalog + rule (same as public page)
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [rule, setRule] = React.useState<ModelRuleDTO | null>(null);

  const [sending, setSending] = React.useState(false);
  const [bgJob, setBgJob] = React.useState<{ id: string; status: 'queued'|'running'|'succeeded'|'failed'; pdf?: string } | null>(null);
  const idempKeyRef = React.useRef((globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()));


const [invoiceUploading, setInvoiceUploading] = React.useState(false);
const [invoiceUrl, setInvoiceUrl] = React.useState<string | null>(budget.invoicePdfUrl ?? null);

async function uploadInvoice(f: File) {
  setInvoiceUploading(true);
  try {
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch(`/api/budgets/${budget.id}/invoice`, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setInvoiceUrl(data.invoicePdfUrl ?? null);
  } catch (e: any) {
    alert('Falha ao anexar fatura: ' + (e?.message ?? e));
  } finally {
    setInvoiceUploading(false);
  }
}
async function removeInvoice() {
  if (!confirm('Remover fatura anexada?')) return;
  const res = await fetch(`/api/budgets/${budget.id}/invoice`, { method: 'DELETE' });
  if (res.ok) setInvoiceUrl(null);
  else alert('Não foi possível remover.');
}

  React.useEffect(() => {
    (async () => {
      const res = await fetch('/api/catalog', { cache: 'no-store' });
      const data = await res.json();
      setCatalog(data as Catalog);
    })();
  }, []);

  const modelKey = form.watch('modelKey');
  // --- TURBO enforced defaults ---
  React.useEffect(() => {
    if (!isTurboModelKey(modelKey)) return;

    // Auto-default Acrylic ONLY IF empty
    if (!form.getValues('acrylicKey') || form.getValues('acrylicKey') === 'nenhum') {
      form.setValue('acrylicKey', 'acrilico_agua_viva', { shouldDirty: true });
    }

    // Always-clear disallowed Turbo fields
    form.setValue('glassTypeKey', 'nenhum', { shouldDirty: true });
    form.setValue('fixingBarMode', undefined, { shouldDirty: true });

    // Complements
    form.setValue('complementos', [], { shouldDirty: true });

    // Additional dependent clears
    form.setValue('barColor', undefined, { shouldDirty: true });
    form.setValue('visionSupport', undefined, { shouldDirty: true });
    form.setValue('towelColorMode', undefined, { shouldDirty: true });
    form.setValue('shelfColorMode', undefined, { shouldDirty: true });
    form.setValue('shelfHeightPct', undefined, { shouldDirty: true });
  }, [modelKey]);

  React.useEffect(() => {
    if (!modelKey) return;
    (async () => {
      const res = await fetch(`/api/model-rules/${encodeURIComponent(modelKey)}`, { cache: 'no-store' });
      if (res.ok) setRule((await res.json()) as ModelRuleDTO);
      else setRule(null);
    })();
  }, [modelKey]);
  

  // Conditional clears (Vision / Towel / Shelf)
  const comps = form.watch('complementos') ?? [];
  const hasVision = comps.includes('vision');
  const hasTowel1 = comps.includes('toalheiro1');
  const hasShelf  = comps.includes('prateleira');

  const shelfHeightPct = form.watch('shelfHeightPct') ?? 100;

  React.useEffect(() => {
    if (!hasVision) {
      form.setValue('barColor', undefined, { shouldDirty:true });
      form.setValue('visionSupport', undefined, { shouldDirty:true });
    }
    if (!hasTowel1) {
      form.setValue('towelColorMode', undefined, { shouldDirty:true });
    }
    if (!hasShelf) {
      form.setValue('shelfColorMode', undefined, { shouldDirty:true });
      form.setValue('shelfHeightPct', undefined, { shouldDirty:true });
    } else {
      if (form.getValues('shelfHeightPct') == null) {
        form.setValue('shelfHeightPct', 100, { shouldDirty:true });
      }
    }
  }, [hasVision, hasTowel1, hasShelf]);

  const selSer = form.watch('serigrafiaKey');
  React.useEffect(() => {
    if (!selSer || selSer === 'nenhum') {
      form.setValue('serigrafiaColor', undefined, { shouldDirty:true });
    }
  }, [selSer]);



  // Helpers reusing catalog
  const glassTipos = React.useMemo(() => catalog?.['GLASS_TIPO'] ?? [], [catalog]);
  const monos = React.useMemo(() => catalog?.['MONOCROMATICO'] ?? [], [catalog]);
  const complementoOpts = React.useMemo(() => catalog?.['COMPLEMENTO'] ?? [], [catalog]);
  const barColors = React.useMemo(() => catalog?.['VISION_BAR_COLOR'] ?? [], [catalog]);
  const serPrime = React.useMemo(() => catalog?.['SERIGRAFIA_PRIME'] ?? [], [catalog]);
  const serQuadros = React.useMemo(() => catalog?.['SERIGRAFIA_QUADROS'] ?? [], [catalog]);
  const serElo = React.useMemo(() => catalog?.['SERIGRAFIA_ELO_SERENO'] ?? [], [catalog]);
  const serigrafias: CatItem[] = React.useMemo(
    () => uniqByValue([...(serPrime ?? []), ...(serQuadros ?? []), ...(serElo ?? [])]),
    [serPrime, serQuadros, serElo]
  );

  const finishes = React.useMemo(() => {
    if (!catalog) return [];
    const all = [...(catalog['FINISH_METALICO'] ?? []), ...(catalog['FINISH_LACADO'] ?? [])];
    if (!rule?.removeFinishes?.length) return all;
    const rm = new Set(rule.removeFinishes.map(v => v.toLowerCase()));
    return all.filter(f => !rm.has(f.value.toLowerCase()));
  }, [catalog, rule]);


// after finishes const
const finishesNoChromeAnod = React.useMemo(
  () =>
    finishes.filter(f => {
      const v = f.value.toLowerCase();
      return v !== 'cromado' && v !== 'anodizado';
    }),
  [finishes]
);

// Serigrafia color choices: "padrao" + all non-metal finishes
const serigrafiaColorChoices = React.useMemo(
  () => [
    { value: 'padrao', label: 'Padrão' },
    ...finishesNoChromeAnod.map(f => ({ value: f.value, label: f.label })),
  ],
  [finishesNoChromeAnod]
);

// Optional icon helper; mirror public behaviour
function getSerigrafiaColorIcon(opt: { value: string; label: string }) {
  if (opt.value === 'padrao') {
    // same icon idea as public: Fosco.png
    return `${PRE}/glass/vidros/Fosco.png`;
  }
  return finishIconSrc(opt.value) ?? '';
}

  function isPainelV234(key?: string) {
    if (!key) return false;
    return /painel[_-]?v(2|3|4)\b/i.test(key.toLowerCase());
  }
  // Canonical normalization (copied from Orders Modal)
  function canon(input: string) {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .trim();
  }

  const TURBO_MODEL_KEY = 'turbo_v1';
  function isTurboModelKey(key?: string | null) {
    if (!key) return false;
    return canon(key) === TURBO_MODEL_KEY;
  }

  const handles = React.useMemo(() => {
    if (!catalog) return [];
    const list = [...(catalog['HANDLE'] ?? [])].filter(h => h.value !== '-' && h.value !== '');
    if (!isPainelV234(modelKey)) {
      return list.filter(h => h.value !== 'sem');
    }
    return list;
  }, [catalog, modelKey]);

  const hideHandles = !!rule?.hideHandles;
  const allowAcrylic = !!rule?.allowAcrylicAndPoly;
  const allowTowel1 = !!rule?.allowTowel1;
  const complementoFiltered = React.useMemo(() => {
    const base = (catalog?.['COMPLEMENTO'] ?? []) as CatItem[];
    return allowTowel1 ? base.filter(o => o.value !== 'nenhum') 
                      : base.filter(o => o.value !== 'nenhum' && o.value !== 'toalheiro1');
  }, [catalog, allowTowel1]);
  /* ---------------- Actions ---------------- */

// acrylic clears glass
React.useEffect(() => {
  const acrylic = form.watch('acrylicKey');
  if (acrylic && acrylic !== 'nenhum') {
    form.setValue('glassTypeKey', 'nenhum', { shouldDirty: true });
  }
}, [form.watch('acrylicKey')]);
// glass clears acrylic (except Turbo which auto-locks acrylic)
React.useEffect(() => {
  const glass = form.watch('glassTypeKey');
  if (!isTurboModelKey(modelKey) && glass && glass !== 'nenhum') {
    form.setValue('acrylicKey', 'nenhum', { shouldDirty: true });
  }
}, [form.watch('glassTypeKey'), modelKey]);

const saveAll: SubmitHandler<FormValues> = async (values) => {
  const toMm = (cm?: number) => (cm == null ? undefined : Math.round(cm * 10));

  const payload = normalizeForPatch({
    ...values,
    priceCents: toCents(priceEuro),
    installPriceCents: toCents(installEuro),
    notes: values.notes ?? undefined,
    widthMm:  toMm(values.widthMm),
    heightMm: toMm(values.heightMm),
    depthMm:  toMm(values.depthMm),
  });

  const res = await fetch(`/api/budgets/${budget.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    alert(err?.error ?? 'Falha ao guardar');
    return;
  }
  alert('Guardado.');
};

  const convertAndSend = async () => {
    // push prices first to ensure PDF has correct totals
    const put = await fetch(`/api/budgets/${budget.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        priceCents: toCents(priceEuro),
        installPriceCents: toCents(installEuro),
        notes: form.getValues('notes') || undefined,
      }),
    });
    if (!put.ok) {
      const e = await put.text();
      alert('Falha a guardar preços: ' + e);
      return;
    }

    const res = await fetch(`/api/budgets/${budget.id}/convert`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data?.error ?? 'Falha ao enviar orçamento');
      return;
    }
    alert(`Enviado. PDF: ${data.pdf ?? '-'}`);
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);

  // --- VALIDATION (same as you had) ---
  const priceCents = (s: string) => {
    const n = Number(String(s || '0').replace(',', '.'));
    return Math.round((Number.isFinite(n) ? n : 0) * 100);
  };
  const pCents = priceCents(priceEuro);
  const wCm = Number(form.getValues('widthMm') ?? 0);
  const hCm = Number(form.getValues('heightMm') ?? 0);
  if (!pCents || pCents <= 0) { alert('Preço é obrigatório.'); setSending(false); return; }
  if (!wCm || wCm <= 0)       { alert('Largura é obrigatória.'); setSending(false); return; }
  if (!hCm || hCm <= 0)       { alert('Altura é obrigatória.');  setSending(false); return; }

  // --- persist once (remove your duplicate PATCH) ---
  const toMm = (cm?: number) => (cm == null ? undefined : Math.round(cm * 10));
  const payload = normalizeForPatch({
  ...form.getValues(),
  priceCents: pCents,
  installPriceCents: priceCents(installEuro),
  widthMm:  toMm(form.getValues('widthMm')),
  heightMm: toMm(form.getValues('heightMm')),
  depthMm:  toMm(form.getValues('depthMm')),
  notes: form.getValues('notes') || undefined,
});

  try {
    const patchRes = await fetch(`/api/budgets/${budget.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!patchRes.ok) {
      const e = await patchRes.text();
      throw new Error('Falha ao guardar alterações: ' + e);
    }

    // --- start convert/send (prefer async) ---
    // --- start convert/send (force SYNC + strict checks) ---
    const convRes = await fetch(`/api/budgets/${budget.id}/convert?sync=1`, {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempKeyRef.current },
    });

    const data = await convRes.json().catch(() => ({} as any));

    // If server still replied async (shouldn’t after we add sync handling below)
    if (convRes.status === 202) {
      throw new Error('Servidor colocou envio em background; desative o modo assíncrono.');
    }

    if (!convRes.ok) {
      throw new Error(data?.error || `Falha no envio (HTTP ${convRes.status})`);
    }

    // Our API returns { email: 'sent' | 'failed' | 'skipped' }
    if (data?.email !== 'sent') {
      throw new Error(`Email não foi enviado (estado: ${data?.email ?? 'desconhecido'})`);
    }

    alert('Sucesso!');
    router.replace('/admin/orcamentos');
  } catch (err: any) {
    alert(err?.message ?? 'Falha ao enviar orçamento');
  } finally {
    setSending(false);
  }
};
const isJobBusy = bgJob?.status === 'queued' || bgJob?.status === 'running';


  /* ---------------- UI ---------------- */


  
  return (
    <div className="space-y-8">
      {/* TWO COLUMNS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Cliente */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Cliente</h2>
          <Text f={form} name="name" label="Nome *" />
          <Text f={form} name="email" label="Email *" type="email" />
          <Text f={form} name="phone" label="Telefone" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Text f={form} name="nif" label="NIF" />
            <Text f={form} name="postalCode" label="Código Postal *" />
            <Text f={form} name="city" label="Cidade *" />
          </div>
          <Text f={form} name="address" label="Morada *" />

        </section>

        {/* Right: Modelo & Customização (mirrors public form) */}
        <section className="space-y-3">
        <h2 className="text-lg font-medium">Modelo & Opções</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Modelo */}
        <FieldWrap label="Modelo *">
          <Controller
            name="modelKey"
            control={form.control}
            render={({ field }) => (
              <IconSelect
                value={field.value}
                onChange={field.onChange}
                options={(catalog?.MODEL ?? []) as IconOption[]}
                getIcon={(opt) => modelIconSrc(opt.value)}
                placeholder="Escolher modelo"
                iconSize={32}
                itemIconSize={44}
              />
            )}
          />
        </FieldWrap>

        {/* Puxador */}
        {!hideHandles && (
          <FieldWrap label="Puxador">
            <Controller
              name="handleKey"
              control={form.control}
              render={({ field }) => (
                <IconSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={handles as IconOption[]}
                  getIcon={(opt) => handleIconSrc(opt.value)}
                  placeholder="Escolher puxador"
                  iconSize={32}
                  itemIconSize={44}
                />
              )}
            />
          </FieldWrap>
        )}

        {/* Acabamento */}
        <FieldWrap label="Acabamento *">
          <Controller
            name="finishKey"
            control={form.control}
            render={({ field }) => (
              <IconSelect
                value={field.value}
                onChange={field.onChange}
                options={finishes as IconOption[]}
                getIcon={(opt) => finishIconSrc(opt.value) ?? ''}
                placeholder="Escolher acabamento"
                iconSize={32}
                itemIconSize={44}
              />
            )}
          />
        </FieldWrap>

        {/* Barra de fixação, se aplicável */}
        {rule?.hasFixingBar && (
          <FieldWrap label="Barra de fixação *">
            <select
              {...form.register('fixingBarMode')}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD200]"
            >
              <option value="padrao">Padrão</option>
              <option value="acabamento">Cor do acabamento</option>
            </select>
          </FieldWrap>
        )}

        {/* Vidro / Monocromático */}
        {!isTurboModelKey(modelKey) && (
          <FieldWrap label="Vidro / Monocromático *">
            <Controller
              name="glassTypeKey"
              control={form.control}
              render={({ field }) => (
                <IconSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    ...(glassTipos ?? []),
                    ...(monos ?? []),
                  ] as IconOption[]}
                  getIcon={(opt) => glassIconSrcFromLabel(opt.label)}
                  placeholder="Escolher vidro / monocromático"
                  iconSize={32}
                  itemIconSize={44}
                />
              )}
            />
          </FieldWrap>
        )}

        {/* Acrílico / Policarbonato – dropdown SEM restrição para Turbo */}
        {/* Acrílico / Policarbonato – dropdown WITH Turbo restriction */}
        {allowAcrylic && (
          <FieldWrap label="Acrílico / Policarbonato">
            <Controller
              name="acrylicKey"
              control={form.control}
              render={({ field }) => (
                <IconSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={
                    isTurboModelKey(modelKey)
                      ? [
                          {
                            value: 'acrilico_agua_viva',
                            label: 'Acrílico Água Viva',
                          },
                        ]
                      : (catalog?.ACRYLIC_AND_POLICARBONATE ?? []) as IconOption[]
                  }
                  getIcon={(opt) =>
                    opt.value === 'nenhum'
                      ? undefined
                      : acrylicIconSrcFromLabel(opt.label)
                  }
                  placeholder="Sem acrílico"
                  iconSize={32}
                  itemIconSize={44}
                />
              )}
            />
          </FieldWrap>
        )}

        {/* Complementos / Vision / Toalheiro / Prateleira */}
        <div className="md:col-span-2">
          <FieldWrap label="Complementos">
            <Controller
              name="complementos"
              control={form.control}
              render={({ field }) => (
                <ComplementoSelector
                  value={field.value ?? []}
                  onChange={field.onChange}
                  options={(complementoFiltered ?? []).map((c) => ({
                    value: c.value,
                    label: c.label,
                  }))}
                />
              )}
            />
          </FieldWrap>
        </div>

        {hasVision && (
          <>
            <FieldWrap label="Cor da Barra Vision *">
              <Controller
                name="barColor"
                control={form.control}
                render={({ field }) => (
                  <IconSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={(catalog?.VISION_BAR_COLOR ?? []) as IconOption[]}
                    getIcon={(opt) => visionBarIconSrc(opt.value)}
                    placeholder="Escolher cor da barra"
                    iconSize={32}
                    itemIconSize={44}
                  />
                )}
              />
            </FieldWrap>
            <FieldWrap label="Cor de Suporte *">
              <Controller
                name="visionSupport"
                control={form.control}
                render={({ field }) => (
                  <IconSelect
                    value={field.value}
                    onChange={field.onChange}
                    options={
                      (finishes ?? []).map((f) => ({
                        value: f.value,
                        label: f.label,
                      })) as IconOption[]
                    }
                    getIcon={(opt) => finishIconSrc(opt.value) ?? ''}
                    placeholder="Escolher cor do suporte"
                    iconSize={32}
                    itemIconSize={44}
                  />
                )}
              />
            </FieldWrap>
          </>
        )}

        {hasTowel1 && (
          <FieldWrap label="Cor do toalheiro *">
            <select
              {...form.register('towelColorMode')}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD200]"
            >
              <option value="padrao">Padrão (Cromado)</option>
              <option value="acabamento">Cor do acabamento</option>
            </select>
          </FieldWrap>
        )}

        {hasShelf && (
          <>
            <FieldWrap label="Cor da prateleira *">
              <select
                {...form.register('shelfColorMode')}
                className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD200]"
              >
                <option value="padrao">Padrão</option>
                <option value="acabamento">Por acabamento</option>
              </select>
            </FieldWrap>

            <FieldWrap label={`Altura da prateleira (${shelfHeightPct}% )`}>
              <input
                type="range"
                min={20}
                max={100}
                step={1}
                value={shelfHeightPct}
                onChange={(e) =>
                  form.setValue('shelfHeightPct', Number(e.target.value), {
                    shouldDirty: true,
                  })
                }
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                <span>20%</span>
                <span>100%</span>
              </div>
              </FieldWrap>
                </>
              )}

              {/* Serigrafia */}
              <FieldWrap label="Serigrafia">
                <Controller
                  name="serigrafiaKey"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={serigrafias as IconOption[]}
                      getIcon={(opt) => silkIconFromOpt({ value: opt.value, label: opt.label })}
                      placeholder="Sem serigrafia"
                      iconSize={32}
                      itemIconSize={44}
                    />
                  )}
                />
              </FieldWrap>

              {selSer && selSer !== 'nenhum' && (
                <FieldWrap
                  label="Cor da Serigrafia *"
                  error={form.formState.errors?.['serigrafiaColor']?.message as string | undefined}
                >
                  <Controller
                    name="serigrafiaColor"
                    control={form.control}
                    render={({ field }) => (
                      <IconSelect
                        value={(field.value ?? '') as string}
                        onChange={(v) => field.onChange(v || undefined)}
                        options={serigrafiaColorChoices as IconOption[]}
                        getIcon={getSerigrafiaColorIcon as any}
                        iconSize={32}
                        itemIconSize={44}
                        placeholder="-"
                      />
                    )}
                  />
                </FieldWrap>
              )}
            </div>
            </section>
      </div>
      {/* IMAGENS DO LUGAR */}
    <section className="space-y-3">
    <h2 className="text-lg font-medium">Imagens do lugar</h2>

    {Array.isArray(form.watch('photoUrls')) && form.watch('photoUrls')!.length > 0 ? (
        <div className="flex flex-wrap gap-2">
        {form.watch('photoUrls')!.map((u, i) => (
            <a key={`${u}-${i}`} href={u} target="_blank" className="block w-24 h-24 border rounded overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-full h-full object-cover" />
            </a>
        ))}
        </div>
    ) : (
        <p className="text-sm text-gray-500">Sem imagens anexadas.</p>
    )}
    </section>
      <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
        <h2 className="mb-1 text-lg font-medium text-neutral-900">Bónus escolhido</h2>
        <p className="text-sm text-neutral-800">{bonusNiceLabel(budget.launchBonus)}</p>
      </section>
      {/* BELOW: medidas + preços + total + notas + enviar */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Medidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumInput f={form} name="widthMm"  label="Largura (cm)*" />
            <NumInput f={form} name="heightMm" label="Altura (cm)*" />
            <NumInput f={form} name="depthMm"  label="Profundidade (cm)" />
        </div>
      </section>

      {/* ENTREGA / INSTALAÇÃO */}
    <section className="space-y-3">
    <h2 className="text-lg font-medium">Entrega / Instalação</h2>

    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Tipo de Entrega */}
        <FieldWrap label="Tipo de Entrega *" error={undefined}>
        <select
        className="w-full border rounded px-3 py-2"
        value={form.watch('deliveryType') ?? ''}
        onChange={(e) => form.setValue('deliveryType', e.target.value, { shouldDirty: true })}
        >
        <option value="entrega">Entrega</option>
        <option value="entrega_instalacao">Entrega + Instalação</option>
        </select>
        </FieldWrap>

        {/* Tipo de Habitação */}
        <Text f={form} name="housingType" label="Tipo de Habitação" />

        {/* Andar */}
        <NumInput f={form} name="floorNumber" label="Andar" />


        
        {/* Tem Elevador */}
        <FieldWrap label="Tem elevador?">
        <input
            type="checkbox"
            checked={!!form.watch('hasElevator')}
            onChange={(e) => form.setValue('hasElevator', e.target.checked, { shouldDirty: true })}
        />
        </FieldWrap>
    </div>
    </section>

      {/* PREÇO & NOTAS & ENVIAR */}

    <section className="space-y-4">
    <h2 className="text-lg font-medium">Preço</h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Preço (EUR) */}
        <label className="block">
        <span className="block text-sm mb-1">Preço *</span>
        <input
            className="w-full border rounded px-3 py-2"
            inputMode="decimal"
            value={priceEuro}
            onChange={(e) => setPriceEuro(e.target.value)}
            placeholder="0,00"
        />
        </label>

        {/* Instalação (EUR) */}
        <label className="block">
        <span className="block text-sm mb-1">Instalação</span>
        <input
            className="w-full border rounded px-3 py-2"
            inputMode="decimal"
            value={installEuro}
            onChange={(e) => setInstallEuro(e.target.value)}
            placeholder="0,00"
        />
        </label>

        {/* Total (read only) */}
        <label className="block">
        <span className="block text-sm mb-1">Total atual</span>
        <div className="w-full border rounded px-3 py-2 bg-gray-50">
            {(() => {
            const p = Number(String(priceEuro || '0').replace(',', '.')) || 0;
            const i = Number(String(installEuro || '0').replace(',', '.')) || 0;
            return (p + i).toFixed(2).replace('.', ',') + ' €';
            })()}
        </div>
        </label>
    </div>

    {/* Notas */}
    <label className="block">
        <span className="block text-sm mb-1">Notas</span>
        <textarea rows={4} {...form.register('notes')} className="w-full border rounded px-3 py-2" />
    </label>

    {/* Anexar Fatura */}
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-neutral-900">Anexar Fatura (PDF)</div>
          <div className="text-xs text-neutral-600">
            Opcional - será enviada em anexo com o orçamento.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-block">
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (f) uploadInvoice(f);
                e.currentTarget.value = '';
              }}
              disabled={invoiceUploading}
            />
            <span
              className="cursor-pointer rounded px-3 py-1.5 text-sm text-black"
              style={{ backgroundColor: '#FFCC00', opacity: invoiceUploading ? 0.6 : 1 }}
            >
              {invoiceUploading ? 'A carregar…' : 'Escolher PDF'}
            </span>
          </label>

          {invoiceUrl ? (
            <>
              <a
                href={invoiceUrl}
                target="_blank"
                className="text-sm text-yellow-800 underline"
              >
                Ver fatura anexada
              </a>
              <button
                type="button"
                onClick={removeInvoice}
                className="text-sm text-red-600 hover:underline"
              >
                Remover
              </button>
            </>
          ) : (
            <span className="text-sm text-neutral-500">Sem fatura anexada</span>
          )}
        </div>
      </div>
    </div>

    {/* Enviar Orçamento */}
    <div className="pt-2">
      <button
        type="button"
        className="px-4 py-2 rounded text-black"
        style={{ backgroundColor: '#FFCC00' }}
        onClick={handleSend}
        disabled={sending || isJobBusy}
        aria-busy={sending}
      >
        {sending ? (
          <span className="inline-flex items-center">
            <GsSpinner />
            <span className="ml-2">A enviar…</span>
          </span>
        ) : 'Enviar Orçamento'}
      </button>

      {/* Optional: tiny status under the button when async is running */}
      {bgJob && (bgJob.status === 'queued' || bgJob.status === 'running') ? (
        <div className="mt-2 text-sm text-neutral-600">
          Envio em segundo plano… (Job {bgJob.id})
        </div>
      ) : null}
    </div>
    </section>
    </div>
  );
}

/* ---------------- helpers & tiny inputs (copied from public) ---------------- */


function toCents(s: string) {
  return Math.round(parseEuro(s) * 100);
}

function uniqByValue(items: {value:string; label:string; order?:number}[]) {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const it of items) {
    if (seen.has(it.value)) continue;
    seen.add(it.value);
    out.push(it);
  }
  out.sort((a,b) => {
    if (a.value === 'nenhum') return -1;
    if (b.value === 'nenhum') return 1;
    if (a.order != null && b.order != null) return a.order - b.order;
    return a.label.localeCompare(b.label,'pt');
  });
  return out;
}
function FieldWrap({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      {label && <span className="block text-sm font-medium text-neutral-800">{label}</span>}
      {children}
      {error ? (
        <span className="block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  );
}

function Text({
  f,
  name,
  label,
  type = 'text',
}: {
  f: any;
  name: keyof FormValues & string;
  label?: string;
  type?: string;
}) {
  const {
    register,
    formState: { errors },
  } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <input
        type={type}
        {...register(name)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD200]"
      />
    </FieldWrap>
  );
}

function NumInput({
  f,
  name,
  label,
}: {
  f: any;
  name: keyof FormValues & string;
  label?: string;
}) {
  const {
    register,
    formState: { errors },
  } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        {...register(name, {
          setValueAs: (v: any) =>
            v === '' ? undefined : Number(String(v).replace(',', '.')),
        })}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD200]"
      />
    </FieldWrap>
  );
}

function Textarea({
  f,
  name,
  label,
  rows = 3,
}: {
  f: any;
  name: keyof FormValues & string;
  label?: string;
  rows?: number;
}) {
  const {
    register,
    formState: { errors },
  } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <textarea
        rows={rows}
        {...register(name)}
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FFD200]"
      />
    </FieldWrap>
  );
}


function Select({
  f, name, label, options, allowEmpty,
}:{
  f:any; name:keyof FormValues & string; label?:string; options: CatItem[]; allowEmpty?: boolean;
}) {
  const { control, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <select
            {...field}
            onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.value)}
            value={(field.value ?? '') as string}
            className="w-full border rounded px-3 py-2"
          >
            {allowEmpty && <option value="">-</option>}
            {options?.map((o, i) => (
              <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      />
    </FieldWrap>
  );
}


/* ========== PREVIEW ICON HELPERS + IconSelect (from EditOrderModal) ========== */

const PRE = '/previews';

// --- model stem/icon helpers (robust canonicalization) ---
function capToken(tok: string) {
  return tok.replace(
    /^(\d*)([a-zA-Z])(.*)$/,
    (_m, d, c, rest) => `${d}${c.toUpperCase()}${rest.toLowerCase()}`
  );
}

const MODEL_CANON: Record<string, string> = {
  sterling: 'Sterling',
  diplomatagold: 'DiplomataGold',
  diplomatapivotante: 'DiplomataPivotante',
  europa: 'Europa',
  strong: 'Strong',
  painel: 'Painel',
  painelfixo: 'PainelFixo',
  algarve: 'Algarve',
  meioalgarve: 'MeioAlgarve',
  meialua: 'MeiaLua',
  lasvegas: 'LasVegas',
  florida: 'Florida',
  splash: 'Splash',
  turbo: 'Turbo',
  fole: 'Fole',
  foleap: 'FoleAP',
};

function modelStemFromAny(input: string) {
  const s = input.replace(/-/g, '_').replace(/\s+/g, '_').trim();
  const m = s.match(/^(.*?)(?:_)?v(\d+)$/i);
  let base = (m ? m[1] : s).replace(/_/g, '');
  const v = m ? m[2] : undefined;

  const lower = base.toLowerCase();
  const canonical =
    MODEL_CANON[lower] ??
    base
      .split(/(?=[A-Z])/)
      .join('')
      .split(/(\d+|[a-zA-Z]+)/g)
      .filter(Boolean)
      .map(capToken)
      .join('');

  return v ? `${canonical}_V${v}` : canonical;
}

const modelIconSrc = (valueOrLabel: string) =>
  `${PRE}/models/${modelStemFromAny(valueOrLabel)}.png`;

// --- finish icons ---
const FINISH_FILE_MAP: Record<string, string> = {
  amarelo: 'Amarelo',
  anodizado: 'Anodizado',
  azulclaro: 'AzulClaro',
  azulescuro: 'AzulEscuro',
  azulturquesa: 'AzulTurquesa',
  bordeaux: 'Bordeaux',
  branco: 'Branco',
  brancomate: 'BrancoMate',
  castanho: 'Castanho',
  cinza: 'Cinza',
  cremelclaro: 'CremeClaro',
  cremeescuro: 'CremeEscuro',
  cromado: 'Cromado',
  dourado: 'Dourado',
  gunmetal: 'GunMetal',
  preto: 'Preto',
  pretomate: 'PretoMate',
  pretofosco: 'PretoFosco',
  rosa: 'Rosa',
  verdeagua: 'VerdeAgua',
  verdefloresta: 'VerdeFloresta',
  vermelho: 'Vermelho',
};

const finishIconSrc = (name: string) => {
  if (!name) return undefined;
  const key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  const stem = FINISH_FILE_MAP[key];
  if (!stem) return undefined;
  return `${PRE}/finishes/${stem}.png`;
};

// --- handles ---
function handleIconSrc(value?: string) {
  if (!value || value === '') return `${PRE}/handles/default.png`;
  if (/^h(\d)$/i.test(value)) {
    return `${PRE}/handles/Handle_${value.replace(/^h/i, '')}.png`;
  }
  if (value.toLowerCase() === 'sem') return `${PRE}/handles/none.png`;
  return `${PRE}/handles/default.png`;
}

// --- glass/acrylic/serigrafia helpers ---
function labelToStem(label: string) {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');
}

const glassIconSrcFromLabel = (label: string) =>
  `${PRE}/glass/vidros/${labelToStem(label)}.png`;

const acrylicIconSrcFromLabel = (label: string) =>
  `${PRE}/acrylics/${labelToStem(label)}.png`;

function silkIdFrom(value?: string, label?: string) {
  const s = (value || label || '').trim();
  const mSer = s.match(/ser[\s_-]*0*(\d+)/i);
  if (mSer) return `SER${mSer[1].padStart(3, '0')}`;
  const mNamed = s.match(/(Quadro|Elo|Sereno)\s*0*(\d+)/i);
  if (mNamed) {
    const name =
      mNamed[1][0].toUpperCase() + mNamed[1].slice(1).toLowerCase();
    return `${name}${mNamed[2]}`;
  }
  // fallback: Pascalize
  return s
    .replace(/[\s_-]+/g, '')
    .replace(/^\w/, (c) => c.toUpperCase());
}

const silkIconFromOpt = (opt: { value: string; label: string }) =>
  `${PRE}/glass/silks/${silkIdFrom(opt.value, opt.label)}.png`;

// --- complemento icons + Vision bar ---
function complementoIconSrc(value: string) {
  const v = value.toLowerCase();
  if (v === 'vision') return `${PRE}/toalheiros/Vision.png`;
  if (v === 'toalheiro1') return `${PRE}/toalheiros/Toalheiro1.png`;
  if (v === 'prateleira') return `${PRE}/shelf/Prateleira.png`;
  return '';
}

function visionBarIconSrc(value: string) {
  const v = (value || '').toLowerCase();
  if (v === 'glass' || v === 'vidro' || v === 'transparente') {
    return `${PRE}/glass/vidros/Transparente.png`;
  }
  if (v === 'white' || v === 'branco' || v === 'branco_mate') {
    return `${PRE}/finishes/BrancoMate.png`;
  }
  if (v === 'black' || v === 'preto' || v === 'preto_mate' || v === 'pretofosco') {
    return `${PRE}/finishes/PretoMate.png`;
  }
  return `${PRE}/finishes/${value ? value.replace(/[\s_-]+/g, '') : ''}.png`;
}

// --- TinyIcon ---
function TinyIcon({
  src,
  alt,
  size = 20,
}: {
  src?: string;
  alt: string;
  size?: number;
}) {
  if (!src) {
    return (
      <span
        className="inline-block rounded-[6px] bg-neutral-200/70"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  const exts = ['png', 'jpg', 'jpeg', 'webp'];
  const base = src.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  const variants = [
    base,
    base.replace(/_V(\d+)$/i, 'V$1'),
    base.toLowerCase(),
    base.replace(/_/g, ''),
  ].flatMap((s) => exts.map((e) => `${s}.${e}`));

  const [idx, setIdx] = React.useState(0);
  if (idx >= variants.length) {
    return (
      <span
        className="inline-block rounded-[6px] bg-neutral-200/70"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  const url = variants[idx];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      style={{ width: size, height: size }}
      className="object-contain rounded-[6px] bg-white"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

// --- IconSelect (same behaviour, slightly nicer styling) ---
type IconOption = { value: string; label: string; order?: number };

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onOutside]);
  return ref;
}

function IconSelect({
  value,
  onChange,
  options,
  groups,
  getIcon,
  placeholder = '-',
  disabled,
  iconSize = 24,
  itemIconSize = 40,
}: {
  value?: string;
  onChange: (v: string) => void;
  options?: IconOption[];
  groups?: Map<string, IconOption[]>;
  getIcon: (o: IconOption) => string | undefined;
  placeholder?: string;
  disabled?: boolean;
  iconSize?: number;
  itemIconSize?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [animIn, setAnimIn] = React.useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => closeMenu());

  const flat: IconOption[] = React.useMemo(
    () => (groups ? Array.from(groups.values()).flat() : options ?? []),
    [groups, options]
  );

  const current = flat.find((o) => o.value === value);
  const canOpen = !disabled && flat.length > 1;

  function openMenu() {
    if (mounted) return;
    setMounted(true);
    requestAnimationFrame(() => setAnimIn(true));
  }
  function closeMenu() {
    if (!mounted) return;
    setAnimIn(false);
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }
    if (mounted) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted]);

  const selectItem = (val: string) => {
    onChange(val);
    closeMenu();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!canOpen) return;
          mounted ? closeMenu() : openMenu();
        }}
        className={[
          'w-full rounded-xl border border-neutral-300 bg-white px-3 py-2',
          'flex items-center justify-between gap-2 shadow-sm',
          canOpen ? 'cursor-pointer hover:border-neutral-400' : 'cursor-default',
          disabled ? 'opacity-60' : '',
        ].join(' ')}
      >
        <span className="flex items-center gap-2 min-w-0">
          <TinyIcon
            src={current ? getIcon(current) : undefined}
            alt={current?.label ?? ''}
            size={iconSize}
          />
          <span className="truncate text-sm">
            {current?.label ?? <span className="text-neutral-400">{placeholder}</span>}
          </span>
        </span>
        {canOpen && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            className="text-neutral-500"
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.24 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z" />
          </svg>
        )}
      </button>

      {mounted && (
        <div
          className={[
            'absolute z-20 mt-1 w-full rounded-xl border border-neutral-200 bg-white',
            'shadow-[0_8px_24px_rgba(0,0,0,.12)]',
            'origin-top transition-all duration-150 ease-out',
            animIn
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 -translate-y-1 scale-[0.98]',
          ].join(' ')}
          onTransitionEnd={() => {
            if (!animIn) setMounted(false);
          }}
          role="listbox"
        >
          <div className="max-h-72 overflow-auto py-1">
            {groups
              ? Array.from(groups.entries()).map(([g, arr]) => (
                  <div key={g} className="py-1">
                    <div className="sticky top-0 z-10 bg-white/95 px-3 py-1 text-[11px] uppercase text-neutral-500">
                      {g}
                    </div>
                    {arr.map((opt) => {
                      const selected = opt.value === value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onMouseDown={() => selectItem(opt.value)}
                          className={[
                            'w-full px-3 py-2.5 flex items-center gap-3 text-left text-sm',
                            'hover:bg-neutral-50',
                            selected ? 'bg-neutral-50' : '',
                          ].join(' ')}
                          role="option"
                          aria-selected={selected}
                        >
                          <TinyIcon
                            src={getIcon(opt)}
                            alt={opt.label}
                            size={itemIconSize}
                          />
                          <span className="truncate">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))
              : (options ?? []).map((opt) => {
                  const selected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onMouseDown={() => selectItem(opt.value)}
                      className={[
                        'w-full px-3 py-2.5 flex items-center gap-3 text-left text-sm',
                        'hover:bg-neutral-50',
                        selected ? 'bg-neutral-50' : '',
                      ].join(' ')}
                      role="option"
                      aria-selected={selected}
                    >
                      <TinyIcon
                        src={getIcon(opt)}
                        alt={opt.label}
                        size={itemIconSize}
                      />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- ComplementoSelector (icon chips, like in modal) ---
function ComplementoSelector({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const selected = (value ?? [])
    .map((v) => v.toLowerCase())
    .filter((v) => v && v !== 'nenhum');
  const noneActive = selected.length === 0;

  const orderedOptions = React.useMemo(() => {
    const arr = [...options];
    arr.sort((a, b) => {
      const va = a.value.toLowerCase();
      const vb = b.value.toLowerCase();
      if (va === 'nenhum') return -1;
      if (vb === 'nenhum') return 1;
      return 0;
    });
    return arr;
  }, [options]);

  const setNone = () => onChange([]);

  const toggle = (raw: string) => {
    const c = raw.toLowerCase();
    if (c === 'nenhum') {
      setNone();
      return;
    }
    const has = selected.includes(c);
    if (has) {
      onChange(selected.filter((v) => v !== c));
    } else {
      onChange([...selected, c]);
    }
  };

  const baseCls =
    'group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all border shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD200]/60';
  const activeCls =
    'bg-[#FFD200]/20 border-[#FFD200] text-[#122C4F] shadow-[0_0_0_2px_rgba(255,210,0,0.35)]';
  const inactiveCls =
    'bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-400';

  return (
    <div className="flex flex-wrap gap-2">
      {orderedOptions.map((opt) => {
        const val = opt.value.toLowerCase();
        const isNone = val === 'nenhum';
        const active = isNone ? noneActive : selected.includes(val);
        const iconSrc = !isNone ? complementoIconSrc(val) : '';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            aria-pressed={active}
            className={`${baseCls} ${active ? activeCls : inactiveCls}`}
          >
            {!isNone && <TinyIcon src={iconSrc} alt="" size={18} />}
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Thumbs preview (reusable) ---
function Thumbs({ urls }: { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u) => (
        <a
          key={u}
          href={u}
          target="_blank"
          rel="noreferrer"
          className="block h-24 w-24 overflow-hidden rounded border border-neutral-200 bg-neutral-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={u}
            alt=""
            className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
          />
        </a>
      ))}
    </div>
  );
}

/* ========== end previews block ========== */


