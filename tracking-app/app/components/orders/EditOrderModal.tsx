'use client';
import React from 'react';

type UploadInfo = { url: string; name: string; size: number; mime?: string };
type Opt = { value: string; label: string; order?: number; category?: string | null };
type Catalog = Record<string, Opt[]>;
type ModelRuleDTO = {
  hideHandles?: boolean;
  removeFinishes?: string[];
  allowAcrylicAndPoly?: boolean;
  allowTowel1?: boolean;
  hasFixingBar?: boolean;
};

function isPainelV234(key?: string) {
  if (!key) return false;
  return /painel[_-]?v(2|3|4)\b/i.test(key.toLowerCase());
}
function uniqByValue(items: Opt[]) {
  const seen = new Set<string>(); const out: Opt[] = [];
  for (const it of items) { if (!seen.has(it.value)) { seen.add(it.value); out.push(it); } }
  return out;
}
function ensureSelected(opts: Opt[], selected?: string, selectedLabel = 'Selecionado') {
  if (!selected) return opts;
  const has = opts.some((o) => o.value === selected);
  return has ? opts : [{ value: selected, label: selectedLabel }, ...opts];
}
async function uploadFile(f: File): Promise<UploadInfo> {
  const fd = new FormData();
  fd.append('file', f);
  const r = await fetch('/api/uploads', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Upload falhou');
  return r.json();
}


// Normalize model string ("diplomatagold_v1", "Diplomata Gold V1") → "DiplomataGold_V1"
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

// -------------------------------------------------
// Helpers reused from other files: canon + Turbo detector
// -------------------------------------------------
function canon(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // strip accents
    .replace(/[\s-]+/g, '_')             // spaces & hyphens → underscores
    .replace(/_+/g, '_')                 // collapse multiple underscores
    .trim();
}

const TURBO_MODEL_KEY = 'turbo_v1';

function isTurboModelKey(key?: string | null) {
  if (!key) return false;
  return canon(key ?? '') === TURBO_MODEL_KEY;
}

function simModelParamFromKey(input: string | undefined) {
  if (!input) return '';
  const s = input.replace(/-/g, '_').replace(/\s+/g, '_').trim();
  const m = s.match(/^(.*?)(?:_)?v(\d+)$/i);
  let base = (m ? m[1] : s).replace(/_/g, '');
  const v = m ? m[2] : undefined;

  const lower = base.toLowerCase();
  const canonical =
    MODEL_CANON[lower] ??
    base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();

  return v ? `${canonical}_V${v}` : canonical;
}

// normalize complements from API (string or array) to string[]
const parseCompsInput = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(String).map(s => s.trim().toLowerCase()).filter(Boolean).filter(c => c !== 'nenhum');
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).filter(c => c !== 'nenhum');
  }
  return [];
};

export function EditOrderModal({
  order,
  onClose,
  onSaved,
}: {
  order: {
    id: string;
    client: {
      name: string;
      email: string;
      phone?: string | null;
      address?: string | null;
      postal?: string | null;
      city?: string | null;
    };
    details: {
      model?: string;
      handleKey?: string;
      finish?: string;
      glassTypeKey?: string;
      acrylic?: string;
      serigraphy?: string;
      serigrafiaColor?: string;
      complements?: string;
      barColor?: string;
      visionSupport?: string;
      towelColorMode?: string;
      shelfColorMode?: string;
      fixingBarMode?: string;
      shelfHeightPct?: number | null;   

    };
    // optional delivery (if your loader added it)
    delivery?: {
      deliveryType?: string | null;
      housingType?: string | null;
      floorNumber?: number | null;
      hasElevator?: boolean | null;
    };
    files: UploadInfo[];
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  // ------- catalog once -------
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [rule, setRule] = React.useState<ModelRuleDTO | null>(null);

  React.useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/catalog', { cache: 'no-store' });
        if (!r.ok) throw new Error('fail');
        const data = (await r.json()) as Catalog;
        if (live) setCatalog(data);
      } catch {
       setCatalog({} as Catalog);
      }
    })();
    return () => { live = false; };
  }, []);

  // ------- local form state -------
  const [client, setClient] = React.useState({
    name: order.client.name ?? '',
    email: order.client.email ?? '',
    phone: order.client.phone ?? '',
    address: order.client.address ?? '',
    postal: order.client.postal ?? '',
    city: order.client.city ?? '',
  });

  const [details, setDetails] = React.useState({
    model: order.details.model ?? '',
    handleKey: order.details.handleKey ?? '',
    finish: order.details.finish ?? '',
    glassTypeKey: order.details.glassTypeKey ?? '',
    acrylic: order.details.acrylic ?? '',
    serigraphy: order.details.serigraphy ?? 'nenhum',
    serigrafiaColor: order.details.serigrafiaColor ?? '',
    complements: parseCompsInput(order.details.complements),
    barColor: order.details.barColor ?? '',
    visionSupport: order.details.visionSupport ?? '',
    towelColorMode: order.details.towelColorMode ?? '',
    shelfColorMode: order.details.shelfColorMode ?? '',
    fixingBarMode: order.details.fixingBarMode ?? '',
    shelfHeightPct: order.details.shelfHeightPct ?? null,  

  });

  // --- measures: initialize and keep in sync if `order` prop updates ---
     // --- measures: initialize and keep in sync if `order` prop updates ---
  const _orderAny = order as any;
  // --- measures: robust extraction from multiple shapes (order | forModal | details | items[0].customizations) ---
  const extractMm = (maybe: any) => {
    if (maybe === null || maybe === undefined) return null;
    if (typeof maybe === 'object') {
      // handle { value: X } or { mm: X } or string-like wrappers
      if ('mm' in maybe) maybe = maybe.mm;
      else if ('value' in maybe) maybe = maybe.value;
      else if (typeof maybe.toString === 'function') maybe = String(maybe);
    }
    const n = typeof maybe === 'number' ? maybe : Number(String(maybe).replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n) : null;
  };

  const lookups = [
    (o: any) => o,                            // top-level order
    (o: any) => o.forModal,                   // maybe passed as full api and we received forModal under it
    (o: any) => o.forModal?.details,          // nested details
    (o: any) => o.details,                    // top-level details
    (o: any) => o.items?.[0],                 // first item (synthetic details item)
    (o: any) => o.items?.[0]?.customizations, // legacy customizations
    (o: any) => o.items?.[0]?.details,        // uncommon but safe
  ];

  function findField(ord: any, field: 'widthMm' | 'heightMm' | 'depthMm') {
    for (const get of lookups) {
      const candidate = get(ord);
      if (!candidate) continue;
      // direct field
      if (field in candidate) {
        const v = extractMm((candidate as any)[field]);
        if (v != null) return v;
      }
      // sometimes stored as width/height/depth (no Mm suffix)
      const alt = field.replace('Mm', '');
      if (alt in candidate) {
        const v = extractMm((candidate as any)[alt]);
        if (v != null) return v;
      }
      // customizations object inside details/item
      if (candidate?.customizations && (candidate.customizations[field] !== undefined)) {
        const v = extractMm(candidate.customizations[field]);
        if (v != null) return v;
      }
      if (candidate?.customizations && (candidate.customizations[alt] !== undefined)) {
        const v = extractMm(candidate.customizations[alt]);
        if (v != null) return v;
      }
    }
    return null;
  }

  const initialWidthMm = findField(order, 'widthMm');
  const initialHeightMm = findField(order, 'heightMm');
  const initialDepthMm = findField(order, 'depthMm');

  const [measures, setMeasures] = React.useState({
    widthCm: initialWidthMm ? String(initialWidthMm / 10) : '',
    heightCm: initialHeightMm ? String(initialHeightMm / 10) : '',
    depthCm: initialDepthMm ? String(initialDepthMm / 10) : '',
  });

  // keep in sync on order changes (handles async loader updates)
// keep in sync on order changes (handles async loader updates)
// keep in sync on order changes (handles async loader updates)
React.useEffect(() => {
  const w = findField(order as any, 'widthMm');
  const h = findField(order as any, 'heightMm');
  const d = findField(order as any, 'depthMm');

  // If we already have values, set and return
  if (w || h || d) {
    setMeasures({
      widthCm: w ? String(w / 10) : '',
      heightCm: h ? String(h / 10) : '',
      depthCm: d ? String(d / 10) : '',
    });
    console.debug('EditOrderModal - measure sync (found locally)', { w, h, d });
    return;
  }

  // Otherwise, attempt to fetch canonical order from the API as a robust fallback.
  // This covers cases where the parent passed a trimmed object or a "forModal" wrapper.
  let abort = false;
  (async () => {
    try {
      console.debug('EditOrderModal - measure sync: no local measures, fetching /api/orders/:id fallback', { orderId: (order as any)?.id });
      if (!(order as any)?.id) {
        console.debug('EditOrderModal - measure sync: no order.id present, aborting fetch fallback');
        return;
      }
      const res = await fetch(`/api/orders/${encodeURIComponent((order as any).id)}`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn('EditOrderModal - fallback fetch failed', await res.text());
        return;
      }
      const data = await res.json();
      if (abort) return;

      // Try multiple shapes: top-level, forModal.details, items[0].customizations
      const candidates = [
        data,                          // full api response
        data.forModal,                 // sometimes parent returns forModal as root
        data.forModal?.details,        // inside forModal
        data.items?.[0]?.customizations,
        data.items?.[0],
        data.details,
      ];

      let fw: number | null = null;
      let fh: number | null = null;
      let fd: number | null = null;

      for (const c of candidates) {
        if (!c) continue;
        const tryW = extractMm((c as any).widthMm ?? (c as any).width);
        const tryH = extractMm((c as any).heightMm ?? (c as any).height);
        const tryD = extractMm((c as any).depthMm ?? (c as any).depth);
        if (tryW != null && fw == null) fw = tryW;
        if (tryH != null && fh == null) fh = tryH;
        if (tryD != null && fd == null) fd = tryD;
        // stop early if all found
        if (fw != null && fh != null && fd != null) break;
      }

      if (fw || fh || fd) {
        setMeasures({
          widthCm: fw ? String(fw / 10) : '',
          heightCm: fh ? String(fh / 10) : '',
          depthCm: fd ? String(fd / 10) : '',
        });
        console.debug('EditOrderModal - measure sync (from fallback API)', { fw, fh, fd, candidatesPreview: { top: data.widthMm ?? null, forModal: data.forModal?.details ?? null } });
      } else {
        console.debug('EditOrderModal - measure sync fallback: no measures found in API response', { candidatesPreview: { top: data.widthMm ?? null, forModal: data.forModal?.details ?? null } });
      }
    } catch (err) {
      console.warn('EditOrderModal - measure sync fallback error', err);
    }
  })();

  return () => { abort = true; };
}, [order]);
  function toggleComplement(value: string) {
  setDetails((d) => {
    const set = new Set(d.complements);
    if (set.has(value)) set.delete(value);
    else set.add(value);

    const list = [...set];
    const next: any = { ...d, complements: list };

    if (!list.includes('vision')) {
      next.barColor = '';
      next.visionSupport = '';
    }
    if (!list.includes('toalheiro1')) {
      next.towelColorMode = '';
    }
    if (!list.includes('prateleira')) {
      next.shelfColorMode = '';
      next.shelfHeightPct = null;
    } else if (next.shelfHeightPct == null) {
      next.shelfHeightPct = 100;
    }

    return next;
  });
}

  // NEW: delivery local state (prefill if provided)
  const [delivery, setDelivery] = React.useState({
    deliveryType: order.delivery?.deliveryType ?? 'entrega',
    housingType: order.delivery?.housingType ?? '',
    floorNumber: typeof order.delivery?.floorNumber === 'number' ? order.delivery!.floorNumber : null,
    hasElevator: typeof order.delivery?.hasElevator === 'boolean' ? !!order.delivery!.hasElevator : false,
  });

  // When model changes, (re)load rule
  React.useEffect(() => {
    if (!details.model) { setRule(null); return; }
    (async () => {
      const r = await fetch(`/api/model-rules/${encodeURIComponent(details.model)}`, { cache: 'no-store' });
      if (r.ok) setRule(await r.json());
      else setRule(null);
    })();
  }, [details.model]);

  // derived options from catalog
  const models       = React.useMemo(() => catalog?.MODEL ?? [], [catalog]);
  const handles      = React.useMemo(() => (catalog?.HANDLE ?? []).filter(h => h.value !== '-' && h.value !== ''), [catalog]);
  const finMetal     = React.useMemo(() => catalog?.FINISH_METALICO ?? [], [catalog]);
  const finLacado    = React.useMemo(() => catalog?.FINISH_LACADO ?? [], [catalog]);
  const finishes     = React.useMemo(() => {
    const all = [...finMetal, ...finLacado];
    if (!rule?.removeFinishes?.length) return all;
    const rm = new Set(rule.removeFinishes.map((v) => v.toLowerCase()));
    return all.filter((f) => !rm.has((f.value ?? '').toLowerCase()));
  }, [finMetal, finLacado, rule]);

  const glassTipos   = React.useMemo(() => catalog?.GLASS_TIPO ?? [], [catalog]);
  const monos        = React.useMemo(() => catalog?.MONOCROMATICO ?? [], [catalog]);
  const acrylics     = React.useMemo(() => catalog?.ACRYLIC_AND_POLICARBONATE ?? [], [catalog]);

  const serPrime     = React.useMemo(() => catalog?.SERIGRAFIA_PRIME ?? [], [catalog]);
  const serQuadros   = React.useMemo(() => catalog?.SERIGRAFIA_QUADROS ?? [], [catalog]);
  const serElo       = React.useMemo(() => catalog?.SERIGRAFIA_ELO_SERENO ?? [], [catalog]);
  const serigrafias  = React.useMemo(
    () => uniqByValue([...(serPrime ?? []), ...(serQuadros ?? []), ...(serElo ?? [])]),
    [serPrime, serQuadros, serElo]
  );

  const complements  = React.useMemo(() => catalog?.COMPLEMENTO ?? [], [catalog]);
  const vbarColors   = React.useMemo(() => catalog?.VISION_BAR_COLOR ?? [], [catalog]);

  const showAcrylic  = !!rule?.allowAcrylicAndPoly;
  const showFixBar   = !!rule?.hasFixingBar;
  const allowTowel1  = !!rule?.allowTowel1;
  const hideHandles  = !!rule?.hideHandles;

const simModelParam = React.useMemo(
  () => simModelParamFromKey(details.model),
  [details.model]
);

const simulatorUrl = React.useMemo(() => {
  if (!simModelParam) return 'https://simulador.mfn.pt/';

  const params = new URLSearchParams();
  params.set('model', simModelParam);

  // Acabamento
  if (details.finish) {
    params.set('finish', details.finish);
  }

  // Vidro / Monocromático (fix mono_*)
  if (details.glassTypeKey) {
    let glassToken = details.glassTypeKey;
    if (glassToken.startsWith('mono_')) {
      glassToken = glassToken.replace(/^mono_/, '');
    }
    params.set('glass', glassToken);
  }

  // Puxador
  if (!hideHandles && details.handleKey) {
    params.set('handle', details.handleKey);
  }

  const comps = details.complements ?? [];
  if (comps.length) {
    params.set('complementos', comps.join(','));
    params.set('complemento', comps[0]); // legacy fallback
  }

  // Vision
  if (comps.includes('vision')) {
    if (details.barColor) params.set('barColor', details.barColor);
    if (details.visionSupport) params.set('visionSupport', details.visionSupport);
  }

  // Toalheiro 1
  if (comps.includes('toalheiro1') && details.towelColorMode) {
    params.set('towel', details.towelColorMode);
  }

  // Prateleira
  if (comps.includes('prateleira')) {
    if (details.shelfColorMode) params.set('shelf', details.shelfColorMode);
    if (details.shelfHeightPct != null) {
      params.set('altura', String(Math.round(details.shelfHeightPct)));
    }
  }



  // Barra de fixação
  if (showFixBar && details.fixingBarMode) {
    params.set('fixingBarMode', details.fixingBarMode);
  }

  // Acrílico
  if (details.acrylic && details.acrylic !== 'nenhum') {
    params.set('acrylic', details.acrylic);
  }

  // Serigrafia
  if (details.serigraphy && details.serigraphy !== 'nenhum') {
    params.set('serigrafia', details.serigraphy);
    if (details.serigrafiaColor) {
      params.set('serigrafiaColor', details.serigrafiaColor);
    }
  }
  return `https://simulador.mfn.pt/?${params.toString()}`;
}, [simModelParam, details, hideHandles, showFixBar]);

  // If model is empty once models load, select first
  React.useEffect(() => {
    if (!details.model && models.length) {
      setDetails((d) => ({ ...d, model: models[0].value }));
    }
  }, [models]); // one-time after load

  // ------- files -------
  const [files, setFiles] = React.useState<UploadInfo[]>(order.files ?? []);
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const up = await uploadFile(f);
    setFiles((prev) => [...prev, up]);
    e.target.value = '';
  }
  function removeFile(name: string) {
    setFiles((prev) => prev.filter((x) => x.name !== name));
  }

  // ------- save -------
  const [saving, setSaving] = React.useState(false);
  const comps = details.complements.length ? details.complements : null;

  async function submit() {
    setSaving(true);
    
  const toMm = (cmStr?: string) => {
    if (cmStr == null) return null;
    const n = Number(String(cmStr).replace(',', '.'));
    if (!n || Number.isNaN(n)) return null;
    return Math.round(n * 10);
  };

  const measuresPayload = {
    widthMm: toMm(measures.widthCm),
    heightMm: toMm(measures.heightCm) ?? (isTurboModelKey(details.model) ? 1785 : null),
    depthMm: toMm(measures.depthCm),
  };
    try {
      const r = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          client: {
            name:  client.name || undefined,
            email: client.email || undefined,
            phone: client.phone || undefined,
            address: client.address || undefined,
            postal: client.postal || undefined,
            city: client.city || undefined,
          },
          details: {
            model: details.model,
            handleKey: hideHandles ? undefined : details.handleKey,
            finish: details.finish,

            // single key for glass: can come from GLASS_TIPO or MONOCROMATICO
            glassTypeKey: details.glassTypeKey || null,

            acrylic: showAcrylic ? (details.acrylic || null) : null,
            serigraphy: details.serigraphy || null,
            serigrafiaColor: details.serigraphy !== 'nenhum' ? (details.serigrafiaColor || 'padrao') : null,

              complements: comps,

              barColor: comps?.includes('vision') ? (details.barColor || null) : null,
              visionSupport: comps?.includes('vision') ? (details.visionSupport || null) : null,

              towelColorMode: comps?.includes('toalheiro1')
                ? (details.towelColorMode || null)
                : null,

              shelfColorMode: comps?.includes('prateleira')
                ? (details.shelfColorMode || null)
                : null,

              shelfHeightPct: comps?.includes('prateleira')
                ? (details.shelfHeightPct ?? null)
                : null,
            fixingBarMode: showFixBar ? (details.fixingBarMode || null) : null,
          },
          ...measuresPayload,
          delivery: {
            deliveryType: delivery.deliveryType || null,
            housingType:  delivery.housingType  || null,
            floorNumber:  delivery.floorNumber  ?? null,
            hasElevator:  typeof delivery.hasElevator === 'boolean' ? delivery.hasElevator : null,
          },
          files,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e?.message ?? 'Falha ao guardar');
    } finally {
      setSaving(false);
    }
  }

  // ------- tiny inputs -------
  const Input = ({
    label, ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div className="space-y-1">
      <label className="text-sm text-foreground">{label}</label>
      <input
        {...props}
        className={`w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring ${props.className ?? ''}`}
      />
    </div>
  );

  function Select({
    label, value, onChange, options,
  }: { label: string; value: string; onChange: (v: string) => void; options: Opt[] }) {
    return (
      <div className="space-y-1">
        <label className="text-sm text-foreground">{label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
        >
          {options.map((o) => (
            <option key={`${o.category ?? ''}-${o.value}`} value={o.value}>
              {o.category ? `${o.category} — ${o.label}` : o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div
      onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      aria-modal role="dialog"
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
  <div>
    <h3 className="text-2xl font-semibold">Alterar Pedido</h3>
    <p className="text-sm text-muted-foreground">
      Edita os dados do cliente e os detalhes do produto.
    </p>
    </div>

    <div className="flex items-center gap-3">
      {simModelParam && (
        <a
          href={simulatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Ver no simulador
        </a>
      )}
      <button
        className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted/50"
        onClick={onClose}
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Col 1 — Cliente */}
            <section className="space-y-3">
              <h4 className="text-base font-medium">Dados do cliente</h4>
              <Input label="Nome *" placeholder="Ex.: João Silva" value={client.name}
                     onChange={(e) => setClient({ ...client, name: e.target.value })} />
              <Input label="Email *" placeholder="Ex.: cliente@exemplo.pt" value={client.email}
                     onChange={(e) => setClient({ ...client, email: e.target.value })} />
              <Input label="Telefone" placeholder="Ex.: 912 345 678" value={client.phone ?? ''} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
              <Input label="Código Postal" placeholder="Ex.: 3810-123" value={client.postal ?? ''} onChange={(e) => setClient({ ...client, postal: e.target.value })} />
              <div className="space-y-1">
                <label className="text-sm text-foreground">Localidade</label>
                <input className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                       placeholder="Ex.: Aveiro" value={client.city ?? ''} onChange={(e) => setClient({ ...client, city: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-foreground">Morada</label>
                <textarea className="h-28 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Ex.: Rua, nº, andar…" value={client.address ?? ''} onChange={(e) => setClient({ ...client, address: e.target.value })} />
              </div>
            </section>

            {/* Col 2 — Produto */}
            <section className="space-y-3">
              <h4 className="text-base font-medium">Detalhes do produto</h4>

              {/* Modelo */}
              <Select
                label="Modelo *"
                value={details.model}
                onChange={(v) => setDetails({ ...details, model: v })}
                options={ensureSelected(models, details.model)}
              />

              {/* Puxador */}
              {!hideHandles && (
                <Select
                  label="Puxador"
                  value={details.handleKey}
                  onChange={(v) => setDetails({ ...details, handleKey: v })}
                  options={ensureSelected(
                    (isPainelV234(details.model) ? handles : handles.filter(h => h.value !== 'sem')),
                    details.handleKey
                  )}
                />
              )}

              {/* Acabamento */}
              <Select
                label="Acabamento *"
                value={details.finish}
                onChange={(v) => setDetails({ ...details, finish: v })}
                options={ensureSelected(finishes, details.finish)}
              />

              {/* Fixing bar (rule) */}
              {showFixBar && (
                <Select
                  label="Barra de fixação *"
                  value={details.fixingBarMode}
                  onChange={(v) => setDetails({ ...details, fixingBarMode: v })}
                  options={[
                    { value: 'padrao', label: 'Padrão' },
                    { value: 'acabamento', label: 'Cor do acabamento' },
                  ]}
                />
              )}

              {/* Vidro / Monocromático */}
              <Select
                label="Vidro / Monocromático *"
                value={details.glassTypeKey}
                onChange={(v) => setDetails({ ...details, glassTypeKey: v })}
                options={ensureSelected([...(glassTipos ?? []), ...(monos ?? [])], details.glassTypeKey)}
              />

              {/* Acrílico (rule) */}
              {showAcrylic && (
                <Select
                  label="Acrílico / Policarbonato"
                  value={details.acrylic}
                  onChange={(v) => setDetails({ ...details, acrylic: v })}
                  options={ensureSelected(acrylics, details.acrylic)}
                />
              )}

              {/* Complemento */}
              <div className="space-y-2">
                <label className="text-sm text-foreground">Complementos *</label>
                <div className="grid grid-cols-2 gap-2">
                  {complements.filter(o => o.value !== 'nenhum').map((o) => {
                    const checked = details.complements.includes(o.value);
                    return (
                      <label key={o.value} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleComplement(o.value)}
                        />
                        <span>{o.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Vision-only */}
              {details.complements.includes('vision') && (
                <>
                  <Select
                    label="Cor da Barra Vision *"
                    value={details.barColor}
                    onChange={(v) => setDetails({ ...details, barColor: v })}
                    options={ensureSelected(vbarColors, details.barColor)}
                  />
                  <Select
                    label="Cor de Suporte *"
                    value={details.visionSupport}
                    onChange={(v) => setDetails({ ...details, visionSupport: v })}
                    options={ensureSelected(finishes, details.visionSupport)}
                  />
                </>
              )}

              {/* Toalheiro 1 */}
              {allowTowel1 && details.complements.includes('toalheiro1') && (
                <Select
                  label="Cor do toalheiro *"
                  value={details.towelColorMode}
                  onChange={(v) => setDetails({ ...details, towelColorMode: v })}
                  options={[
                    { value: 'padrao', label: 'Padrão (Cromado)' },
                    { value: 'acabamento', label: 'Cor do Acabamento' },
                  ]}
                />
              )}

              {details.complements.includes('prateleira') && (
                <>
                  <Select
                    label="Cor do suporte Prateleira *"
                    value={details.shelfColorMode}
                    onChange={(v) => setDetails({ ...details, shelfColorMode: v })}
                    options={[
                      { value: 'padrao', label: 'Padrão' },
                      { value: 'acabamento', label: 'Cor do Acabamento' },
                    ]}
                  />

                  {/* slider like budgets */}
                  <div className="space-y-1">
                    <label className="text-sm text-foreground">
                      Altura da prateleira ({details.shelfHeightPct ?? 100}%)
                    </label>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={1}
                      value={details.shelfHeightPct ?? 100}
                      onChange={(e) =>
                        setDetails({
                          ...details,
                          shelfHeightPct: Number(e.target.value),
                        })
                      }
                      className="w-full"
                    />
                  </div>
                </>
              )}

              {/* Serigrafia + Cor */}
              <Select
                label="Serigrafia"
                value={details.serigraphy}
                onChange={(v) =>
                  setDetails({
                    ...details,
                    serigraphy: v,
                    serigrafiaColor: v === 'nenhum' ? '' : details.serigrafiaColor,
                  })
                }
                options={ensureSelected(serigrafias, details.serigraphy)}
              />
              {details.serigraphy && details.serigraphy !== 'nenhum' && (
                <Select
                  label="Cor da Serigrafia *"
                  value={details.serigrafiaColor}
                  onChange={(v) => setDetails({ ...details, serigrafiaColor: v })}
                  options={[
                    { value: 'padrao', label: 'Padrão' },
                    { value: 'acabamento', label: 'Cor do Acabamento' },
                  ]}
                />
              )}
            </section>
          </div>

          {/* Measures */}
          <div className="space-y-2">
            <label className="text-sm text-foreground">Medidas (cm)</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                className="w-full rounded-xl border border-border bg-surface px-3 py-2"
                placeholder="Largura (cm)"
                value={measures.widthCm}
                onChange={(e) => setMeasures(m => ({ ...m, widthCm: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-border bg-surface px-3 py-2"
                placeholder="Altura (cm)"
                value={measures.heightCm}
                onChange={(e) => setMeasures(m => ({ ...m, heightCm: e.target.value }))}
              />
              <input
                className="w-full rounded-xl border border-border bg-surface px-3 py-2"
                placeholder="Profundidade (cm)"
                value={measures.depthCm}
                onChange={(e) => setMeasures(m => ({ ...m, depthCm: e.target.value }))}
              />
            </div>
            {isTurboModelKey(details.model) && (
              <div className="text-xs text-neutral-500">Turbo: altura recomendada 178.5 cm (será aplicada se não preencher).</div>
            )}
          </div>

          {/* DADOS DE ENTREGA */}
          <section className="rounded-2xl border border-border bg-card/60 p-4 mt-6">
            <h3 className="text-base font-semibold mb-3">Dados de Entrega</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-sm mb-1">Tipo de Entrega *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={delivery.deliveryType}
                  onChange={(e) => setDelivery({ ...delivery, deliveryType: e.target.value })}
                >
                  <option value="entrega">Entrega</option>
                  <option value="entrega_instalacao">Entrega + Instalação</option>
                </select>
              </div>
              <Input
                label="Tipo de Habitação"
                value={delivery.housingType}
                onChange={(e) => setDelivery({ ...delivery, housingType: e.target.value })}
              />
              <Input
                label="Andar"
                type="number"
                value={delivery.floorNumber == null ? '' : String(delivery.floorNumber)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setDelivery({ ...delivery, floorNumber: v === '' ? null : Number(v) });
                }}
              />
              <div className="flex items-end">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!delivery.hasElevator}
                    onChange={(e) => setDelivery({ ...delivery, hasElevator: e.target.checked })}
                  />
                  Tem elevador?
                </label>
              </div>
            </div>
          </section>

          {/* Files */}
          <section className="mt-8">
            <h4 className="text-base font-medium">Ficheiros técnicos</h4>
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-muted/60">
                Carregar novo
                <input type="file" className="hidden" onChange={onPickFile}
                       accept=".pdf,.png,.jpg,.jpeg,.svg,.dxf,.ai,.psd,.doc,.docx,.xls,.xlsx" />
                <span className="ml-2">⬆</span>
              </label>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {files.length === 0 ? (
                <li className="text-muted-foreground">Nenhum ficheiro carregado.</li>
              ) : (
                files.map((f) => (
                  <li key={`${f.url}-${f.name}`} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{f.name}</div>
                      {f.size ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {(f.size / 1024).toFixed(1)} KB {f.mime ? `• ${f.mime}` : ''}
                        </div>
                      ) : null}
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {f.url && (
                        <button title="Abrir noutro separador" className="rounded-lg px-2 py-1 text-primary hover:bg-primary/10" onClick={() => window.open(f.url, '_blank')}>
                          👁️
                        </button>
                      )}
                      <button title="Remover" className="rounded-lg px-2 py-1 text-danger hover:bg-danger/10" onClick={() => removeFile(f.name)}>✕</button>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-white/80 px-6 py-4">
          <button className="rounded-xl px-4 py-2 text-muted-foreground hover:bg-muted/60" onClick={onClose}>Cancelar</button>
          <button
            className="rounded-xl bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={submit}
            disabled={saving}
          >
            {saving ? 'A guardar…' : 'Guardar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
