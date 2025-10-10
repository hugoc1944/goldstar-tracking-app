'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Catalog, CatItem, ModelRuleDTO } from '@/lib/catalog-types';
import type { SubmitHandler, Resolver } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import Image from 'next/image';
import { Suspense } from 'react';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function uniqByValue(items: {value:string; label:string; order?:number}[]) {
  const seen = new Set<string>();
  const out: typeof items = [];
  for (const it of items) {
    if (seen.has(it.value)) continue;
    seen.add(it.value);
    out.push(it);
  }
  // keep "nenhum" (if any) first, then by order/label
  out.sort((a,b) => {
    if (a.value === 'nenhum') return -1;
    if (b.value === 'nenhum') return 1;
    if (a.order != null && b.order != null) return a.order - b.order;
    return a.label.localeCompare(b.label,'pt');
  });
  return out;
}

// Canonicalize strings: lowercase, strip accents, unify separators
function canon(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // strip accents
    .replace(/[\s-]+/g, '_')              // spaces & hyphens → underscores
    .replace(/_+/g, '_')                  // collapse multiple underscores
    .trim();
}

// Find catalog option by value OR label (case/diacritics/sep-insensitive)
function matchOption(
  options: { value: string; label: string }[] | undefined,
  raw?: string | null
): string | undefined {
  if (!options || !raw) return undefined;
  const r = canon(raw);
  // exact by value first
  let found = options.find(o => canon(o.value) === r);
  if (found) return found.value;
  // then by label
  found = options.find(o => canon(o.label) === r);
  return found?.value;
}

// Parse bool/numbers from search params (accepts 1/true/yes)
const asBool = (s?: string | null) =>
  s == null ? undefined : ['1','true','yes','y'].includes(s.toLowerCase());
const asInt  = (s?: string | null) => (s == null || s === '' ? undefined : Number(s));
const SerColorEnum = z.enum(['padrao','acabamento']);
const FixBarModeEnum = z.enum(['padrao','acabamento']); 
const DualColorModeEnum = z.enum(['padrao','acabamento']);
const NumOpt = z.preprocess(
  (v) =>
    v === '' || v === null
      ? undefined
      : typeof v === 'string'
      ? globalThis.Number(v.replace(',', '.'))
      : v,
  z.number().positive().optional()
);
// REPLACE your PublicBudgetSchema with this:
export const PublicBudgetSchema = z.object({
  // cliente
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  nif: z.string().optional(),
  address: z.string().min(1, 'Morada é obrigatória'),
  postalCode: z.string().min(1, 'Código postal é obrigatório'),
  city: z.string().min(1, 'Cidade é obrigatória'),

  // escolhas
  modelKey: z.string().min(1),
  handleKey: z.string().optional(),
  finishKey: z.string().min(1),

  // Vision-only → optional in base; we enforce conditionally below
  barColor: z.string().optional(),
  visionSupport: z.string().optional(),

  glassTypeKey: z.string().min(1),
  acrylicKey: z.string().optional(),
  serigrafiaKey: z.string().optional(),
  serigrafiaColor: SerColorEnum.optional(),
  fixingBarMode: FixBarModeEnum.optional(),

  complemento: z.string().min(1),

  // legacy/unused in this public form, keep if you want:
  visionBar: z.string().optional(),
  towelColorMode: DualColorModeEnum.optional(), 
  shelfColorMode: DualColorModeEnum.optional(),
  cornerChoice: z.string().optional(),
  cornerColorMode: z.string().optional(),

  // medidas
  widthMm: NumOpt,
  heightMm: NumOpt,
  depthMm: NumOpt,
  willSendLater: z.boolean().default(false),

  // logística
  deliveryType: z.string().min(1),
  housingType: z.string().optional(),
  floorNumber: z.coerce.number().int().optional(),
  hasElevator: z.boolean().optional(),

  // fotos
  photoUrls: z.array(z.string().url()).optional(),

  notes: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    // medidas
  if (!val.willSendLater) {
  if (!val.widthMm || val.widthMm <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Insira uma medida',
      path: ['widthMm'],
    });
  }
  if (!val.heightMm || val.heightMm <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Insira uma medida',
      path: ['heightMm'],
    });
  }
}

  // Vision-only required fields
  if (val.complemento === 'vision') {
    if (!val.barColor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['barColor'] });
    }
    if (!val.visionSupport) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['visionSupport'] });
    }
  }
   if (val.complemento === 'toalheiro1') {
    if (!val.towelColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Toalheiro 1.', path: ['towelColorMode'] });
    }
  }
  if (val.complemento === 'prateleira') {
    if (!val.shelfColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Prateleira de Canto.', path: ['shelfColorMode'] });
    }
  }
});

type FormValues = z.infer<typeof PublicBudgetSchema>;

export function BudgetFormPageInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [rule, setRule] = React.useState<ModelRuleDTO | null>(null);
  const [uploading, setUploading] = React.useState(false);
type RHFResolver = Resolver<FormValues, any, FormValues>;
  const form = useForm<FormValues>({
      resolver: zodResolver(PublicBudgetSchema) as RHFResolver,
      defaultValues: {
      name: '', email: '', phone: '',
      nif: '', address: '', postalCode: '', city: '',
      modelKey: search.get('model') ?? '',
      handleKey: search.get('handle') ?? undefined,
      finishKey: search.get('finish') ?? '',
      barColor: search.get('barColor') ?? undefined,
      glassTypeKey: search.get('glass') ?? '',
      acrylicKey: search.get('acrylic') ?? 'nenhum',
      serigrafiaKey: search.get('serigrafia') ?? 'nenhum',
      serigrafiaColor: undefined,
      complemento: search.get('complemento') ?? 'nenhum',
      visionSupport: undefined, visionBar: undefined,
      towelColorMode: undefined, shelfColorMode: undefined,   
      cornerChoice: undefined, cornerColorMode: undefined,
      widthMm: undefined, heightMm: undefined, depthMm: undefined,
      willSendLater: search.get('later') === '1',
      deliveryType: 'entrega',
      housingType: undefined, floorNumber: undefined, hasElevator: undefined,
      photoUrls: [],
      notes: undefined,
    },
  });

  const modelKey = form.watch('modelKey');

  // Load catalog once
  React.useEffect(() => {
    (async () => {
      const res = await fetch('/api/catalog', { cache: 'no-store' });
      const data = await res.json();
      setCatalog(data as Catalog);
    })();
  }, []);
  // EFFECT A — set model from URL after catalog is ready (enables rule fetch)
React.useEffect(() => {
  if (!catalog) return;

  const modelParam = search.get('model');
  if (!modelParam) return;

  const models = (catalog['MODEL'] ?? []) as CatItem[];
  const matched = matchOption(models, modelParam);
  if (matched) {
    form.setValue('modelKey', matched, { shouldDirty: false });
  }
  // also init willSendLater here (robust parsing)
  const laterParam = search.get('later');
  const later = asBool(laterParam);
  if (typeof later === 'boolean') {
    form.setValue('willSendLater', later, { shouldDirty: false });
  }
  // optional: measures from URL (expect cm)
  const w = asInt(search.get('width')  ?? search.get('w'));
  const h = asInt(search.get('height') ?? search.get('h'));
  const d = asInt(search.get('depth')  ?? search.get('d'));
  if (w != null) form.setValue('widthMm', w,  { shouldDirty: false });
  if (h != null) form.setValue('heightMm', h, { shouldDirty: false });
  if (d != null) form.setValue('depthMm', d,  { shouldDirty: false });
}, [catalog]); 
// DEFAULT MODEL — if no ?model= and form still empty, pick the first model
React.useEffect(() => {
  if (!catalog) return;
  const current = form.getValues('modelKey');
  if (current && current.length > 0) return;
  const models = (catalog['MODEL'] ?? []) as CatItem[];
  if (models.length) {
    form.setValue('modelKey', models[0].value, { shouldDirty: false });
  }
}, [catalog]);


  // Load model rule whenever model changes
  React.useEffect(() => {
    if (!modelKey) return;
    (async () => {
      const res = await fetch(`/api/model-rules/${encodeURIComponent(modelKey)}`, { cache: 'no-store' });
      const data = await res.json();
      setRule(data as ModelRuleDTO);
    })();
  }, [modelKey]);

  // EFFECT B — after rule is known, map *all other* URL params to valid options
  React.useEffect(() => {
    if (!catalog || !rule) return;

    // Option arrays (respect current rule)
    const models = (catalog['MODEL'] ?? []) as CatItem[];
    const finAll = [...(catalog['FINISH_METALICO'] ?? []), ...(catalog['FINISH_LACADO'] ?? [])] as CatItem[];
    const rm = new Set((rule.removeFinishes ?? []).map(v => v.toLowerCase()));
    const finishesByRule = finAll.filter(f => !rm.has(f.value.toLowerCase()));

    const glassAll = [...(catalog['GLASS_TIPO'] ?? []), ...(catalog['MONOCROMATICO'] ?? [])] as CatItem[];
    const compAll  = (catalog['COMPLEMENTO'] ?? []) as CatItem[];
    const handleAll = (() => {
      let list = [...(catalog['HANDLE'] ?? [])] as CatItem[];
      list = list.filter(h => h.value !== '-' && h.value !== '');
      if (!isPainelV234(form.getValues('modelKey'))) list = list.filter(h => h.value !== 'sem');
      return list;
    })();
    const acrylicAll = (catalog['ACRYLIC_AND_POLICARBONATE'] ?? []) as CatItem[];
    const barColorsAll = (catalog['VISION_BAR_COLOR'] ?? []) as CatItem[];

    const serigrafiasAll = uniqByValue([
      ...((catalog['SERIGRAFIA_PRIME'] ?? []) as CatItem[]),
      ...((catalog['SERIGRAFIA_QUADROS'] ?? []) as CatItem[]),
      ...((catalog['SERIGRAFIA_ELO_SERENO'] ?? []) as CatItem[]),
    ]);

    const setIf = (field: keyof FormValues & string, value?: string) => {
      if (!value) return;
      form.setValue(field, value, { shouldDirty: false });
    };

    // Map each URL param → catalog option (by value or label)
    setIf('finishKey',     matchOption(finishesByRule, search.get('finish')));
    setIf('glassTypeKey',  matchOption(glassAll,       search.get('glass')));
    setIf('complemento',   matchOption(compAll,        search.get('complemento')));
    setIf('handleKey',     matchOption(handleAll,      search.get('handle')));

    // Vision extras
    setIf('barColor',      matchOption(barColorsAll,   search.get('barColor')));
    setIf('visionSupport', matchOption(finishesByRule, search.get('visionSupport')));

    // Acrylic and Serigrafia (optional)
    setIf('acrylicKey',    matchOption(acrylicAll,     search.get('acrylic')));
    setIf('serigrafiaKey', matchOption(serigrafiasAll, search.get('serigrafia')));

    // Serigrafia color mode (enum)
    const serCor = search.get('serCor');
    if (serCor === 'padrao' || serCor === 'acabamento') {
      form.setValue('serigrafiaColor', serCor, { shouldDirty: false });
    }

    // Towel/shelf color modes (enums), accept ?towel=padrao&... or ?towelColor=...
    const towel = (search.get('towel') ?? search.get('towelColor'))?.toLowerCase();
    if (towel === 'padrao' || towel === 'acabamento') {
      form.setValue('towelColorMode', towel as any, { shouldDirty: false });
    }
    const shelf = (search.get('shelf') ?? search.get('shelfColor'))?.toLowerCase();
    if (shelf === 'padrao' || shelf === 'acabamento') {
      form.setValue('shelfColorMode', shelf as any, { shouldDirty: false });
    }

    // Fixing bar mode (if rule.hasFixingBar)
    const fb = search.get('fixingBarMode')?.toLowerCase();
    if (rule.hasFixingBar && (fb === 'padrao' || fb === 'acabamento')) {
      form.setValue('fixingBarMode', fb as any, { shouldDirty: false });
    }

    // Delivery fields (public form uses 'instalacao' instead of 'entrega_instalacao')
    const delParam = search.get('delivery') ?? search.get('deliveryType');
    if (delParam) {
      const dcanon = canon(delParam);
      const val = dcanon === 'entrega_instalacao' ? 'instalacao' : dcanon; // accept both
      if (val === 'entrega' || val === 'instalacao') {
        form.setValue('deliveryType', val, { shouldDirty: false });
      }
    }
    const housing = search.get('housing') ?? search.get('housingType');
    if (housing) form.setValue('housingType', housing, { shouldDirty: false });
    const floor = asInt(search.get('floor') ?? search.get('floorNumber'));
    if (floor != null) form.setValue('floorNumber', floor, { shouldDirty: false });
    const elev = asBool(search.get('elevator') ?? search.get('hasElevator'));
    if (typeof elev === 'boolean') form.setValue('hasElevator', elev, { shouldDirty: false });

  }, [catalog, rule]);
  function isPainelV234(key?: string) {
    if (!key) return false;
    return /painel[_-]?v(2|3|4)\b/i.test(key.toLowerCase());
  }
  // Helpers to get filtered options based on rule
  const handles = React.useMemo(() => {
    if (!catalog) return [];
    const list = [...(catalog['HANDLE'] ?? [])];

    // drop stray placeholder values if they exist
    let filtered = list.filter(h => h.value !== '-' && h.value !== '');

    // only Painel v2/v3/v4 can show "sem"
    if (!isPainelV234(modelKey)) {
      filtered = filtered.filter(h => h.value !== 'sem');
    }

    return filtered;
  }, [catalog, modelKey]);

  const finishes = React.useMemo(() => {
    if (!catalog) return [];
    const all = [...(catalog['FINISH_METALICO'] ?? []), ...(catalog['FINISH_LACADO'] ?? [])];
    if (!rule?.removeFinishes?.length) return all;
    const rm = new Set(rule.removeFinishes.map(v => v.toLowerCase()));
    return all.filter(f => !rm.has(f.value.toLowerCase()));
  }, [catalog, rule]);

  const glassTipos = React.useMemo(() => catalog?.['GLASS_TIPO'] ?? [], [catalog]);
  const monos = React.useMemo(() => catalog?.['MONOCROMATICO'] ?? [], [catalog]);
  const complemento = React.useMemo(() => catalog?.['COMPLEMENTO'] ?? [], [catalog]);
  const barColors = React.useMemo(() => catalog?.['VISION_BAR_COLOR'] ?? [], [catalog]);
  const serPrime = React.useMemo(() => catalog?.['SERIGRAFIA_PRIME'] ?? [], [catalog]);
  const serQuadros = React.useMemo(() => catalog?.['SERIGRAFIA_QUADROS'] ?? [], [catalog]);
  const serElo = React.useMemo(() => catalog?.['SERIGRAFIA_ELO_SERENO'] ?? [], [catalog]);

  const serigrafias: CatItem[] = React.useMemo(
    () => uniqByValue([...(serPrime ?? []), ...(serQuadros ?? []), ...(serElo ?? [])]),
    [serPrime, serQuadros, serElo]
  );

  const allowAcrylic = !!rule?.allowAcrylicAndPoly;
  const allowTowel1 = !!rule?.allowTowel1;
  const hideHandles = !!rule?.hideHandles;

// 1) Set default "finish" and "glass" once options are known
React.useEffect(() => {
  const hasFinish = !!form.getValues('finishKey');
  if (!hasFinish && finishes.length) {
    form.setValue('finishKey', finishes[0].value, { shouldDirty: false });
  }
  const allGlass = [...(glassTipos ?? []), ...(monos ?? [])];
  if (!form.getValues('glassTypeKey') && allGlass.length) {
    form.setValue('glassTypeKey', allGlass[0].value, { shouldDirty: false });
  }
}, [finishes, glassTipos, monos]);

// 2) When complemento requires extra choices, pick defaults
  const comp = form.watch('complemento');

React.useEffect(() => {
  if (comp === 'vision') {
    if (!form.getValues('barColor') && (barColors?.length ?? 0) > 0) {
      form.setValue('barColor', barColors![0].value, { shouldDirty: false });
    }
    if (!form.getValues('visionSupport') && finishes.length) {
      form.setValue('visionSupport', finishes[0].value, { shouldDirty: false });
    }
  }
  if (comp === 'toalheiro1' && !form.getValues('towelColorMode')) {
    form.setValue('towelColorMode', 'padrao', { shouldDirty: false });
  }
  if (comp === 'prateleira' && !form.getValues('shelfColorMode')) {
    form.setValue('shelfColorMode', 'padrao', { shouldDirty: false });
  }
}, [comp, barColors, finishes]);
  
  async function onUploadFiles(ev: React.ChangeEvent<HTMLInputElement>) {
    const files = ev.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('files', f));
      const res = await fetch('/api/uploads/budget', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Falha no upload');
      const { urls } = await res.json(); // -> string[]
      const current = form.getValues('photoUrls') ?? [];
      form.setValue('photoUrls', [...current, ...urls], { shouldDirty: true });
    } catch (e) {
      alert('Não foi possível carregar as fotos.');
    } finally {
      setUploading(false);
      // reset the input so user can re-upload same file
      (ev.target as any).value = '';
    }
  }

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const toMm = (cm?: number) => (cm == null ? undefined : Math.round(cm * 10));

    const payload = {
      ...values,
      // convert cm → mm right before sending
      widthMm:  toMm(values.widthMm),
      heightMm: toMm(values.heightMm),
      depthMm:  toMm(values.depthMm),
    };

    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? 'Erro ao submeter orçamento');
      return;
    }
    const { id } = await res.json();
    router.push(`/orcamentos/sucesso?id=${encodeURIComponent(id)}`);
  };


  React.useEffect(() => {
    if (comp !== 'vision') {
      form.setValue('barColor', undefined, { shouldDirty:true });
      form.setValue('visionSupport', undefined, { shouldDirty:true });
    }
    if (comp !== 'toalheiro1') {
    form.setValue('towelColorMode', undefined, { shouldDirty:true });
    }

    // NEW: clear Prateleira color when complemento is not prateleira
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

function isAbrirModel(key?: string) {
  if (!key) return false;
  const k = key.toLowerCase();
  return (
    k.includes('sterling') ||
    k.includes('diplomata_gold') ||
    k.includes('diplomata-pivotante') || k.includes('diplomata_pivotante') ||
    /painel[_-]?v(2|3|4)/.test(k)
  );
}

/** Hard map models to their section. Extend keys as needed. */
function classifyModelGroupByKey(key: string, label: string) {
  const k = key.toLowerCase();
  const l = label.toLowerCase();

  // Portas de Abrir: Sterling + Diplomata Gold + Diplomata Pivotante + Painel v2/v3/v4
  if (
    k.includes('sterling') ||
    k.includes('diplomata_gold') ||
    k.includes('diplomata-pivotante') || k.includes('diplomata_pivotante') || l.includes('pivotante') ||
    /painel[_-]?v(2|3|4)/.test(k)
  ) return 'Portas de Abrir';

  // Portas Dobraveis: Fole + FoleAP
  if (k.includes('foleap') || k.includes('fole_ap') || l.includes('fole ap') || k.includes('fole')) {
    return 'Portas Dobraveis';
  }

  // Fixos: Painel Fixo + Painel Goldstar
  if (k.includes('painel_fixo') || l.includes('painel fixo') || k.includes('painel_goldstar') || l.includes('painel goldstar')) {
    return 'Fixos';
  }

  // Everything else -> Portas de Correr
  return 'Portas de Correr';
}

const GROUP_ORDER = ['Portas de Abrir', 'Portas de Correr', 'Portas Dobraveis', 'Fixos'];

const groupedModels = React.useMemo(() => {
  const list = (catalog?.MODEL ?? []) as CatItem[];
  const map = new Map<string, CatItem[]>();
  for (const m of list) {
    const g = classifyModelGroupByKey(m.value, m.label);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(m);
  }
  for (const arr of map.values()) {
    arr.sort((a,b) => {
      if (a.order != null && b.order != null) return a.order - b.order;
      return a.label.localeCompare(b.label,'pt');
    });
  }
  // keep the groups in the exact order above and omit unknowns
  const ordered = new Map<string, CatItem[]>();
  for (const g of GROUP_ORDER) {
    if (map.has(g)) ordered.set(g, map.get(g)!);
  }
  return ordered;
}, [catalog]);

const fileInputRef = React.useRef<HTMLInputElement>(null);

React.useEffect(() => {
  if (!modelKey || !rule) return;

  if (rule.hideHandles) {
    form.setValue('handleKey', undefined, { shouldDirty:true });
    return;
  }

  const curr = form.getValues('handleKey');
  if (!curr || curr === '') {
    const def = isAbrirModel(modelKey) ? 'h4' : 'h6';
    form.setValue('handleKey', def, { shouldDirty:true });
  }
}, [modelKey, rule]);
  return (
  <main className="mx-auto max-w-6xl p-6 md:p-8">
    {/* Top bar with simulator logo (left) */}
    <div className="mb-5 flex items-center gap-4">
      <Image
        src="/brand/logo-simulador_dark.png"
        alt="Goldstar Simulator"
        width={220}
        height={48}
        priority
        className="h-[120px] w-auto"
      />
      <div className="ml-auto text-sm text-neutral-500">
        {/* space for help text if needed */}
      </div>
    </div>

    {/* Card container with Goldstar glow */}
    <section
      className="rounded-2xl bg-white"
      style={{ boxShadow: '0 0 18px 1px rgba(192,134,37,0.18)' }}
    >
      {/* Heading */}
      <div className="border-b border-neutral-200 px-6 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Pedir Orçamento
        </h1>
      </div>

      <div className="px-6 py-6 space-y-8">
        {/* 2-column: Dados do Cliente + Modelo & Opções */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Dados do Cliente */}
          <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <h2 className="mb-3 text-lg font-medium text-neutral-900">Dados do Cliente</h2>

            <div className="space-y-3">
              <Text f={form} name="name" label="Nome *" />
              <Text f={form} name="email" label="Email *" type="email" />
              <Text f={form} name="phone" label="Telefone" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Text f={form} name="nif" label="NIF" />
                <Text f={form} name="postalCode" label="Código Postal *" />
                <Text f={form} name="city" label="Cidade *" />
              </div>
              <Text f={form} name="address" label="Morada *" />
            </div>
          </section>

          {/* Modelo & Opções */}
          <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <h2 className="mb-3 text-lg font-medium text-neutral-900">Modelo & Opções</h2>

            <div className="space-y-3">
              {/* Modelo */}
              <FieldWrap label="Modelo *" error={form.formState.errors?.['modelKey']?.message as string | undefined}>
                <Controller
                  name="modelKey"
                  control={form.control}
                  render={({ field }) => (
                    <select {...field} className="w-full border rounded px-3 py-2 bg-white">
                      {[...groupedModels.entries()].map(([group, items]) => (
                        <optgroup key={group} label={group}>
                          {items.map((m, i) => (
                            <option key={`${m.value}-${i}`} value={m.value}>{m.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                />
              </FieldWrap>

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

              <Select f={form} name="complemento" label="Complemento *" options={complemento} />

              {comp === 'vision' && (
                <>
                  <Select f={form} name="barColor"      label="Cor da Barra Vision *" options={barColors} />
                  <Select f={form} name="visionSupport" label="Cor de Suporte *"      options={finishes} />
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
                  label="Cor da Serigrafia*"
                  options={[
                    { value: 'padrao',     label: 'Padrão' },
                    { value: 'acabamento', label: 'Cor do Acabamento' },
                  ]}
                />
              )}
            </div>
          </section>
        </div>

        {/* Below: single-row sections (unchanged logic, styled) */}
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-3 text-lg font-medium text-neutral-900">Medidas</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <NumField f={form} name="widthMm" label="Largura (cm)" />
            <NumField f={form} name="heightMm" label="Altura (cm)" />
            <NumField f={form} name="depthMm" label="Profundidade (cm)" />
          </div>
          <div className="mt-2">
            <Checkbox f={form} name="willSendLater" label="Enviarei as medidas mais tarde" />
            <p className="mt-1 text-xs text-neutral-600">
              Se não indicar as medidas agora, poderá enviá-las depois. Pelo menos largura e altura são necessárias.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-3 text-lg font-medium text-neutral-900">Entrega / Instalação</h2>
          <Select
            f={form}
            name="deliveryType"
            label="Tipo de Entrega *"
            options={[
              { value: 'entrega', label: 'Entrega' },
              { value: 'instalacao', label: 'Entrega + Instalação (custo adicional)' },
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Text f={form} name="housingType" label="Tipo de Habitação" />
            <NumField f={form} name="floorNumber" label="Andar" />
            <Checkbox f={form} name="hasElevator" label="Tem elevador?" />
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-0 text-lg font-medium text-neutral-900">Fotos do espaço</h2>
          <p className="mb-2 text-lg">Por forma a facilitar o processo, carregue algumas fotos do espaço onde quer instalar o seu resguardo.</p>
          {/* Hidden input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={onUploadFiles}
            className="hidden"
          />

          {/* Icon-only upload button (no text) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Carregar fotos"
            title="Carregar fotos"
            disabled={uploading}
            className="inline-grid place-items-center h-12 w-12 rounded-full bg-black text-white
                      hover:bg-black/90 disabled:opacity-60
                      focus:outline-none focus:ring-2 focus:ring-yellow-400/50
                      shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]"
          >
            {/* Upload icon (SVG) */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </button>

          {/* Thumbnails (images only, no text) */}
          <div className="mt-3">
            <Thumbs urls={form.watch('photoUrls') ?? []} />
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-3 text-lg font-medium text-neutral-900">Observações</h2>
          <Textarea f={form} name="notes" label="Notas adicionais" rows={4} />
        </section>

        <div className="pt-2">
          <button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            className="h-11 rounded-xl bg-black px-6 text-[15px] font-semibold text-white hover:bg-black/90
                       focus:outline-none focus:ring-2 focus:ring-yellow-400/50
                       shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]"
          >
            Enviar Orçamento
          </button>
        </div>
      </div>
    </section>
  </main>
);
}

/* ---------- tiny form primitives (no UI libs) ---------- */

function FieldWrap({ label, error, children }: { label?: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      {label && <span className="block text-sm mb-1">{label}</span>}
      {children}
      {error ? <span className="block text-xs text-red-600 mt-1">{error}</span> : null}
    </label>
  );
}

function Text({ f, name, label, type = 'text' }:{ f:any; name:string; label?:string; type?:string }) {
  const { register, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <input type={type} {...register(name)} className="w-full border rounded px-3 py-2" />
    </FieldWrap>
  );
}

function NumField({ f, name, label }:{ f:any; name:string; label?:string }) {
  const { register, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <input type="number" {...register(name)} className="w-full border rounded px-3 py-2" />
    </FieldWrap>
  );
}

function Textarea({ f, name, label, rows=3 }:{ f:any; name:string; label?:string; rows?:number }) {
  const { register, formState:{ errors } } = f;
  return (
    <FieldWrap label={label} error={errors?.[name]?.message as string | undefined}>
      <textarea rows={rows} {...register(name)} className="w-full border rounded px-3 py-2" />
    </FieldWrap>
  );
}

function Checkbox({ f, name, label }:{ f:any; name:string; label?:string }) {
  const { register } = f;
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" {...register(name)} />
      <span>{label}</span>
    </label>
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
            // normalize '' → undefined for optional schemas
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
      {urls.map(u => (
        <a key={u} href={u} target="_blank" className="block w-24 h-24 border rounded overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}

export default function NewBudgetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-600">A carregar…</div>}>
      <BudgetFormPageInner />
    </Suspense>
  );
}