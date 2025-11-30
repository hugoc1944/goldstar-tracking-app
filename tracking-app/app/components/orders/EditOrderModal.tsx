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
/* ========== PREVIEW ICON HELPERS + IconSelect from Orçamentos (paste here) ========== */

const PRE = '/previews';

// --- model stem/icon helpers (robust canonicalization) ---
function capToken(tok: string) {
  return tok.replace(/^(\d*)([a-zA-Z])(.*)$/, (_m, d, c, rest) => `${d}${c.toUpperCase()}${rest.toLowerCase()}`);
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
  const canonical = MODEL_CANON[lower] ?? base
    .split(/(?=[A-Z])/)
    .join('')
    .split(/(\d+|[a-zA-Z]+)/g)
    .filter(Boolean)
    .map(capToken)
    .join('');
  return v ? `${canonical}_V${v}` : canonical;
}
const modelIconSrc = (valueOrLabel: string) => `${PRE}/models/${modelStemFromAny(valueOrLabel)}.png`;

// --- finish icon map ---
const FINISH_FILE_MAP: Record<string, string> = {
  amarelo: "Amarelo", anodizado: "Anodizado", azulclaro: "AzulClaro", azulescuro: "AzulEscuro",
  azulturquesa: "AzulTurquesa", bordeaux: "Bordeaux", branco: "Branco", brancomate: "BrancoMate",
  castanho: "Castanho", cinza: "Cinza", cremelclaro: "CremeClaro", cremeescuro: "CremeEscuro",
  cromado: "Cromado", dourado: "Dourado", gunmetal: "GunMetal", preto: "Preto", pretomate: "PretoMate",
  pretofosco: "PretoFosco", rosa: "Rosa", verdeagua: "VerdeAgua", verdefloresta: "VerdeFloresta", vermelho: "Vermelho",
};
const finishIconSrc = (name: string) => {
  if (!name) return undefined;
  const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s_-]/g, '');
  const stem = FINISH_FILE_MAP[key];
  if (!stem) return undefined;
  return `${PRE}/finishes/${stem}.png`;
};

// --- handles ---
function handleIconSrc(value?: string) {
  if (!value || value === '') return `${PRE}/handles/default.png`;
  if (/^h(\d)$/i.test(value)) return `${PRE}/handles/Handle_${value.replace(/^h/i,'')}.png`;
  if (value.toLowerCase() === 'sem') return `${PRE}/handles/none.png`;
  return `${PRE}/handles/default.png`;
}

// --- glass/acrylic/serigrafia helpers ---
function labelToStem(label: string) {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '');
}
const glassIconSrcFromLabel = (label: string) => `${PRE}/glass/vidros/${labelToStem(label)}.png`;
const acrylicIconSrcFromLabel = (label: string) => `${PRE}/acrylics/${labelToStem(label)}.png`;
function silkIdFrom(value?: string, label?: string) {
  const s = (value || label || '').trim();
  const mSer = s.match(/ser[\s_-]*0*(\d+)/i);
  if (mSer) return `SER${mSer[1].padStart(3,'0')}`;
  const mNamed = s.match(/(Quadro|Elo|Sereno)\s*0*(\d+)/i);
  if (mNamed) { const name = mNamed[1][0].toUpperCase() + mNamed[1].slice(1).toLowerCase(); return `${name}${mNamed[2]}`; }
  // fallback: Pascalize
  return s.replace(/[\s_-]+/g, '').replace(/^\w/, c => c.toUpperCase());
}
const silkIconFromOpt = (opt: { value: string; label: string }) => `${PRE}/glass/silks/${silkIdFrom(opt.value, opt.label)}.png`;

// --- complemento icons + vision bar preview ---
function complementoIconSrc(value: string) {
  const v = value.toLowerCase();
  if (v === 'vision') return `${PRE}/toalheiros/Vision.png`;
  if (v === 'toalheiro1') return `${PRE}/toalheiros/Toalheiro1.png`;
  if (v === 'prateleira') return `${PRE}/shelf/Prateleira.png`;
  return '';
}
function visionBarIconSrc(value: string) {
  const v = (value || '').toLowerCase();
  if (v === 'glass' || v === 'vidro' || v === 'transparente') return `${PRE}/glass/vidros/Transparente.png`;
  if (v === 'white' || v === 'branco' || v === 'branco_mate') return `${PRE}/finishes/BrancoMate.png`;
  if (v === 'black' || v === 'preto' || v === 'preto_mate' || v === 'pretofosco') return `${PRE}/finishes/PretoMate.png`;
  return `${PRE}/finishes/${value ? value.replace(/[\s_-]+/g,'') : ''}.png`;
}

// --- TinyIcon (tries multiple filename-casing variants) ---
function TinyIcon({ src, alt, size = 20 }: { src?: string; alt: string; size?: number }) {
  if (!src) {
    return <span className="inline-block rounded-[6px] bg-neutral-200/70" style={{ width: size, height: size }} aria-hidden />;
  }
  // iterate candidate filename variants (simple approach)
  const exts = ['png','jpg','jpeg','webp'];
  const base = src.replace(/\.(png|jpg|jpeg|webp)$/i, '');
  const variants = [base, base.replace(/_V(\d+)$/,'V$1'), base.toLowerCase(), base.replace(/_/g,'')].flatMap(s => exts.map(e => `${s}.${e}`));
  const [idx, setIdx] = React.useState(0);
  if (idx >= variants.length) {
    return <span className="inline-block rounded-[6px] bg-neutral-200/70" style={{ width: size, height: size }} aria-hidden />;
  }
  const url = variants[idx];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} style={{ width: size, height: size }} className="object-contain rounded-[6px] bg-white" onError={() => setIdx(i => i + 1)} />
  );
}

// --- IconSelect component (interactive dropdown with icons) ---
type IconOption = { value: string; label: string; order?: number };
function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = React.useRef<T | null>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) { if (!ref.current) return; if (!ref.current.contains(e.target as Node)) onOutside(); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onOutside]);
  return ref;
}
function IconSelect({
  value, onChange, options, groups, getIcon, placeholder = '-', disabled, iconSize = 20, itemIconSize = 20,
}:{
  value?: string; onChange:(v:string)=>void; options?: IconOption[]; groups?: Map<string, IconOption[]>; getIcon:(o:IconOption)=>string|undefined;
  placeholder?: string; disabled?: boolean; iconSize?: number; itemIconSize?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [animIn, setAnimIn] = React.useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => closeMenu());
  const flat: IconOption[] = React.useMemo(() => (groups ? Array.from(groups.values()).flat() : (options ?? [])), [groups, options]);
  const current = flat.find(o => o.value === value);
  const canOpen = !disabled && flat.length > 1;
  function openMenu() { if (mounted) return; setMounted(true); requestAnimationFrame(() => setAnimIn(true)); }
  function closeMenu() { if (!mounted) return; setAnimIn(false); }
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeMenu(); }
    if (mounted) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted]);
  const selectItem = (val: string) => { onChange(val); closeMenu(); };

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => { if (!canOpen) return; mounted ? closeMenu() : openMenu(); }}
        className={[ "w-full rounded border bg-white px-3 py-2 flex items-center justify-between gap-2", canOpen ? "cursor-pointer" : "cursor-default" ].join(" ")}>
        <span className="flex items-center gap-2 min-w-0">
          <TinyIcon src={current ? getIcon(current) : undefined} alt={current?.label ?? ''} size={iconSize} />
          <span className="truncate">{current?.label ?? placeholder}</span>
        </span>
        {canOpen && (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.24 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"/>
          </svg>
        )}
      </button>

      {mounted && (
        <div className={[ "absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-[0_8px_24px_rgba(0,0,0,.12)]", "origin-top transition-all duration-150 ease-out", animIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1 scale-[0.98]" ].join(' ')}
             onTransitionEnd={() => { if (!animIn) setMounted(false); }} role="listbox">
          <div className="max-h-72 overflow-auto py-1">
            {groups ? (
              Array.from(groups.entries()).map(([g, arr]) => (
                <div key={g} className="py-1">
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-3 py-1 text-[11px] uppercase text-neutral-500">{g}</div>
                  {arr.map(opt => {
                    const selected = opt.value === value;
                    return (
                      <button key={opt.value} type="button" onMouseDown={() => selectItem(opt.value)}
                        className={[ "w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-neutral-50", selected ? "bg-neutral-50" : "" ].join(' ')}
                        role="option" aria-selected={selected}>
                        <TinyIcon src={getIcon(opt)} alt={opt.label} size={itemIconSize} />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            ) : (
              (options ?? []).map(opt => {
                const selected = opt.value === value;
                return (
                  <button key={opt.value} type="button" onMouseDown={() => selectItem(opt.value)}
                    className={[ "w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-neutral-50", selected ? "bg-neutral-50" : "" ].join(' ')}
                    role="option" aria-selected={selected}>
                    <TinyIcon src={getIcon(opt)} alt={opt.label} size={itemIconSize} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Complemento selector (icon chips) ---
function ComplementoSelector({
  value, onChange, options,
}: { value: string[]; onChange: (v: string[]) => void; options: {value:string;label:string}[] }) {
  const selected = (value ?? []).map(v => v.toLowerCase()).filter(v => v && v !== 'nenhum');
  const noneActive = selected.length === 0;
  const orderedOptions = React.useMemo(() => {
    const arr = [...options];
    arr.sort((a,b) => { if (a.value.toLowerCase() === 'nenhum') return -1; if (b.value.toLowerCase() === 'nenhum') return 1; return 0; });
    return arr;
  }, [options]);
  const setNone = () => onChange([]);
  const toggle = (raw: string) => {
    const c = raw.toLowerCase();
    if (c === 'nenhum') { setNone(); return; }
    const has = selected.includes(c);
    if (has) onChange(selected.filter(v => v !== c)); else onChange([...selected, c]);
  };

  const baseCls = "group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all border shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD200]/60";
  const activeCls = "bg-[#FFD200]/20 border-[#FFD200] text-[#122C4F] shadow-[0_0_0_2px_rgba(255,210,0,0.35)]";
  const inactiveCls = "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-400";


  
  return (
    <div className="flex flex-wrap gap-2">
      {orderedOptions.map(opt => {
        const val = opt.value.toLowerCase();
        const isNone = val === 'nenhum';
        const active = isNone ? noneActive : selected.includes(val);
        const iconSrc = !isNone ? complementoIconSrc(val) : '';
        return (
          <button key={opt.value} type="button" onClick={() => toggle(opt.value)} aria-pressed={active}
            className={`${baseCls} ${active ? activeCls : inactiveCls}`}>
            {!isNone && <TinyIcon src={iconSrc} alt="" size={18} />}
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Thumbs preview (used by budgets for photos) ---
function Thumbs({ urls } : { urls: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {urls.map(u => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block w-24 h-24 border rounded overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="" className="w-full h-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/* ========== end previews block ========== */


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

// TURBO ENFORCED RULES
React.useEffect(() => {
  if (!isTurboModelKey(details.model)) return;

  setDetails(d => {
    const next = { ...d };

    // Ensure acrylic has default if empty or invalid
    if (!next.acrylic || next.acrylic === 'nenhum') {
      next.acrylic = "acrilico_agua_viva";
    }

    // Force fixed fields that Turbo ALWAYS controls
    next.finish = "branco";
    next.glassTypeKey = "";
    next.complements = [];

    // Clear dependent fields
    next.barColor = "";
    next.visionSupport = "";
    next.towelColorMode = "";
    next.shelfColorMode = "";
    next.fixingBarMode = "";
    next.shelfHeightPct = null;

    return next;
  });
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

  // --- Serigrafia color options (same as orçamento) ---
  const finishesNoChromeAnod = React.useMemo(
    () =>
      (finishes ?? []).filter(f => {
        const v = String(f.value || '').toLowerCase();
        return v !== 'cromado' && v !== 'anodizado';
      }),
    [finishes]
  );

  const serigrafiaColorChoices = React.useMemo(
    () => [
      { value: 'padrao', label: 'Padrão' },
      ...finishesNoChromeAnod.map(f => ({
        value: f.value,
        label: f.label,
      })),
    ],
    [finishesNoChromeAnod]
  );

  // icon helper
  function serigrafiaColorIcon(opt: { value: string; label: string }) {
    if (opt.value === 'padrao') {
      return glassIconSrcFromLabel('Fosco'); // same placeholder icon as orçamento
    }
    return finishIconSrc(opt.value) ?? '';
  }



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
  // depends on selected complements
  const hasVision   = details.complements.includes("vision");
  const hasTowel1   = details.complements.includes("toalheiro1");
  const hasShelf    = details.complements.includes("prateleira");

  // Admin always allows shelf the same way public orçamento does
  const allowShelf  = true;
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

  const filteredComplements = React.useMemo(() => {
    return (complements ?? []).filter(c => {
      const v = c.value.toLowerCase();
      if (v === 'toalheiro1' && !allowTowel1) return false;
      return true;
    }).map(c => ({ value: c.value, label: c.label }));
  }, [complements, allowTowel1]);

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
              <h4 className="text-base font-semibold text-neutral-900">
                Detalhes do produto
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Modelo */}
                <div>
                  <label className="block text-sm mb-1">Modelo *</label>
                  <IconSelect
                    value={details.model}
                    onChange={(v) => setDetails((d) => ({ ...d, model: v }))}
                    options={(models ?? []).map(m => ({ value: m.value, label: m.label }))}
                    getIcon={(opt) => modelIconSrc(opt.value)}
                    iconSize={34}
                    itemIconSize={48}
                  />
                </div>

                {/* Puxador */}
                {!hideHandles && (
                  <div>
                    <label className="block text-sm mb-1">Puxador *</label>
                    <IconSelect
                      value={details.handleKey}
                      onChange={(v) => setDetails((d) => ({ ...d, handleKey: v }))}
                      options={(handles ?? []).map(h => ({ value: h.value, label: h.label }))}
                      getIcon={(opt) => handleIconSrc(opt.value)}
                      iconSize={34}
                      itemIconSize={48}
                    />
                  </div>
                )}

                {/* Acabamento */}
                <div>
                  <label className="block text-sm mb-1">Acabamento *</label>
                  <IconSelect
                    value={details.finish}
                    onChange={(v) => setDetails((d) => ({ ...d, finish: v }))}
                    options={(finishes ?? []).map(f => ({ value: f.value, label: f.label }))}
                    getIcon={(opt) => finishIconSrc(opt.value)}
                    iconSize={34}
                    itemIconSize={48}
                    disabled={isTurboModelKey(details.model)}
                  />
                </div>

                {/* Fixing bar (if rule) */}
                {showFixBar && (
                  <div>
                    <label className="block text-sm mb-1">Barra de fixação *</label>
                    <select
                      className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                      value={details.fixingBarMode}
                      onChange={(e) => setDetails(d => ({ ...d, fixingBarMode: e.target.value }))}
                    >
                      <option value="padrao">Padrão</option>
                      <option value="acabamento">Cor do acabamento</option>
                    </select>
                  </div>
                )}

                {/* Vidro / Monocromático */}
                {!isTurboModelKey(details.model) && (
                  <div>
                    <label className="block text-sm mb-1">Vidro / Monocromático *</label>
                    <IconSelect
                      value={details.glassTypeKey}
                      onChange={(v) => setDetails(d => ({ ...d, glassTypeKey: v }))}
                      options={[...(glassTipos ?? []), ...(monos ?? [])].map(o => ({ value: o.value, label: o.label }))}
                      getIcon={(opt) => glassIconSrcFromLabel(opt.label)}
                      iconSize={34}
                      itemIconSize={48}
                    />
                  </div>
                )}

                {/* Acrílico / Policarbonato */}
                {showAcrylic && (
                      <div>
                        <label className="block text-sm mb-1">Acrílico</label>
                        <IconSelect
                          value={details.acrylic}
                          onChange={(v) => setDetails(d => ({ ...d, acrylic: v }))}
                          options={(acrylics ?? []).map(a => ({ value: a.value, label: a.label }))}
                          getIcon={(opt) => opt.value === 'nenhum' ? undefined : acrylicIconSrcFromLabel(opt.label)}
                          iconSize={34}
                          itemIconSize={48}
                        />
                      </div>
                    )}

                      {/* Serigrafia */}
                      <div>
                        <label className="block text-sm mb-1">Serigrafia *</label>
                        <IconSelect
                          value={details.serigraphy}
                          onChange={(v) =>
                            setDetails((d) => ({
                              ...d,
                              serigraphy: v,
                              serigrafiaColor: '', // reset color when changing silk
                            }))
                          }
                          options={serigrafias.map((s) => ({
                            value: s.value,
                            label: s.label,
                          }))}
                          getIcon={(opt) => silkIconFromOpt(opt)}
                          iconSize={34}
                          itemIconSize={48}
                        />
                      </div>

                      {/* Serigrafia — Cor */}
                      {details.serigraphy && details.serigraphy !== 'nenhum' && (
                        <div>
                          <label className="block text-sm mb-1">Cor da Serigrafia *</label>
                          <IconSelect
                            value={details.serigrafiaColor || 'padrao'}
                            onChange={(v) => setDetails((d) => ({ ...d, serigrafiaColor: v }))}
                            options={serigrafiaColorChoices}
                            getIcon={(opt) => serigrafiaColorIcon(opt)}
                            iconSize={34}
                            itemIconSize={48}
                          />
                        </div>
                      )}


                {/* Complementos */}
                <div className="md:col-span-2">
                  <label className="block text-sm mb-1">Complementos *</label>
                  <ComplementoSelector
                    value={details.complements}
                    onChange={(v) => setDetails(d => ({ ...d, complements: v }))}  
                    options={filteredComplements}
                  />
                </div>

                {/* Vision-only */}
                {hasVision && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Cor da Barra Vision *</label>
                      <IconSelect
                        value={details.barColor}
                        onChange={(v) => setDetails(d => ({ ...d, barColor: v }))}
                        options={(vbarColors ?? []).map(o => ({ value: o.value, label: o.label }))}
                        getIcon={(opt) => visionBarIconSrc(opt.value)}
                        iconSize={34}
                        itemIconSize={48}
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Cor de Suporte *</label>
                      <IconSelect
                        value={details.visionSupport}
                        onChange={(v) => setDetails(d => ({ ...d, visionSupport: v }))}
                        options={
                          (finishes ?? [])
                            .filter(f => {
                              const key = String(f.value ?? '').toLowerCase();
                              const label = String(f.label ?? '').toLowerCase();
                              return key !== 'anodizado' && label !== 'anodizado';
                            })
                            .map(o => ({ value: o.value, label: o.label }))
                        }
                        getIcon={(opt) => finishIconSrc(opt.value)}
                        iconSize={34}
                        itemIconSize={48}
                      />
                    </div>
                  </>
                )}

                {/* Toalheiro 1 */}
                {allowTowel1 && hasTowel1 && (
                  <div>
                    <label className="block text-sm mb-1">Cor do toalheiro *</label>
                    <select
                      className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                      value={details.towelColorMode}
                      onChange={(e) => setDetails(d => ({ ...d, towelColorMode: e.target.value }))}
                    >
                      <option value="padrao">Padrão</option>
                      <option value="acabamento">Cor do acabamento</option>
                    </select>
                  </div>
                )}

                {/* Prateleira de canto */}
                {allowShelf && hasShelf && (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Cor da prateleira *</label>
                      <select
                        className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                        value={details.shelfColorMode}
                        onChange={(e) => setDetails(d => ({ ...d, shelfColorMode: e.target.value }))}
                      >
                        <option value="padrao">Padrão</option>
                        <option value="acabamento">Cor do acabamento</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">
                        Altura da prateleira ({details.shelfHeightPct || 100}%)
                      </label>
                      <input
                        type="range"
                        min={60}
                        max={120}
                        value={details.shelfHeightPct ?? 100}
                        onChange={(e) => setDetails(d => ({ ...d, shelfHeightPct: Number(e.target.value) }))}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
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
