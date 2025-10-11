'use client';

import * as React from 'react';
import { z } from 'zod';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

/* ---------------- Schema (admin version) ---------------- */

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

// — euros helpers (comma or dot)
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
    alert(`Enviado. PDF: ${data.pdf ?? '—'}`);
  };

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
            <Select
              f={form}
              name="shelfColorMode"
              label="Cor do suporte *"
              options={[
                { value: 'padrao',     label: 'Padrão' },
                { value: 'acabamento', label: 'Cor do Acabamento' },
              ]}
            />
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

    {/* Enviar Orçamento */}
    <div className="pt-2">
        <button
        type="button"
        className="px-4 py-2 rounded text-black"
        style={{ backgroundColor: '#FFCC00' /* Goldstar yellow */ }}
        onClick={async () => {
        // required: preço, largura, altura
        const w = Number(form.getValues('widthMm') ?? 0);
        const h = Number(form.getValues('heightMm') ?? 0);

        const pCents = euroToCents(priceEuro);
        const wCm = form.getValues('widthMm');
        const hCm = form.getValues('heightMm');
        const dCm = form.getValues('depthMm');
        const toMm = (cm?: number) => (cm == null ? undefined : Math.round(cm * 10));
        if (!pCents || pCents <= 0) { alert('Preço é obrigatório.'); return; }
        if (!w || w <= 0)           { alert('Largura é obrigatória.'); return; }
        if (!h || h <= 0)           { alert('Altura é obrigatória.');  return; }

        // 1) Persist **all** current form values first (so convert uses fresh data)
        const current = form.getValues();
        const payload = normalizeForPatch({
        ...form.getValues(),
        priceCents: euroToCents(priceEuro),
        installPriceCents: euroToCents(installEuro),
        widthMm:  toMm(wCm),
        heightMm: toMm(hCm),
        depthMm:  toMm(dCm),
        // keep delivery fields as-is
        });
        const patchRes = await fetch(`/api/budgets/${budget.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        });
        if (!patchRes.ok) {
        const err = await patchRes.text();
        alert('Falha ao guardar alterações: ' + err);
        return;
        }

        await fetch(`/api/budgets/${budget.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        });

        // 2) Convert → PDF → email → (Order)
        const convRes = await fetch(`/api/budgets/${budget.id}/convert`, { method: 'POST' });
        const conv = await convRes.json().catch(() => ({}));
        if (!convRes.ok) {
            alert(conv?.error ?? 'Falha ao enviar orçamento');
            return;
        }
        alert(`Orçamento enviado. PDF: ${conv?.pdf ?? '—'}`);
        }}
        >
        Enviar Orçamento
        </button>
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
            {allowEmpty && <option value="">—</option>}
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
