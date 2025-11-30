// Orders NEW
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import React from 'react';
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

/* ===========================================================
   Types & small helpers
=========================================================== */
type Opt = { value: string; label: string; order?: number; category?: string | null };
type Catalog = Record<string, Opt[]>;
type ModelRuleDTO = {
  hideHandles?: boolean;
  removeFinishes?: string[];
  allowAcrylicAndPoly?: boolean;
  allowTowel1?: boolean;
  hasFixingBar?: boolean;
};

// --- upload types & helper (copiado do EditOrderModal) ---
type UploadInfo = { url: string; name: string; size: number; mime?: string };

async function uploadFile(f: File): Promise<UploadInfo> {
  const fd = new FormData();
  fd.append('file', f);
  const r = await fetch('/api/uploads', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Upload falhou');
  return r.json();
}
// ----------------------------------------------------------------
// Small spinner (same look as in the Orçamentos page)
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

function serigrafiaColorIcon(opt: { value: string; label: string }) {
  if (opt.value === 'padrao') {
    // use a generic “frosted glass” or similar – same idea as orçamento
    return glassIconSrcFromLabel('Fosco');
  }
  return finishIconSrc(opt.value) ?? '';
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
/* ---------- silk sorting + turbo helpers (copy from Orçamentos) ---------- */

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

const TURBO_MODEL_KEY = 'turbo_v1';
function isTurboModelKey(key?: string | null) {
  return canon(key ?? '') === TURBO_MODEL_KEY;
}

// --- silk helpers (classification & ordering) ---
function startsWithToken(s: string, token: string) {
  return s.replace(/^[\s_-]+|[\s_-]+$/g,'').toLowerCase().startsWith(token.toLowerCase());
}
function silkKind(opt: Opt) {
  const v = (opt.value ?? '').trim();
  const l = (opt.label ?? '').trim();
  const vs = v.replace(/[\s_-]+/g,'');
  const ls = l.replace(/[\s_-]+/g,'');
  if (startsWithToken(vs, 'sereno') || startsWithToken(ls, 'sereno')) return 'sereno';
  if (startsWithToken(vs, 'ser')     || startsWithToken(ls, 'ser'))     return 'ser';     // Prime
  if (startsWithToken(vs, 'quadro')  || startsWithToken(ls, 'quadro'))  return 'quadro';
  if (startsWithToken(vs, 'elo')     || startsWithToken(ls, 'elo'))     return 'elo';
  return 'ser'; // fallback
}

// extrai número depois do prefixo (SER001, Quadro 3, Elo_12...)
function extractNum(opt: Opt) {
  const s = `${opt.value ?? ''} ${opt.label ?? ''}`;
  const m =
    s.match(/ser[\s_-]*0*(\d+)/i) ||
    s.match(/quadro[\s_-]*0*(\d+)/i) ||
    s.match(/elo[\s_-]*0*(\d+)/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

// === "Tipo de Habitação" options (dropdown) ===
const HOUSING_TYPES: { value: string; label: string }[] = [
  { value: 'moradia',        label: 'Moradia' },
  { value: 'apartamento',    label: 'Apartamento' },
  { value: 'res_do_chao',    label: 'Rés-do-chão' },
  { value: 'andar_moradia',  label: 'Andar de Moradia' },
  { value: 'loft',           label: 'Loft' },
  { value: 'estudio',        label: 'Estúdio' },
  { value: 'outro',          label: 'Outro' },
];

// normalize label (show "SERENO" as "Sereno")
function normalizedSilkLabel(opt: Opt) {
  const raw = opt.label?.trim() || opt.value?.trim() || '';
  if (/^sereno\b/i.test(raw)) return 'Sereno';
  return raw;
}

// ordering: by "order" when present; then by extracted number; fallback by label
function silkSort(a: Opt, b: Opt) {
  if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
  const na = extractNum(a), nb = extractNum(b);
  if (na !== nb) return na - nb;
  return normalizedSilkLabel(a).localeCompare(normalizedSilkLabel(b), 'pt');
}


const estados = [
  { value: 'PREPARACAO', label: 'Em preparação' },
  { value: 'PRODUCAO',   label: 'Em produção' },
  { value: 'EXPEDICAO',  label: 'Em expedição' },
  { value: 'ENTREGUE',   label: 'Entregue' },
];

const isPainelV234 = (key?: string) => !!key && /painel[_-]?v(2|3|4)\b/i.test(key.toLowerCase());

const uniqByValue = (items: Opt[]) => {
  const seen = new Set<string>(); const out: Opt[] = [];
  for (const it of items) { if (!seen.has(it.value)) { seen.add(it.value); out.push(it); } }
  // keep "nenhum" first, then by order/label for nicer UX
  out.sort((a,b) => {
    if (a.value === 'nenhum') return -1;
    if (b.value === 'nenhum') return 1;
    if (a.order != null && b.order != null) return a.order - b.order;
    return a.label.localeCompare(b.label,'pt');
  });
  return out;
};

function findLabel(groups: Opt[][], value?: string) {
  if (!value) return undefined;
  for (const g of groups) {
    const hit = g.find((o) => o.value === value);
    if (hit) return hit.label;
  }
  return value;
}

const ensureSelectedWithLabel = (opts: Opt[], selected?: string) =>
  !selected
    ? opts
    : (opts.some(o => o.value === selected)
        ? opts
        : [{ value: selected, label: (findLabel([opts], selected) ?? 'Selecionado') }, ...opts]);

/* ===========================================================
   Page
=========================================================== */
export function NewOrderClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Client form
  const [client, setClient] = useState({
    name: '', email: '', phone: '', nif: '',
    address: '', postal: '', city: '',
  });

  // Optional “choose client” helpers
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{
    id: string; name: string; email: string | null;
    phone?: string | null; nif?: string | null; address?: string | null; postal?: string | null; city?: string | null;
  }>>([]);
  const [openList, setOpenList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Catalog & Rules
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [rule, setRule] = useState<ModelRuleDTO | null>(null);

  // Product details (mirrors Public Orçamento fields)
  const [details, setDetails] = useState({
    model: '',
    handleKey: '',
    finish: '',
    glassTypeKey: '',
    acrylic: '',
    serigraphy: 'nenhum',
    serigrafiaColor: '',
    complements: [] as string[],
    barColor: '',
    visionSupport: '',
    towelColorMode: '',
    shelfColorMode: '',
    fixingBarMode: '',
  });

  /* ---------- Measures (admin) ---------- */
  /** store measurements as strings in cm for UI — convert to mm on submit */
  const [measures, setMeasures] = useState({ widthCm: '', heightCm: '', depthCm: '' });

  /** Turbo presets (label shown in dropdown). Add/remove presets as you like. 
      Each preset is width x depth in cm. Height is always 178.5 cm for Turbo. */
  const TURBO_PRESETS = [
    { label: '75 x 80', width: 75, depth: 80 },
    { label: '70 x 75', width: 70, depth: 75 },
    { label: '80 x 85', width: 80, depth: 85 },
    { label: '60 x 70', width: 60, depth: 70 },
  ];

  /** helper to detect turbo */
  function isTurboModelKeyLocal(key?: string) {
    if (!key) return false;
    return canon(key).replace(/_/g,'') === TURBO_MODEL_KEY; // reuse canon + TURBO_MODEL_KEY from file
  }

  // Order meta
  const [initialStatus, setInitialStatus] = useState('PREPARACAO');
  const [eta, setEta] = useState(''); // ISO local datetime string
  const etaRequired = useMemo(() => initialStatus === 'EXPEDICAO', [initialStatus]);

  /* ---------- Load catalog once ---------- */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch('/api/catalog', { cache: 'no-store' });
        const json = (await r.json()) as Catalog;
        if (!live) return;
        setCatalog(json);
      } catch {
        // keep empty catalog -> selects will be empty
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, []);

  /* ---------- When model changes, fetch rules ---------- */
  useEffect(() => {
    if (!details.model) { setRule(null); return; }
    (async () => {
      const r = await fetch(`/api/model-rules/${encodeURIComponent(details.model)}`, { cache: 'no-store' });
      setRule(r.ok ? await r.json() : null);
    })();
  }, [details.model]);

  /* ---------- Computed option arrays ---------- */
  const models      = useMemo(() => catalog?.MODEL ?? [], [catalog]);
  // --- model grouping (same logic / order as Orçamentos) ---
  function classifyModelGroupByKey(key: string, label: string) {
    const k = key.toLowerCase();
    const l = label.toLowerCase();

    // Portas de Abrir: Sterling + DiplomataGold + Diplomata Pivotante + Painel v2/v3/v4
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

  const groupedModels = useMemo(() => {
    const list = (catalog?.MODEL ?? []);
    const map = new Map<string, Opt[]>();
    for (const m of list) {
      const g = classifyModelGroupByKey(m.value, m.label);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    // sort each group by order or label
    for (const arr of map.values()) {
      arr.sort((a,b) => {
        if (a.order != null && b.order != null) return a.order - b.order;
        return a.label.localeCompare(b.label, 'pt');
      });
    }
    // produce an ordered array of groups in desired sequence
    const ordered: Array<{ group: string; items: Opt[] }> = [];
    for (const g of GROUP_ORDER) {
      if (map.has(g)) ordered.push({ group: g, items: map.get(g)! });
    }
    // also add any uncategorized groups (rare) at the end
    for (const [k, v] of map.entries()) {
      if (!GROUP_ORDER.includes(k)) ordered.push({ group: k, items: v });
    }
    return ordered;
  }, [catalog]);


  const handlesRaw  = useMemo(() => catalog?.HANDLE ?? [], [catalog]);
  const handles     = useMemo(() => {
    const base = handlesRaw.filter(h => h.value !== '-' && h.value !== '');
    return isPainelV234(details.model) ? base : base.filter(h => h.value !== 'sem');
  }, [handlesRaw, details.model]);

  const finMetal    = useMemo(() => catalog?.FINISH_METALICO ?? [], [catalog]);
  const finLacado   = useMemo(() => catalog?.FINISH_LACADO ?? [], [catalog]);
  const finishes    = useMemo(() => {
    const all = [...finMetal, ...finLacado];
    if (!rule?.removeFinishes?.length) return all;
    const rm = new Set(rule.removeFinishes.map(v => v.toLowerCase()));
    return all.filter(f => !rm.has((f.value ?? '').toLowerCase()));
  }, [finMetal, finLacado, rule]);
  const finishesNoChromeAnod = useMemo(
      () => (finishes ?? []).filter(f => {
        const v = (f.value ?? '').toLowerCase();
        return v !== 'cromado' && v !== 'anodizado';
      }),
      [finishes]
    );

  const serigrafiaColorChoices = useMemo(
    () => [
      { value: 'padrao', label: 'Padrão' },
      ...finishesNoChromeAnod.map(f => ({
        value: f.value,
        label: f.label,
      })),
    ],
    [finishesNoChromeAnod]
  );

  
  const glassTipos  = useMemo(() => catalog?.GLASS_TIPO ?? [], [catalog]);
  const monos       = useMemo(() => catalog?.MONOCROMATICO ?? [], [catalog]);
  const acrylics    = useMemo(() => catalog?.ACRYLIC_AND_POLICARBONATE ?? [], [catalog]);
  
  const serPrime    = useMemo(() => catalog?.SERIGRAFIA_PRIME ?? [], [catalog]);
  const serQuadros  = useMemo(() => catalog?.SERIGRAFIA_QUADROS ?? [], [catalog]);
  const serElo      = useMemo(() => catalog?.SERIGRAFIA_ELO_SERENO ?? [], [catalog]);
  const serigrafias: Opt[] = useMemo(() => {
    const all = uniqByValue([...(serPrime ?? []), ...(serQuadros ?? []), ...(serElo ?? [])]);

    // normaliza label "SERENO" -> "Sereno"
    const withNiceLabels = all.map(o => ({ ...o, label: normalizedSilkLabel(o) }));

    const buckets: Record<string, Opt[]> = { ser: [], quadro: [], elo: [], sereno: [] };
    for (const o of withNiceLabels) buckets[silkKind(o) as keyof typeof buckets].push(o);

    buckets.ser.sort(silkSort);
    buckets.quadro.sort(silkSort);
    buckets.elo.sort(silkSort);
    buckets.sereno.sort(silkSort);

    // final order: SER (Prime) → Quadro → Elo → Sereno
    return [...buckets.ser, ...buckets.quadro, ...buckets.elo, ...buckets.sereno];
  }, [serPrime, serQuadros, serElo]);

  // --- Turbo preset defaults (Branco + Água Viva) ---
  const allFinishesRaw = useMemo(() => {
    const all = [...(finMetal ?? []), ...(finLacado ?? [])];
    return all;
  }, [finMetal, finLacado]);

  const turboFinishValue = useMemo(() => {
    const source = allFinishesRaw.length ? allFinishesRaw : (finishes ?? []);
    const found = source.find(f => (f.value ?? '').toLowerCase().includes('branco') || (f.label ?? '').toLowerCase().includes('branco'));
    return found ? found.value : (source[0]?.value ?? 'branco');
  }, [allFinishesRaw, finishes, finMetal, finLacado]);

  const turboAcrylicValue = useMemo(() => {
    if (! (acrylics ?? []).length) return undefined;
    const source = acrylics ?? [];
    const found = source.find(a => {
      const v = (a.value ?? '').toLowerCase();
      const l = (a.label ?? '').toLowerCase();
      return v.includes('agua') || v.includes('água') || l.includes('agua') || l.includes('água') || l.includes('agua_viva') || v.includes('agua_viva');
    });
    return found ? found.value : undefined;
  }, [acrylics]);


  const complements = useMemo(() => catalog?.COMPLEMENTO ?? [], [catalog]);
  const vbarColors  = useMemo(() => catalog?.VISION_BAR_COLOR ?? [], [catalog]);

  const hideHandles = !!rule?.hideHandles;
  const showAcrylic = !!rule?.allowAcrylicAndPoly;
  const showFixBar  = !!rule?.hasFixingBar;
  const allowTowel1 = !!rule?.allowTowel1;

  const comps = details.complements;
  const hasVision = comps.includes('vision');
  const hasTowel1 = comps.includes('toalheiro1');
  const hasShelf  = comps.includes('prateleira');
  /* ---------- First-time sensible defaults ---------- */
  useEffect(() => {
    if (!catalog) return;
    setDetails((d) => {
      const firstModel   = catalog.MODEL?.[0]?.value ?? '';
      const glassFirst   = (catalog.GLASS_TIPO?.[0]?.value ?? catalog.MONOCROMATICO?.[0]?.value ?? '');
      const allowedFinishes = (() => {
        const all = [...(catalog.FINISH_METALICO ?? []), ...(catalog.FINISH_LACADO ?? [])];
        const rm  = rule?.removeFinishes?.length ? new Set(rule.removeFinishes.map(v => v.toLowerCase())) : null;
        const arr = rm ? all.filter(f => !rm.has((f.value ?? '').toLowerCase())) : all;
        return arr;
      })();
      const firstFinish = allowedFinishes[0]?.value ?? '';

      return {
        ...d,
        model: d.model || firstModel,
        finish: d.finish || firstFinish,
        glassTypeKey: d.glassTypeKey || glassFirst,
        acrylic: showAcrylic ? (d.acrylic || (catalog.ACRYLIC_AND_POLICARBONATE?.[0]?.value ?? '')) : '',
        complements: d.complements.length ? d.complements : [],
      };
    });
  }, [catalog, rule, showAcrylic]);

  // Enforce Turbo model special-cases (match Orçamentos behavior)
  useEffect(() => {
    const isTurbo = isTurboModelKey(details.model);
    if (!isTurbo) return;

    setDetails((prev) => {
      const next = { ...prev };

      // 1) Force finish = Branco
      if (turboFinishValue) next.finish = turboFinishValue;

      // 2) Force acrylic = Água Viva (if available)
      if (turboAcrylicValue) next.acrylic = turboAcrylicValue;

      // 3) Disable serigrafia: set to 'nenhum' and clear color
      next.serigraphy = 'nenhum';
      next.serigrafiaColor = '';

      // 4) (Optional) keep glass untouched but it's hidden in UI - can set to first if not present
      // if (!next.glassTypeKey && (glassTipos?.[0]?.value)) next.glassTypeKey = glassTipos[0].value;

      return next;
    });
  }, [details.model, turboFinishValue, turboAcrylicValue]);

  // When the model becomes Turbo, prefill measures from first preset if measures are empty
  useEffect(() => {
    const turbo = isTurboModelKey(details.model);
    if (!turbo) return;
    // only set if admin hasn't already entered measures
    setMeasures((m) => {
      const hasAny = (m.widthCm && m.widthCm.trim()) || (m.depthCm && m.depthCm.trim()) || (m.heightCm && m.heightCm.trim());
      if (hasAny) return m;
      const preset = TURBO_PRESETS[0];
      return { widthCm: String(preset.width), depthCm: String(preset.depth), heightCm: '178.5' };
    });
  }, [details.model]);



  
  /* ---------- Pre-fill from ?fromClient= ---------- */
  const fromClient = searchParams.get('fromClient');
  useEffect(() => {
    if (!fromClient) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/clients/${fromClient}`, { cache: 'no-store' });
        if (!r.ok) return;
        const c = await r.json();
        if (cancelled) return;
        setClient({
          name:  c.name   ?? '',
          email: c.email  ?? '',
          phone: c.phone  ?? '',
          nif:   c.nif    ?? '',
          address: c.address ?? '',
          postal:  c.postal  ?? '',
          city:    c.city    ?? '',
        });
        setSelectedCustomerId(c.id ?? null);
        setOpenList(false);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fromClient]);

  /* ---------- Debounced live customer suggestions by name ---------- */
  function useDebounced<T>(value: T, ms = 250) {
    const [v, setV] = useState(value);
    useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
    return v;
  }
  const debouncedName = useDebounced(client.name, 250);

  useEffect(() => {
    // user is typing a different name => forget selection
    setSelectedCustomerId(null);
    const q = debouncedName.trim();
    if (!q || q.length < 2) { setSuggestions([]); setOpenList(false); return; }

    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}&limit=5`, { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      if (!cancelled) {
        setSuggestions(data.items ?? []);
        setOpenList((data.items ?? []).length > 0);
        setActiveIndex(0);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedName]);

  function pickSuggestion(i: number) {
    const s = suggestions[i];
    if (!s) return;
    setSelectedCustomerId(s.id);
    setClient({
      name: s.name,
      email: s.email ?? '',
      phone: s.phone ?? '',
      nif: s.nif ?? '',
      address: s.address ?? '',
      postal: s.postal ?? '',
      city: s.city ?? '',
    });
    setOpenList(false);
  }

  function truncateEmail(email: string, max = 24) {
    if (!email) return '';
    return email.length <= max ? email : email.slice(0, max - 3) + '…';
  }
const [delivery, setDelivery] = useState({
  deliveryType: 'entrega',
  housingType: '',
  floorNumber: '',
  hasElevator: '', // '' or '1'
});

  /* ---------- Files (upload) ---------- */
  /* ---------- Files (upload) ---------- */
  const [files, setFiles] = useState<UploadInfo[]>([]);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const up = await uploadFile(f);
      setFiles((prev) => [...prev, up]);
    } catch (err: any) {
      alert(err?.message ?? 'Falha no upload');
    } finally {
      // limpa input para permitir reapertar o mesmo ficheiro
      (e.target as HTMLInputElement).value = '';
      setUploading(false);
    }
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((x) => x.name !== name));
  }

  // convert cm → mm (integers)
  const toMm = (cmStr?: string) => {
    const n = Number((cmStr ?? '').toString().replace(',', '.'));
    if (!n || Number.isNaN(n)) return undefined;
    return Math.round(n * 10); // 1 cm = 10 mm; keep integers
  };

  /* ---------- Submit ---------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (etaRequired && !eta) {
      alert('ETA é obrigatória quando o estado inicial é "Em expedição".');
      return;
    }
    setSubmitting(true);

    const widthMm = toMm(measures.widthCm);
    const heightMm = toMm(measures.heightCm) ?? (isTurboModelKey(details.model) ? 1785 : undefined);
    const depthMm = toMm(measures.depthCm);

    try {
      // Build a clear payload mirroring the public orçamento options
      const payload = {
        client,
        order: {
          model: details.model,
          handleKey: hideHandles ? undefined : (details.handleKey || undefined),
          finish: details.finish,
          glassTypeKey: details.glassTypeKey,
          acrylic: showAcrylic ? (details.acrylic || undefined) : undefined,

          serigraphy: details.serigraphy,
          serigrafiaColor: details.serigraphy !== 'nenhum' ? (details.serigrafiaColor || 'padrao') : undefined,

          complements: comps.length ? comps : undefined,
          barColor:       hasVision ? (details.barColor || undefined) : undefined,
          visionSupport:  hasVision ? (details.visionSupport || undefined) : undefined,
          towelColorMode: hasTowel1 ? (details.towelColorMode || undefined) : undefined,
          shelfColorMode: hasShelf  ? (details.shelfColorMode || undefined) : undefined,

          delivery: {
            deliveryType: delivery.deliveryType,
            housingType:  delivery.housingType || undefined,
            floorNumber:  delivery.floorNumber ? Number(delivery.floorNumber) : undefined,
            hasElevator:  delivery.hasElevator === '1' ? true : false,
          },

          // mm fields (kept here for consumers that expect them inside `order`)
          widthMm,
          heightMm,
          depthMm,

          // IMPORTANT: initial status must be inside `order` for server validation
          initialStatus,

          items: [],
          files: files,
        },

        // keep top-level fields too (harmless / compatibility)
        widthMm,
        heightMm,
        depthMm,

        // top-level also OK, but server wants order.initialStatus so include both
        initialStatus,
        eta: eta || null,
      };

      // Optional: console.log(payload);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || 'Falha a criar pedido');
      }
      router.push('/admin/orders');
    } catch (err: any) {
      alert(err?.message ?? 'Falha a criar pedido');
    } finally {
      setSubmitting(false);
    }
  }

  /* ---------- Render ---------- */
  if (loading) {
    return (
      <AdminShell>
        <div className="py-16 text-center text-muted-foreground">A carregar…</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl space-y-10 pb-24">
        {/* Header */}
        <header className="pt-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Novo pedido</h1>
          <p className="mt-2 text-base text-muted-foreground">Preencha os dados do cliente e os detalhes do produto.</p>
        </header>

        {/* Dados do cliente */}
        <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">Dados do cliente</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nome + suggestions */}
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-foreground">Nome*</label>
              <input
                className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
                required
                value={client.name}
                onChange={(e) => { setClient({ ...client, name: e.target.value }); setOpenList(true); }}
                onKeyDown={(e) => {
                  if (!openList || suggestions.length === 0) return;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); pickSuggestion(activeIndex); }
                  else if (e.key === 'Escape') { setOpenList(false); }
                }}
                onBlur={() => { setTimeout(() => setOpenList(false), 120); }}
                placeholder="Nome completo"
              />
              {openList && suggestions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-popover shadow-sm">
                  {suggestions.map((s, i) => (
                    <li
                      key={s.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(i)}
                      className={[
                        'flex cursor-pointer items-center justify-between px-3 py-2 text-sm',
                        i === activeIndex ? 'bg-muted/60' : 'hover:bg-muted/30',
                      ].join(' ')}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="ml-3 truncate text-muted-foreground">{truncateEmail(s.email ?? '')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Field label="Email*" type="email" required value={client.email} onChange={(v) => setClient({ ...client, email: v })} />
            <Field label="Telefone" value={client.phone} onChange={(v) => setClient({ ...client, phone: v })} />
            <Field label="NIF" value={client.nif} onChange={(v) => setClient({ ...client, nif: v })} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Textarea className="sm:col-span-2" label="Morada" rows={4} value={client.address} onChange={(v) => setClient({ ...client, address: v })} />
            <Field label="Código Postal" value={client.postal} onChange={(v) => setClient({ ...client, postal: v })} />
            <Field label="Localidade" value={client.city} onChange={(v) => setClient({ ...client, city: v })} />
          </div>
        </section>

        {/* Detalhes do produto (matches public orçamento) */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Modelo & Opções</h2>

          {/* Modelo */}
          <div>
            <label className="block text-sm mb-1">Modelo *</label>

            <IconSelect
              value={details.model}
              onChange={(v) => setDetails({ ...details, model: v })}
              groups={new Map(groupedModels.map(g => [g.group, g.items]))}
              getIcon={(opt) => modelIconSrc(opt.value || opt.label)}
              iconSize={44}
              itemIconSize={64}
            />
          </div>

          {/* Puxador */}
          {!hideHandles && (
            <div>
              <label className="block text-sm mb-1">Puxador</label>
              <IconSelect
                value={details.handleKey}
                onChange={(v) => setDetails({ ...details, handleKey: v })}
                options={handles.map(h => ({ value: h.value, label: h.label }))}
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
                onChange={(v) => setDetails({ ...details, finish: v })}
                options={(finishes ?? []).map(f => ({ value: f.value, label: f.label }))}
                getIcon={(opt) => finishIconSrc(opt.value)}
                iconSize={34}
                itemIconSize={48}
                disabled={isTurboModelKey(details.model)}              />
          </div>

          {/* Fixing bar (if rule) */}
          {showFixBar && (
            <div>
              <label className="block text-sm mb-1">Barra de fixação *</label>
              <select
                className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                value={details.fixingBarMode}
                onChange={(e) => setDetails({ ...details, fixingBarMode: e.target.value })}
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
                onChange={(v) => setDetails({ ...details, glassTypeKey: v })}
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
              <label className="block text-sm mb-1">Acrílico / Policarbonato</label>
                <IconSelect
                  value={details.acrylic}
                  onChange={(v) => setDetails({ ...details, acrylic: v })}
                  options={(acrylics ?? []).map(a => ({ value: a.value, label: a.label }))}
                  getIcon={(opt) => opt.value === 'nenhum' ? undefined : acrylicIconSrcFromLabel(opt.label)}
                  iconSize={34}
                  itemIconSize={48}
                  disabled={isTurboModelKey(details.model)}
                />
            </div>
          )}

          {/* Complemento */}
          <div>
           <label className="block text-sm mb-1">Complementos *</label>
          <ComplementoSelector
            value={details.complements}
            onChange={(v) => setDetails((d) => ({ ...d, complements: v }))}
            options={complements}
          />
          </div>

          {/* Vision-only */}
          {hasVision && (
            <>
              <div>
                <label className="block text-sm mb-1">Cor da Barra Vision *</label>
                <IconSelect
                  value={details.barColor}
                  onChange={(v) => setDetails({ ...details, barColor: v })}
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
                    onChange={(v) => setDetails({ ...details, visionSupport: v })}
                    options={((finishes ?? []).filter(f => {
                      const key = String(f.value ?? '').toLowerCase();
                      const label = String(f.label ?? '').toLowerCase();
                      return key !== 'anodizado' && label !== 'anodizado';
                    })).map(o => ({ value: o.value, label: o.label }))}
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
                onChange={(e) => setDetails({ ...details, towelColorMode: e.target.value })}
              >
                <option value="padrao">Padrão (Cromado)</option>
                <option value="acabamento">Cor do Acabamento</option>
              </select>
            </div>
          )}

          {/* Prateleira de Canto */}
          {hasShelf && (
            <div>
              <label className="block text-sm mb-1">Cor do suporte *</label>
              <select
                className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                value={details.shelfColorMode}
                onChange={(e) => setDetails({ ...details, shelfColorMode: e.target.value })}
              >
                <option value="padrao">Padrão</option>
                <option value="acabamento">Cor do Acabamento</option>
              </select>
            </div>
          )}

          {/* Serigrafia + cor */}
          {!isTurboModelKey(details.model) && (
            <>
              <div>
                <label className="block text-sm mb-1">Serigrafia</label>
                <IconSelect
                  value={details.serigraphy}
                  onChange={(v) => {
                    setDetails({ ...details, serigraphy: v, serigrafiaColor: v === 'nenhum' ? '' : details.serigrafiaColor });
                  }}
                  options={serigrafias.map(s => ({ value: s.value, label: s.label }))}
                  getIcon={(opt) => opt.value === 'nenhum' ? undefined : silkIconFromOpt(opt as any)}
                  iconSize={34}
                  itemIconSize={48}
                />
              </div>

              {details.serigraphy && details.serigraphy !== 'nenhum' && (
                <div>
                  <label className="block text-sm mb-1">Cor da Serigrafia *</label>
                  <IconSelect
                    value={details.serigrafiaColor || 'padrao'}
                    onChange={(v) => setDetails({ ...details, serigrafiaColor: v })}
                    options={serigrafiaColorChoices}
                    getIcon={(opt) => serigrafiaColorIcon(opt)}
                    iconSize={34}
                    itemIconSize={48}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* --- Measures / Turbo presets --- */}
        {(() => {
          const turbo = isTurboModelKey(details.model);
          return (
            <div className="mt-3 rounded-xl border border-neutral-100 bg-white p-3">
              <div className="mb-2 text-sm font-medium text-neutral-700">Medidas do modelo</div>

              {turbo && (
                <div className="mb-3">
                  <label className="block text-xs text-neutral-600 mb-1">Preset Turbo</label>
                  <select
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                    value={`${measures.widthCm}x${measures.depthCm}`}
                    onChange={(e) => {
                      const v = e.target.value;
                      const [w, d] = v.split('x').map((s) => s ? s.trim() : '');
                      if (w && d) {
                        setMeasures({ widthCm: w, depthCm: d, heightCm: '178.5' });
                      }
                    }}
                  >
                    <option value="custom">Personalizado / Manual</option>
                    {TURBO_PRESETS.map(p => (
                      <option key={p.label} value={`${p.width}x${p.depth}`}>{p.label} (altura fixa 178.5 cm)</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs">
                  <div className="text-[11px] text-neutral-600">Largura (cm)</div>
                  <input
                    className="w-full rounded-lg border border-input bg-card px-2 py-1 text-sm"
                    value={measures.widthCm}
                    onChange={(e) => setMeasures(m => ({ ...m, widthCm: e.target.value }))}
                    placeholder="ex: 75"
                    inputMode="decimal"
                    />
                </label>

                <label className="text-xs">
                  <div className="text-[11px] text-neutral-600">Altura (cm)</div>
                  <input
                    className="w-full rounded-lg border border-input bg-card px-2 py-1 text-sm"
                    value={measures.heightCm}
                    onChange={(e) => setMeasures(m => ({ ...m, heightCm: e.target.value }))}
                    placeholder={isTurboModelKey(details.model) ? '178.5 (Turbo)' : 'ex: 178.5'}
                    inputMode="decimal"
                    />
                </label>

                <label className="text-xs">
                  <div className="text-[11px] text-neutral-600">Profundidade (cm)</div>
                  <input
                    className="w-full rounded-lg border border-input bg-card px-2 py-1 text-sm"
                    value={measures.depthCm}
                    onChange={(e) => setMeasures(m => ({ ...m, depthCm: e.target.value }))}
                    placeholder="ex: 80"
                    inputMode="decimal"
                    />
                </label>
              </div>

              {isTurboModelKey(details.model) && (
                <div className="mt-2 text-xs text-neutral-500">Nota: para modelos Turbo a altura é fixada a 178.5 cm (1785 mm).</div>
              )}
            </div>
          );
        })()}

        {/* Dados de Entrega */}
        <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">Dados de Entrega</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Tipo de Entrega *</label>
              <select
                className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                value={delivery.deliveryType}
                onChange={(e) => setDelivery({ ...delivery, deliveryType: e.target.value })}
              >
                <option value="entrega">Entrega</option>
                <option value="entrega_instalacao">Entrega + Instalação</option>
              </select>
            </div>
            {/* Tipo de Habitação (dropdown styled like Orçamentos) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Tipo de Habitação</label>
              <select
                className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
                value={delivery.housingType ?? ''}
                onChange={(e) => setDelivery({ ...delivery, housingType: e.target.value })}
              >
                <option value="">Selecionar...</option>
                {HOUSING_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Andar" value={delivery.floorNumber} onChange={(v) => setDelivery({ ...delivery, floorNumber: v })} />
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={delivery.hasElevator === '1'}
                  onChange={(e) => setDelivery({ ...delivery, hasElevator: e.target.checked ? '1' : '' })}
                />
                Tem elevador?
              </label>
            </div>
          </div>
        </section>

        {/* Estado inicial & ETA */}
        <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">Estado inicial</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Estado</label>
              <select
                className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value)}
              >
                {estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <DateField
              label={<>ETA {etaRequired && <span className="text-red-500">*</span>}</>}
              value={eta}
              onChange={setEta}
            />
          </div>
        </section>

        {/* Ficheiros técnicos */}
        <section className="mt-8">
          <h4 className="text-base font-medium">Ficheiros técnicos</h4>
          <div className="mt-3 flex items-center gap-3">
                        <label
              className={[
                "inline-flex cursor-pointer items-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium",
                uploading ? "opacity-70 pointer-events-none" : "hover:bg-muted/60"
              ].join(' ')}
            >
              {/* disabled visually while uploading via pointer-events + opacity */}
              {uploading ? (
                <span className="inline-flex items-center gap-2">
                  <GsSpinner size={16} stroke={2} />
                  <span>Carregando…</span>
                </span>
              ) : (
                <>
                  Carregar novo
                  <span className="ml-2">⬆</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                onChange={onPickFile}
                accept=".pdf,.png,.jpg,.jpeg,.svg,.dxf,.ai,.psd,.doc,.docx,.xls,.xlsx"
                disabled={uploading}
              />
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
                      <button
                        title="Abrir noutro separador"
                        className="rounded-lg px-2 py-1 text-primary hover:bg-primary/10"
                        onClick={() => window.open(f.url, '_blank')}
                      >
                        👁️
                      </button>
                    )}
                    <button
                      title="Remover"
                      className="rounded-lg px-2 py-1 text-danger hover:bg-danger/10"
                      onClick={() => removeFile(f.name)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>


        {/* Submit */}
        <div className="pt-2">
          <div className="flex items-center justify-center">
            <button
              disabled={submitting}
              className="w-full max-w-sm rounded-xl bg-primary px-4 py-3 text-center text-primary-foreground font-semibold shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2 justify-center">
                  <GsSpinner size={16} stroke={2} />
                  <span>A criar…</span>
                </span>
              ) : 'Criar Pedido'}
            </button>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}

export default function NewOrderPage(){
  return (
    <Suspense
      fallback={
        <AdminShell>
          <div className="py-16 text-center text-muted-foreground">A carregar…</div>
        </AdminShell>
      }
    >
      <NewOrderClient />
    </Suspense>
  );
}

/* ===========================================================
   Small UI helpers
=========================================================== */
function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <input
        className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
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

function Textarea({
  label,
  value,
  onChange,
  rows = 3,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <textarea
        rows={rows}
        className="block w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <input
        type="datetime-local"
        className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
