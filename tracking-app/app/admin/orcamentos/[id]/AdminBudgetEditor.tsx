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
  serigrafiaColor: z.enum(['padrao','acabamento']).optional(),

  fixingBarMode: z.enum(['padrao','acabamento']).optional(),
  complemento: z.string().min(1),
  towelColorMode: z.enum(['padrao','acabamento']).optional(),
  shelfColorMode: z.enum(['padrao','acabamento']).optional(),
    shelfHeightPct: z
    .union([z.number().int(), z.string().transform(v => parseInt(v, 10))])
    .optional(),
  cornerChoice: z.string().optional(),
  cornerColorMode: z.string().optional(),

  // medidas (form em CM)
  widthMm: NumOpt,   // holds CM in the form; we'll convert to mm on PATCH
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
});
type FormValues = z.infer<typeof AdminBudgetSchema>;
type RHFResolver = Resolver<FormValues, any, FormValues>;

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
      complemento: budget.complemento,
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
  React.useEffect(() => {
    if (!modelKey) return;
    (async () => {
      const res = await fetch(`/api/model-rules/${encodeURIComponent(modelKey)}`, { cache: 'no-store' });
      if (res.ok) setRule((await res.json()) as ModelRuleDTO);
      else setRule(null);
    })();
  }, [modelKey]);

  // Conditional clears (Vision / Towel / Shelf / Serigrafia)
  const comp = form.watch('complemento');
  const shelfHeightPct = form.watch('shelfHeightPct') ?? 100;
  React.useEffect(() => {
    if (comp !== 'vision') {
      form.setValue('barColor', undefined, { shouldDirty:true });
      form.setValue('visionSupport', undefined, { shouldDirty:true });
    }
    if (comp !== 'toalheiro1') {
      form.setValue('towelColorMode', undefined, { shouldDirty:true });
    }
    if (comp !== 'prateleira') {
      form.setValue('shelfColorMode', undefined, { shouldDirty:true });
    }
      if (comp !== 'prateleira') {
    form.setValue('shelfColorMode', undefined, { shouldDirty:true });
    form.setValue('shelfHeightPct', undefined, { shouldDirty:true }); // NEW
  } else {
    if (form.getValues('shelfHeightPct') == null) {
      form.setValue('shelfHeightPct', 100, { shouldDirty: true }); // e.g. middle
    }
  }
  }, [comp]);

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

  function isPainelV234(key?: string) {
    if (!key) return false;
    return /painel[_-]?v(2|3|4)\b/i.test(key.toLowerCase());
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

  /* ---------------- Actions ---------------- */

  const saveAll: SubmitHandler<FormValues> = async (values) => {
    // merge price/notes into a single PATCH (API supports these)
    const payload = {
      ...values,
      priceCents: toCents(priceEuro),
      installPriceCents: toCents(installEuro),
      notes: values.notes ?? undefined,
    };
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
  const payload = {
    ...form.getValues(),
    priceCents: pCents,
    installPriceCents: priceCents(installEuro),
    widthMm:  toMm(form.getValues('widthMm')),
    heightMm: toMm(form.getValues('heightMm')),
    depthMm:  toMm(form.getValues('depthMm')),
    notes: form.getValues('notes') || undefined,
  };

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

          {/* Model */}
          <Select f={form} name="modelKey" label="Modelo *" options={(catalog?.MODEL ?? [])} />

          {!hideHandles && (
            <Select f={form} name="handleKey" label="Puxador" options={handles} />
          )}

          <Select f={form} name="finishKey" label="Acabamento *" options={finishes} />

          {rule?.hasFixingBar && (
            <Select
              f={form}
              name="fixingBarMode"
              label="Barra de fixação *"
              options={[
                { value: 'padrao',     label: 'Padrão' },
                { value: 'acabamento', label: 'Cor do acabamento' },
              ]}
            />
          )}

          <Select
            f={form}
            name="glassTypeKey"
            label="Vidro / Monocromático *"
            options={[...(glassTipos ?? []), ...(monos ?? [])]}
          />

          {allowAcrylic && (
            <Select
              f={form}
              name="acrylicKey"
              label="Acrílico / Policarbonato"
              options={catalog?.ACRYLIC_AND_POLICARBONATE ?? []}
            />
          )}

          <Select f={form} name="complemento" label="Complemento *" options={complementoOpts} />

          {comp === 'vision' && (
            <>
              <Select f={form} name="barColor" label="Cor da Barra Vision *" options={catalog?.VISION_BAR_COLOR ?? []} />
              <Select f={form} name="visionSupport" label="Cor de Suporte *" options={finishes} />
            </>
          )}

          {comp === 'toalheiro1' && (
            <Select
              f={form}
              name="towelColorMode"
              label="Cor do toalheiro *"
              options={[
                { value: 'padrao',     label: 'Padrão (Cromado)' },
                { value: 'acabamento', label: 'Cor do Acabamento' },
              ]}
            />
          )}

          {comp === 'prateleira' && (
            <>
              <FieldWrap label="Cor da prateleira">
                {/* existing shelfColorMode select */}
                <select
                  {...form.register('shelfColorMode')}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
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
                  className="w-full h-2 appearance-none rounded-full
                            bg-slate-200
                            accent-[#FECB1F]
                            [--thumb-size:18px]
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-[var(--thumb-size)]
                            [&::-webkit-slider-thumb]:h-[var(--thumb-size)]
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:bg-white
                            [&::-webkit-slider-thumb]:border
                            [&::-webkit-slider-thumb]:border-slate-300
                            [&::-webkit-slider-thumb]:shadow
                            [&::-moz-range-thumb]:w-[var(--thumb-size)]
                            [&::-moz-range-thumb]:h-[var(--thumb-size)]
                            [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-white
                            [&::-moz-range-thumb]:border
                            [&::-moz-range-thumb]:border-slate-300
                            [&::-moz-range-thumb]:shadow"
                />
                <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                  <span>20%</span>
                  <span>100%</span>
                </div>
              </FieldWrap>
            </>
          )}
          {comp === 'prateleira' && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span>
                Altura da prateleira:{" "}
                <strong>{shelfHeightPct}%</strong>
              </span>
              <a
                href={(() => {
                  const params = new URLSearchParams();
                  const model = String(budget.modelKey || '').toLowerCase();
                  if (model) params.set('model', model);

                  params.set('complemento', 'prateleira');

                  const shelfMode = form.getValues('shelfColorMode') || 'padrao';
                  params.set('shelfColorMode', shelfMode);

                  if (typeof shelfHeightPct === 'number') {
                    params.set('altura', String(shelfHeightPct));
                  }

                  // (Optional: you can also add finish/glass/handle/etc from `budget` here)

                  return `https://simulador.mfn.pt/?${params.toString()}`;
                })()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
              >
                Ver altura
              </a>
            </div>
          )}
          <Select f={form} name="serigrafiaKey" label="Serigrafia" options={serigrafias} />
          {selSer && selSer !== 'nenhum' && (
            <Select
              f={form}
              name="serigrafiaColor"
              label="Cor da Serigrafia *"
              options={[
                { value: 'padrao',     label: 'Padrão' },
                { value: 'acabamento', label: 'Cor do Acabamento' },
              ]}
            />
          )}
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

function FieldWrap({ label, error, children }: { label?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {label && <span className="block text-sm mb-1">{label}</span>}
      {children}
      {error ? <span className="block text-xs text-red-600 mt-1">{error}</span> : null}
    </label>
  );
}

function Text({ f, name, label, type = 'text' }:{ f:any; name:keyof FormValues & string; label?:string; type?:string }) {
  const { register, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <input type={type} {...register(name)} className="w-full border rounded px-3 py-2" />
    </FieldWrap>
  );
}

function NumInput({ f, name, label }:{ f:any; name:keyof FormValues & string; label?:string }) {
  const { register, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        {...register(name, {
          setValueAs: (v: any) => (v === '' ? undefined : Number(String(v).replace(',', '.'))),
        })}
        className="w-full border rounded px-3 py-2"
      />
    </FieldWrap>
  );
}

function Textarea({ f, name, label, rows=3 }:{ f:any; name:keyof FormValues & string; label?:string; rows?:number }) {
  const { register, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <textarea rows={rows} {...register(name)} className="w-full border rounded px-3 py-2" />
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

function Thumbs({ urls }:{ urls:string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" className="block w-24 h-24 border rounded overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}
