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
function resolveVisionBarColor(
  raw: string | null | undefined,
  opts: { value: string; label: string }[]
): string | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase();
  const vals = new Set((opts ?? []).map(o => o.value.toLowerCase()));

  // Prefer the catalog’s own vocabulary (pt or en), but accept aliases.
  const aliases: Record<string, string[]> = {
    preto: ['preto', 'black', 'preto_mate', 'pretofosco'],
    branco: ['branco', 'white', 'branco_mate'],
    vidro: ['vidro', 'glass', 'transparente'],
    black: ['black', 'preto', 'preto_mate', 'pretofosco'],
    white: ['white', 'branco', 'branco_mate'],
    glass: ['glass', 'vidro', 'transparente'],
  };

  // Build candidate list starting with the raw value + its alias in the catalog’s set
  const candidates = [r];
  if (r in aliases) {
    // push whichever alias actually exists in the catalog
    for (const a of aliases[r]) {
      if (vals.has(a)) { candidates.push(a); break; }
    }
  } else {
    // raw might be 'transparente' etc.
    for (const [canon, list] of Object.entries(aliases)) {
      if (list.includes(r)) {
        for (const a of list) {
          if (vals.has(a)) { candidates.push(a); break; }
        }
        break;
      }
    }
  }

  // Try candidates by value or label (matchOption does both)
  for (const c of candidates) {
    const m = matchOption(opts, c);
    if (m) return m;
  }
  return undefined;
}
// ==== ICON PATH HELPERS (seguem a lógica do simulador) ====

// normaliza "sterling_v1" -> "Sterling_V1" (mesma ideia do simModelParam)
function modelKeyToVariantStem(key: string) {
  const parts = key.replace(/-/g, '_').split('_').filter(Boolean);
  const tail = parts[parts.length - 1] ?? '';
  const v = tail.match(/^v(\w+)$/i)?.[1];
  const baseParts = v ? parts.slice(0, -1) : parts;
  const basePascal = baseParts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
  return v ? `${basePascal}_V${v}` : basePascal;
}
// Converte "diplomata pivotante v1", "diplomata_pivotante_v1",
// "DiplomataPivotante_v1" → "DiplomataPivotante_V1"
// Map single-token bases to canonical PascalCase
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

function capToken(tok: string) {
  // "4portas" -> "4Portas"; "meialua" -> "Meialua" (later we fix via MODEL_CANON)
  return tok.replace(/^(\d*)([a-zA-Z])(.*)$/, (_m, d, c, rest) => `${d}${c.toUpperCase()}${rest.toLowerCase()}`);
}

/** Accepts "diplomatagold_v3", "Diplomata Gold V3", "fole_ap_v2", "FoleAP_V2" → "DiplomataGold_V3", etc. */
function modelStemFromAny(input: string) {
  const s = input.replace(/-/g, '_').replace(/\s+/g, '_').trim();
  const m = s.match(/^(.*?)(?:_)?v(\d+)$/i);
  let base = (m ? m[1] : s).replace(/_/g, '');
  const v = m ? m[2] : undefined;

  const lower = base.toLowerCase();
  // If we know the canonical CamelCase, use it; else generic Pascalize by chunks (digits respected)
  const canonical = MODEL_CANON[lower] ?? base
    .split(/(?=[A-Z])/)              // keep existing CamelCase chunks
    .join('')
    .split(/(\d+|[a-zA-Z]+)/g)       // split alnums to handle numbers
    .filter(Boolean)
    .map(capToken)
    .join('');

  return v ? `${canonical}_V${v}` : canonical;
}


const PRE = '/previews';

// - modelos (agora robusto a label/value com espaços/hífens/CamelCase)
const modelIconSrc = (valueOrLabel: string) => `${PRE}/models/${modelStemFromAny(valueOrLabel)}.png`;
// remove acentos e espaços para bater certo em nomes tipo "AguaViva", "PolicarbonatoTransparente"
function labelToStem(label: string) {
  return label
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, ''); // também remove "_" e "-" agora
}
// Junta tokens em PascalCase (remove espaços/_/hífens)
function toPascalNoSep(input: string) {
  return input
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[\s_-]+/).filter(Boolean)
    .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join('');
}


const FINISH_FILE_MAP: Record<string, string> = {
  amarelo: "Amarelo",
  anodizado: "Anodizado",
  azulclaro: "AzulClaro",
  azulescuro: "AzulEscuro",
  azulturquesa: "AzulTurquesa",
  bordeaux: "Bordeaux",
  branco: "Branco",
  brancomate: "BrancoMate",
  castanho: "Castanho",
  cinza: "Cinza",
  cremelclaro: "CremeClaro",
  cremeclaro: "CremeClaro",
  cremeescuro: "CremeEscuro",
  cromado: "Cromado",
  dourado: "Dourado",
  gunmetal: "GunMetal",
  preto: "Preto",
  pretomate: "PretoMate",
  pretofosco: "PretoFosco",
  rosa: "Rosa",
  verdeagua: "VerdeAgua",
  verdefloresta: "VerdeFloresta",
  vermelho: "Vermelho",
};




// - acabamentos
const finishIconSrc = (name: string) => {
  const key = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');

  const stem = FINISH_FILE_MAP[key];
  if (!stem) return undefined;

  return `${PRE}/finishes/${stem}.png`;
};

// - puxadores (catálogo usa p.ex. h1..h7/sem); simulador usa Handle_1..8 e none/default
function handleIconSrc(value?: string) {
  if (!value || value === '' ) return `${PRE}/handles/default.png`;
  if (/^h(\d)$/i.test(value)) return `${PRE}/handles/Handle_${value.replace(/^h/i,'')}.png`;
  if (value.toLowerCase() === 'sem') return `${PRE}/handles/none.png`;
  return `${PRE}/handles/default.png`;
}

// - vidros/monos (ficheiros tipo Transparente.png, Fosco.png, Gris.png, ...)
const glassIconSrcFromLabel = (label: string) => `${PRE}/glass/vidros/${labelToStem(label)}.png`;

// - acrílicos (ficheiros tipo AguaViva.png, PolicarbonatoTransparente.png, ...)
const acrylicIconSrcFromLabel = (label: string) => `${PRE}/acrylics/${labelToStem(label)}.png`;

// - serigrafias (ficheiros tipo SER001.png, Quadro1.png, Elo2.png, ...)
const silkIconSrc = (id: string) => `${PRE}/glass/silks/${id}.png`;


function fixBarIconSrc(mode: 'padrao'|'acabamento', currentFinish?: string) {
  // "Padrão" -> mostrar Anodizado
  if (mode === 'padrao') return finishIconSrc('anodizado');
  // "Cor do Acabamento" -> mostrar exatamente o mesmo preview do campo "Acabamento"
  if (mode === 'acabamento' && currentFinish) return finishIconSrc(currentFinish);
  // fallback (sem ícone se ainda não há acabamento escolhido)
  return '';
}
function serigrafiaColorIconSrc(mode: 'padrao'|'acabamento', currentFinish?: string) {
  // "Padrão" -> Fosco do diretório de vidros
  if (mode === 'padrao') return `${PRE}/glass/vidros/Fosco.png`;
  // "Cor do acabamento" -> mesmo preview do campo "Acabamento"
  if (mode === 'acabamento' && currentFinish) return finishIconSrc(currentFinish);
  return '';
}
function towelColorIconSrc(mode: 'padrao'|'acabamento', currentFinish?: string) {
  // "Padrão" -> usar o preview de "Cromado" dos acabamentos
  if (mode === 'padrao') return finishIconSrc('Cromado');
  // "Cor do acabamento" -> mesmo preview do campo "Acabamento"
  if (mode === 'acabamento' && currentFinish) return finishIconSrc(currentFinish);
  return '';
}
function shelfColorIconSrc(mode: 'padrao'|'acabamento', currentFinish?: string) {
  // "Padrão" → use a neutral metal preview (Cromado)
  if (mode === 'padrao') return finishIconSrc('Cromado');

  // "Cor do Acabamento" → mirror whatever is selected in the Acabamento field
  if (mode === 'acabamento' && currentFinish) return finishIconSrc(currentFinish);

  // fallback if no acabamento picked yet
  return '';
}
// --- classificação & ordenação de Serigrafias ---
function startsWithToken(s: string, token: string) {
  return s.replace(/^[\s_-]+|[\s_-]+$/g,'').toLowerCase().startsWith(token.toLowerCase());
}
function silkKind(opt: { value: string; label: string }) {
  const v = (opt.value ?? '').trim();
  const l = (opt.label ?? '').trim();
  const vs = v.replace(/[\s_-]+/g,'');
  const ls = l.replace(/[\s_-]+/g,'');
  if (startsWithToken(vs, 'sereno') || startsWithToken(ls, 'sereno')) return 'sereno';
  if (startsWithToken(vs, 'ser')     || startsWithToken(ls, 'ser'))     return 'ser';     // Prime
  if (startsWithToken(vs, 'quadro')  || startsWithToken(ls, 'quadro'))  return 'quadro';
  if (startsWithToken(vs, 'elo')     || startsWithToken(ls, 'elo'))     return 'elo';
  return 'ser'; // fallback mais comum
}

// extrai número depois do prefixo (SER001, Quadro 3, Elo_12...)
function extractNum(opt: { value: string; label: string }) {
  const s = `${opt.value ?? ''} ${opt.label ?? ''}`;
  const m =
    s.match(/ser[\s_-]*0*(\d+)/i) ||
    s.match(/quadro[\s_-]*0*(\d+)/i) ||
    s.match(/elo[\s_-]*0*(\d+)/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

// label normalizado (mostra "SERENO" como "Sereno")
function normalizedSilkLabel(opt: CatItem) {
  const raw = opt.label?.trim() || opt.value?.trim() || '';
  if (/^sereno\b/i.test(raw)) return 'Sereno';
  return raw;
}

// ordenação: por "order" quando existir; senão por número extraído; fallback por label
function silkSort(a: CatItem, b: CatItem) {
  if (a.order != null && b.order != null && a.order !== b.order) return a.order - b.order;
  const na = extractNum(a), nb = extractNum(b);
  if (na !== nb) return na - nb;
  return normalizedSilkLabel(a).localeCompare(normalizedSilkLabel(b), 'pt');
}

// - complemento (ícones opcionais)
function complementoIconSrc(value: string) {
  const v = value.toLowerCase();
  if (v === 'vision') return `${PRE}/toalheiros/Vision.png`;
  if (v === 'toalheiro1') return `${PRE}/toalheiros/Toalheiro1.png`;
  if (v === 'prateleira') return `${PRE}/shelf/Prateleira.png`;
  // 'nenhum' → sem ícone
  return '';
}
function silkIdFrom(value?: string, label?: string) {
  const s = (value || label || '').trim();

  // Tenta SER + número (com/sem zeros)
  const mSer = s.match(/ser[\s_-]*0*(\d+)/i);
  if (mSer) {
    return `SER${mSer[1].padStart(3, '0')}`;  // SER002
  }

  // Tenta padrões "Quadro 1", "Elo 2", "Sereno 3" → Quadro1/Elo2/Sereno3
  const mNamed = s.match(/(Quadro|Elo|Sereno)\s*0*(\d+)/i);
  if (mNamed) {
    const name = mNamed[1][0].toUpperCase() + mNamed[1].slice(1).toLowerCase();
    return `${name}${mNamed[2]}`;
  }

  // Fallback: remove separadores e usa Pascal (para nomes raros)
  return toPascalNoSep(s);
}

function silkIconFromOpt(opt: { value: string; label: string }) {
  const id = silkIdFrom(opt.value, opt.label);
  return `${PRE}/glass/silks/${id}.png`;
}

// - Vision > cor da barra (catálogo costuma ter 'glass' | 'white' | 'black')
function visionBarIconSrc(value: string) {
  const v = value.toLowerCase();
  if (v === 'glass') return `${PRE}/glass/vidros/Transparente.png`;
  if (v === 'white' || v === 'branco') return `${PRE}/finishes/BrancoMate.png`;
  if (v === 'black' || v === 'preto') return `${PRE}/finishes/PretoMate.png`;
  // aceita "branco_mate", "Branco Mate", etc.
  return `${PRE}/finishes/${toPascalNoSep(value)}.png`;
}
function TinyIcon({ src, alt, size = 20 }: { src?: string; alt: string; size?: number }) {
  // When we can't build a URL, show the gray placeholder
  if (!src) {
    return (
      <span
        className="inline-block rounded-[6px] bg-neutral-200/70"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  // --- helpers ---------------------------------------------------------
  const stripExt = (s: string) => s.replace(/\.(png|jpg|jpeg|webp|gif)$/i, '');
  const splitDir = (s: string) => {
    const q = s.indexOf('?');
    const clean = q >= 0 ? s.slice(0, q) : s;
    const i = clean.lastIndexOf('/');
    return {
      dir: i >= 0 ? clean.slice(0, i + 1) : '',
      file: i >= 0 ? clean.slice(i + 1) : clean,
      query: q >= 0 ? s.slice(q) : '',
    };
  };
  const pascal = (s: string) =>
    s
      .replace(/[\s_-]+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(' ')
      .filter(Boolean)
      .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
      .join('');

  // Build a candidate list with different casings & extensions
  const candidates = React.useMemo(() => {
    const { dir, file, query } = splitDir(src);
    const base = stripExt(file); // e.g., "VisioSun"
    const exts = ['png', 'jpg', 'jpeg', 'webp']; // light on extension check

    // Variants of the "stem" we’ll try:
    // - as-is
    // - join _Vn → Vn
    // - fully lowercase
    // - lowercase + join _vn
    // - remove underscores
    // - lowercase + remove underscores
    // - First letter upper, rest lower (Visiosun)
    // - "Pascal" version from any separators (also gives Visiosun)
    // - Pascal from lowercase (extra safety)
    const noUnderscoreV = base.replace(/_V(\d+)$/, 'V$1');
    const lower = base.toLowerCase();
    const lowerNoUnderscoreV = lower.replace(/_v(\d+)$/, 'v$1');
    const joined = base.replace(/_/g, '');
    const lowerJoined = lower.replace(/_/g, '');
    const firstUpper = base ? base[0].toUpperCase() + base.slice(1).toLowerCase() : base;
    const pascalBase = pascal(base);
    const pascalLower = pascal(lower);

    const shapes = [
      base,
      noUnderscoreV,
      lower,
      lowerNoUnderscoreV,
      joined,
      lowerJoined,
      firstUpper,
      pascalBase,
      pascalLower,
    ];

    const seen = new Set<string>();
    const out: string[] = [];

    for (const shape of shapes) {
      if (!shape || seen.has(shape)) continue;
      seen.add(shape);
      for (const ext of exts) {
        out.push(`${dir}${shape}.${ext}${query}`);
      }
    }
    return out;
  }, [src]);

  const [idx, setIdx] = React.useState(0);

  // If we exhausted all candidates, render placeholder
  if (idx >= candidates.length) {
    return (
      <span
        className="inline-block rounded-[6px] bg-neutral-200/70"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  const url = candidates[idx];

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      style={{ width: size, height: size }}
      className="object-contain rounded-[6px] bg-white"
      onError={() => setIdx(i => i + 1)} // try next variant on 404
    />
  );
}
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
  iconSize = 20,
  itemIconSize = 20,
}:{
  value?: string;
  onChange: (v: string) => void;
  options?: IconOption[];
  groups?: Map<string, IconOption[]>;
  getIcon: (opt: IconOption) => string | undefined;
  placeholder?: string;
  disabled?: boolean;
  iconSize?: number;
  itemIconSize?: number;
}) {
  const [mounted, setMounted] = React.useState(false); // controla montagem
  const [animIn, setAnimIn] = React.useState(false);    // estado da transição
  const ref = useClickOutside<HTMLDivElement>(() => closeMenu());

  function openMenu() {
    if (mounted) return;
    setMounted(true);
    requestAnimationFrame(() => setAnimIn(true)); // trigger enter transition
  }
  function closeMenu() {
    if (!mounted) return;
    setAnimIn(false); // start leave
  }

  // desmonta no fim da animação de saída
  const onMenuTransitionEnd = React.useCallback(() => {
    if (!animIn) setMounted(false);
  }, [animIn]);

  // ESC fecha
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeMenu(); }
    if (mounted) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted]);

  const flat: IconOption[] = React.useMemo(() => {
    if (groups) return Array.from(groups.values()).flat();
    return options ?? [];
  }, [groups, options]);

  const current = flat.find(o => o.value === value);

  // selecionar item (usar onMouseDown evita "re-click" no trigger)
  const selectItem = (val: string) => {
    onChange(val);
    closeMenu();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => (mounted ? closeMenu() : openMenu())}
        className="w-full rounded border bg-white px-3 py-2 flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 min-w-0">
          <TinyIcon src={current ? getIcon(current) : undefined} alt={current?.label ?? ''} size={iconSize} />
          <span className="truncate">{current?.label ?? placeholder}</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.24 4.25a.75.75 0 01-1.08 0L5.25 8.27a.75.75 0 01-.02-1.06z"/>
        </svg>
      </button>

      {mounted && (
        <div
          className={[
            "absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-[0_8px_24px_rgba(0,0,0,.12)]",
            "origin-top transition-all duration-150 ease-out",
            animIn ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-1 scale-[0.98]"
          ].join(' ')}
          onTransitionEnd={onMenuTransitionEnd}
          role="listbox"
        >
          <div className="max-h-72 overflow-auto py-1">
            {groups ? (
              Array.from(groups.entries()).map(([g, arr]) => (
                <div key={g} className="py-1">
                  <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-3 py-1 text-[11px] uppercase text-neutral-500">{g}</div>
                  {arr.map(opt => {
                    const selected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onMouseDown={() => selectItem(opt.value)}
                        className={[
                          "w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-neutral-50",
                          selected ? "bg-neutral-50" : ""
                        ].join(' ')}
                        role="option"
                        aria-selected={selected}
                      >
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
                  <button
                    key={opt.value}
                    type="button"
                    onMouseDown={() => selectItem(opt.value)}
                    className={[
                      "w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-neutral-50",
                      selected ? "bg-neutral-50" : ""
                    ].join(' ')}
                    role="option"
                    aria-selected={selected}
                  >
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

// Parse bool/numbers from search params (accepts 1/true/yes)
const asBool = (s?: string | null) =>
  s == null ? undefined : ['1','true','yes','y'].includes(s.toLowerCase());
const asInt  = (s?: string | null) => (s == null || s === '' ? undefined : Number(s));
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
  serigrafiaColor: z.string().optional(),
  fixingBarMode: FixBarModeEnum.optional(),

  complementos: z.array(z.string()).default([]),
  launchBonus: z.enum(['shampooGOLDSTAR','gelGOLDSTAR']).default('shampooGOLDSTAR'),

  // legacy/unused in this public form, keep if you want:
  visionBar: z.string().optional(),
  towelColorMode: DualColorModeEnum.optional(), 
  shelfColorMode: DualColorModeEnum.optional(),
  cornerChoice: z.string().optional(),
  cornerColorMode: z.string().optional(),
  shelfHeightPct: NumOpt,

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
  if (val.complementos.includes('vision')) {
    if (!val.barColor) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['barColor'] });
    }
    if (!val.visionSupport) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório com Vision.', path: ['visionSupport'] });
    }
  }

  if (val.complementos.includes('toalheiro1')) {
    if (!val.towelColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Toalheiro 1.', path: ['towelColorMode'] });
    }
  }

  if (val.complementos.includes('prateleira')) {
    if (!val.shelfColorMode) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Obrigatório para Prateleira de Canto.', path: ['shelfColorMode'] });
    }
  }

  // Serigrafia → color is required and cannot be Anodizado/Cromado
if (val.serigrafiaKey && val.serigrafiaKey !== 'nenhum') {
  const c = (val.serigrafiaColor ?? '').trim().toLowerCase();
  if (!c) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Escolha a cor da serigrafia.', path: ['serigrafiaColor'] });
  } else if (c === 'anodizado' || c === 'cromado') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cor indisponível para serigrafia.', path: ['serigrafiaColor'] });
  }
}
});

type FormValues = z.infer<typeof PublicBudgetSchema>;

const HIDE_DEPTH_MODELS = new Set(
  [
    'sterling_v1',
    'sterling_v2',
    'diplomatagold_v1',
    'diplomatagold_v2',
    'diplomatagold_v3',
    'diplomatagold_v4',
    'diplomatagold_v5',
    'diplomatagold_v6',
    'diplomatapivotante_v1',
    'europa_v1',
    'europa_v2',
    'lasvegas_v1',
    'fole_4portas',
  ].map(s => s.toLowerCase())
);
function hideDepthForModel(key?: string) {
  if (!key) return false;
  const k = key.toLowerCase().replace(/-/g, '_'); // normalize
  return HIDE_DEPTH_MODELS.has(k);
}

function ComplementoSelector({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: CatItem[];
}) {
  // Normalize: never keep "nenhum" inside the stored array
  const selected = (value ?? []).map(v => v.toLowerCase()).filter(v => v && v !== 'nenhum');
  const noneActive = selected.length === 0;

  // ensure "Nenhum" shows first even if catalog order changes
  const orderedOptions = React.useMemo(() => {
    const arr = [...options];
    arr.sort((a, b) => {
      const av = a.value.toLowerCase();
      const bv = b.value.toLowerCase();
      if (av === 'nenhum') return -1;
      if (bv === 'nenhum') return 1;
      return 0;
    });
    return arr;
  }, [options]);

  const setNone = () => onChange([]);

  const toggle = (raw: string) => {
    const c = raw.toLowerCase();

    // clicking "Nenhum" clears everything
    if (c === 'nenhum') {
      setNone();
      return;
    }

    const has = selected.includes(c);

    if (has) {
      const next = selected.filter(v => v !== c);
      onChange(next);          // if next becomes [], Nenhum auto-activates
    } else {
      onChange([...selected, c]); // add complement, Nenhum auto-deactivates
    }
  };

  const baseCls =
    "group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium " +
    "transition-all border shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD200]/60";

  const activeCls =
    "bg-[#FFD200]/20 border-[#FFD200] text-[#122C4F] " +
    "shadow-[0_0_0_2px_rgba(255,210,0,0.35)]";

  const inactiveCls =
    "bg-white border-neutral-300 text-neutral-800 hover:bg-neutral-50 hover:border-neutral-400";

  return (
    <div className="flex flex-wrap gap-2">
      {orderedOptions.map(opt => {
        const val = opt.value.toLowerCase();
        const isNone = val === 'nenhum';
        const active = isNone ? noneActive : selected.includes(val);

        const iconSrc = !isNone ? complementoIconSrc(val) : '';

        return (
          <button
            type="button"
            key={opt.value}
            onClick={() => toggle(opt.value)}
            aria-pressed={active}
            className={`${baseCls} ${active ? activeCls : inactiveCls}`}
          >
            {!isNone && (
              <TinyIcon
                src={iconSrc}
                alt=""
                size={18}
              />
            )}
            <span className="whitespace-nowrap">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function BudgetFormPageInner() {
  const search = useSearchParams();
  const router = useRouter();
  const [catalog, setCatalog] = React.useState<Catalog | null>(null);
  const [rule, setRule] = React.useState<ModelRuleDTO | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [locked, setLocked] = React.useState(false); // hard lock until we leave the page
  const idempKeyRef = React.useRef(
    (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now())
  );
  type RHFResolver = Resolver<FormValues, any, FormValues>;
  const form = useForm<FormValues>({
      resolver: zodResolver(PublicBudgetSchema) as RHFResolver,
      defaultValues: {
      name: '', email: '', phone: '',
      nif: '', address: '', postalCode: '', city: '',
      modelKey: search.get('model') ?? '',
      handleKey: search.get('handle') ?? undefined,
      finishKey: '',
      barColor: search.get('barColor') ?? undefined,
      glassTypeKey: search.get('glass') ?? '',
      acrylicKey: search.get('acrylic') ?? 'nenhum',
      serigrafiaKey: search.get('serigrafia') ?? 'nenhum',
      serigrafiaColor: undefined,
      complementos: (() => {
        const raw = search.get('complemento');
        if (!raw) return [];
        return raw.split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
      })(),
      launchBonus: ((): 'shampooGOLDSTAR' | 'gelGOLDSTAR' => {
        const b = (search.get('bonus') ?? '').toLowerCase();
        if (['gel','gelgoldstar','gel_de_banho','gelbanho'].includes(b)) return 'gelGOLDSTAR';
        return 'shampooGOLDSTAR';
      })(),
      visionSupport: undefined, visionBar: undefined,
      towelColorMode: undefined, shelfColorMode: undefined,   
      cornerChoice: undefined, cornerColorMode: undefined, shelfHeightPct: undefined,
      widthMm: undefined, heightMm: undefined, depthMm: undefined,
      willSendLater: search.get('later') === '1',
      deliveryType: '',
      housingType: undefined, floorNumber: undefined, hasElevator: undefined,
      photoUrls: [],
      notes: undefined,
    },
  });

  const modelKey = form.watch('modelKey');
  const hideDepth = React.useMemo(() => hideDepthForModel(modelKey), [modelKey]);
  // Load catalog once
  React.useEffect(() => {
    (async () => {
      const res = await fetch('/api/catalog', { cache: 'no-store' });
      const data = await res.json();
      setCatalog(data as Catalog);
    })();
  }, []);
  // EFFECT A - set model from URL after catalog is ready (enables rule fetch)
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
  
  // altura da prateleira (%)
  const a = asInt(search.get('altura'));
  if (a != null) {
    const pct = Math.max(20, Math.min(100, a)); // clamp 20–100
    form.setValue('shelfHeightPct', pct, { shouldDirty: false });
  }
}, [catalog]); 
// DEFAULT MODEL - if no ?model= and form still empty, pick the first model
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

  // EFFECT B - after rule is known, map *all other* URL params to valid options
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
    setIf('handleKey',     matchOption(handleAll,      search.get('handle')));
  // Complementos (URL → catálogo), aceita complemento=vision,toalheiro1...
  const rawComps =
    search.get('complemento') ??
    search.get('complementos') ??
    '';

  if (rawComps) {
    const mapped = rawComps
      .split(',')
      .map(s => s.trim())
      .map(s => matchOption(compAll, s))
      .filter(Boolean) as string[];

    if (mapped.length) {
      form.setValue(
        'complementos',
        Array.from(new Set(mapped)),
        { shouldDirty: false }
      );
    }
  }
    // Vision extras
  const barRaw = search.get('barColor') ?? search.get('visionBar') ?? search.get('bar');
  const barMatched = resolveVisionBarColor(barRaw, barColorsAll);
  if (barMatched) {
    form.setValue('barColor', barMatched, { shouldDirty: false });
  }
    // --- FINISH (Acabamento) -----------------------------------------------
const rawFinish = search.get('finish');
let matchedFinish =
  matchOption(finishesByRule, rawFinish) ||
  matchOption(finishesByRule, rawFinish?.replace(/_/g, '')) || // 'creme_claro' → 'cremeclaro'
  matchOption(finishesByRule, search.get('visionSupport'));    // last-resort: mirror visionSupport

if (!matchedFinish && finishesByRule.length) {
  matchedFinish = finishesByRule[0].value; // absolute last fallback
}
if (matchedFinish) {
  form.setValue('finishKey', matchedFinish, { shouldDirty: false });
}

// --- FIXING BAR (Barra de fixação): accept multiple aliases -------------
const fbRaw =
  (search.get('fixingBarMode') ??
   search.get('fixBar') ??
   search.get('fixingBar') ??
   search.get('fix'))?.toLowerCase();

let fbMode: 'padrao' | 'acabamento' | undefined;
if (fbRaw === 'padrao' || fbRaw === 'acabamento') fbMode = fbRaw;
else if (fbRaw === 'default') fbMode = 'padrao';
else if (fbRaw === 'finish')  fbMode = 'acabamento';

// If model supports fixing bar: default to something sensible if missing
if (rule.hasFixingBar) {
  form.setValue('fixingBarMode', fbMode ?? 'padrao', { shouldDirty: false });
}

// --- SERIGRAFIA COLOR (independent finish name) -------------------------
const rawSer =
  (search.get('serCor') ??
   search.get('serigrafiaColor') ??
   search.get('serColor'))?.toLowerCase();

if (rawSer) {
  if (rawSer === 'padrao') {
    form.setValue('serigrafiaColor', 'padrao' as any, { shouldDirty: false });
  } else {
    const serMatch =
      matchOption(finishesNoChromeAnod as any, rawSer) ||
      matchOption(finishesNoChromeAnod as any, rawSer.replace(/_/g, ''));
    if (serMatch) {
      form.setValue('serigrafiaColor', serMatch, { shouldDirty: false });
    }
  }
}
    setIf('visionSupport', matchOption(finishesByRule, search.get('visionSupport')));

    // Acrylic and Serigrafia (optional)
    setIf('acrylicKey',    matchOption(acrylicAll,     search.get('acrylic')));
    setIf('serigrafiaKey', matchOption(serigrafiasAll, search.get('serigrafia')));

    // Serigrafia color mode (enum)
    const raw = (search.get('serCor') ?? search.get('serigrafiaColor') ?? search.get('serColor'))?.toLowerCase();

  if (!raw) {
    // nothing given
  } else if (raw === 'padrao') {
    form.setValue('serigrafiaColor', 'padrao' as any, { shouldDirty: false });
  } else {
    // Treat anything else as a finish. Exclude Cromado/Anodizado.
    const finForSer = finishesByRule.filter(f => {
      const v = f.value.toLowerCase();
      return v !== 'anodizado' && v !== 'cromado';
    });
    const match = matchOption(finForSer, raw);
    if (match) {
      form.setValue('serigrafiaColor', match, { shouldDirty: false });
    }
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

      const cornerRaw = search.get('corner') ?? search.get('cornerChoice');
    if (cornerRaw) {
      const cc = canon(cornerRaw);
      let normalized: string | undefined;
      if (cc === 'corner1' || cc === 'canto1') normalized = 'corner1';
      else if (cc === 'corner2' || cc === 'canto2') normalized = 'corner2';
      if (normalized) {
        form.setValue('cornerChoice', normalized, { shouldDirty: false });
      }
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
    setIf('housingType', matchOption(HOUSING_TYPES as any, housing));
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

  const finishesNoAnod = React.useMemo(() => {
    return finishes.filter(f => f.value.toLowerCase() !== 'anodizado');
  }, [finishes]);

  const finishesNoChromeAnod = React.useMemo(() => {
    return finishes.filter(f => {
      const v = f.value.toLowerCase();
      return v !== 'anodizado' && v !== 'cromado';
    });
  }, [finishes]);
  const glassTipos = React.useMemo(() => catalog?.['GLASS_TIPO'] ?? [], [catalog]);
  const monos = React.useMemo(() => catalog?.['MONOCROMATICO'] ?? [], [catalog]);
  const complemento = React.useMemo(() => catalog?.['COMPLEMENTO'] ?? [], [catalog]);
  const showToalheiro1 = React.useMemo(() => isStrongOrPainelModel(modelKey), [modelKey]);

const complementoFiltered = React.useMemo(() => {
  const base = (catalog?.['COMPLEMENTO'] ?? []) as CatItem[];
  return showToalheiro1 ? base : base.filter(o => o.value !== 'toalheiro1');
}, [catalog, showToalheiro1]);
  const barColors = React.useMemo(() => catalog?.['VISION_BAR_COLOR'] ?? [], [catalog]);
  const serPrime = React.useMemo(() => catalog?.['SERIGRAFIA_PRIME'] ?? [], [catalog]);
  const serQuadros = React.useMemo(() => catalog?.['SERIGRAFIA_QUADROS'] ?? [], [catalog]);
  const serElo = React.useMemo(() => catalog?.['SERIGRAFIA_ELO_SERENO'] ?? [], [catalog]);

 const serigrafias: CatItem[] = React.useMemo(() => {
  const all = uniqByValue([...(serPrime ?? []), ...(serQuadros ?? []), ...(serElo ?? [])]);

  // normaliza label "SERENO" -> "Sereno"
  const withNiceLabels = all.map(o => ({ ...o, label: normalizedSilkLabel(o) }));

  const buckets = { ser: [] as CatItem[], quadro: [] as CatItem[], elo: [] as CatItem[], sereno: [] as CatItem[] };
  for (const o of withNiceLabels) buckets[silkKind(o) as keyof typeof buckets].push(o);

  buckets.ser.sort(silkSort);
  buckets.quadro.sort(silkSort);
  buckets.elo.sort(silkSort);
  buckets.sereno.sort(silkSort);

  // ordem final requisitada: SER (Prime) → Quadro → Elo → Sereno
  return [...buckets.ser, ...buckets.quadro, ...buckets.elo, ...buckets.sereno];
}, [serPrime, serQuadros, serElo]);

  const allGlassOptions = React.useMemo(
    () => [ ...(glassTipos ?? []), ...(monos ?? []) ],
    [glassTipos, monos]
  );

  // Try match by label or value "Transparente"
  const transparentGlassValue = React.useMemo(() => {
    return (
      matchOption(allGlassOptions, 'Transparente') ||
      matchOption(allGlassOptions, 'transparente') ||
      allGlassOptions.find(o => o.value.toLowerCase() === 'transparente')?.value
    );
  }, [allGlassOptions]);

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
  const comps = form.watch('complementos') ?? [];
  const shelfHeightPct = form.watch('shelfHeightPct') ?? 100;

React.useEffect(() => {
  if (comps.includes('vision')) {
  if (!form.getValues('barColor') && (barColors?.length ?? 0) > 0) {
    form.setValue('barColor', barColors![0].value, { shouldDirty: false });
  }

  if (!form.getValues('visionSupport') && finishesNoAnod.length) {
    const cromado =
      finishesNoAnod.find(f => f.value.toLowerCase() === 'cromado')?.value;

    form.setValue('visionSupport', cromado ?? finishesNoAnod[0].value, {
      shouldDirty: false,
    });
  }
}
  if (comps.includes('toalheiro1') && !form.getValues('towelColorMode')) {
    form.setValue('towelColorMode', 'padrao', { shouldDirty: false });
  }
  if (comps.includes('prateleira') && !form.getValues('shelfColorMode')) {
    form.setValue('shelfColorMode', 'padrao', { shouldDirty: false });
  }
}, [comps, barColors, finishes, finishesNoAnod]);
  
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
    // If we are already submitting or locked, ignore any further submits.
    if (submitting || locked) return;

    setSubmitting(true);

    // helper to convert cm to mm
    const toMm = (cm?: number) => (cm == null ? undefined : Math.round(cm * 10));
    const payload = {
      ...values,
      widthMm:  toMm(values.widthMm),
      heightMm: toMm(values.heightMm),
      depthMm:  toMm(values.depthMm),
    };

    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // same key for the whole page lifetime
          'X-Idempotency-Key': idempKeyRef.current,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Erro ao submeter orçamento');
      }

      const { id } = await res.json();

      // 🔒 lock permanently until navigation (prevents any flicker re-enable)
      setLocked(true);

      // navigate and bail out without resetting submitting
      router.replace(`/orcamentos/sucesso?id=${encodeURIComponent(id)}`);
      return; // IMPORTANT: do not fall through
    } catch (e: any) {
      alert(e?.message || 'Não foi possível submeter o orçamento. Tente novamente.');
      // only unlock on error so user can try again
      setSubmitting(false);
      setLocked(false);
    }
    // ❌ DO NOT setSubmitting(false) here on success;
    // the page will unmount after router.replace()
  };


React.useEffect(() => {
  if (!comps.includes('vision')) {
    if (form.getValues('barColor') != null)
      form.setValue('barColor', undefined, { shouldDirty: true });
    if (form.getValues('visionSupport') != null)
      form.setValue('visionSupport', undefined, { shouldDirty: true });
  }

  if (!comps.includes('toalheiro1')) {
    if (form.getValues('towelColorMode') != null)
      form.setValue('towelColorMode', undefined, { shouldDirty: true });
  }

  if (!comps.includes('prateleira')) {
    if (form.getValues('shelfColorMode') != null)
      form.setValue('shelfColorMode', undefined, { shouldDirty: true });
    if (form.getValues('shelfHeightPct') != null)
      form.setValue('shelfHeightPct', undefined, { shouldDirty: true });
  } else if (form.getValues('shelfHeightPct') == null) {
    form.setValue('shelfHeightPct', 100, { shouldDirty: true });
  }
}, [comps, form]);
  // If model is not Strong/Painel, force-remove "toalheiro1"
React.useEffect(() => {
  if (!showToalheiro1) {
    const curr = form.getValues('complementos') ?? [];
    if (curr.includes('toalheiro1')) {
      form.setValue(
        'complementos',
        curr.filter(c => c !== 'toalheiro1'),
        { shouldDirty: true }
      );
      form.setValue('towelColorMode', undefined, { shouldDirty: true });
    }
  }
}, [showToalheiro1, form]);

    const selSer = form.watch('serigrafiaKey');
    React.useEffect(() => {
      if (!selSer || selSer === 'nenhum') {
        // no serigrafia selected → clear any previous color
        form.setValue('serigrafiaColor', undefined, { shouldDirty: true });
      } else {
        // any serigrafia selected → default color to "padrao" if empty
        if (!form.getValues('serigrafiaColor')) {
          form.setValue('serigrafiaColor', 'padrao', { shouldDirty: true });
        }
      }
    }, [selSer]);

    const wGlass = form.watch('glassTypeKey');
    const wSer = form.watch('serigrafiaKey');
    const wAcr = form.watch('acrylicKey');

// -- synchronous compatibility handlers (avoid double-click) --
const handleGlassChange = (nextVal: string) => {
  form.setValue('glassTypeKey', nextVal, { shouldDirty: true });
  // If glass is NOT Transparente → clear incompatible fields immediately
  if (transparentGlassValue && nextVal !== transparentGlassValue) {
    const currSer = form.getValues('serigrafiaKey') ?? 'nenhum';
    const currAcr = form.getValues('acrylicKey') ?? 'nenhum';
    if (currSer !== 'nenhum') {
      form.setValue('serigrafiaKey', 'nenhum', { shouldDirty: true });
      form.setValue('serigrafiaColor', undefined, { shouldDirty: true });
    }
    if (currAcr !== 'nenhum') {
      form.setValue('acrylicKey', 'nenhum', { shouldDirty: true });
    }
  }
};

const handleSerigrafiaChange = (nextVal: string | undefined) => {
  const v = nextVal ?? 'nenhum';
  form.setValue('serigrafiaKey', v, { shouldDirty: true });
  if (v !== 'nenhum') {
    // serigrafia requires Vidro: Transparente and no acrílico
    if (transparentGlassValue) {
      form.setValue('glassTypeKey', transparentGlassValue, { shouldDirty: true });
    }
    if ((form.getValues('acrylicKey') ?? 'nenhum') !== 'nenhum') {
      form.setValue('acrylicKey', 'nenhum', { shouldDirty: true });
    }
  }
};

const handleAcrylicChange = (nextVal: string | undefined) => {
  const v = nextVal ?? 'nenhum';
  form.setValue('acrylicKey', v, { shouldDirty: true });
  if (v !== 'nenhum') {
    // acrílico requires Vidro: Transparente and no serigrafia
    if (transparentGlassValue) {
      form.setValue('glassTypeKey', transparentGlassValue, { shouldDirty: true });
    }
    if ((form.getValues('serigrafiaKey') ?? 'nenhum') !== 'nenhum') {
      form.setValue('serigrafiaKey', 'nenhum', { shouldDirty: true });
      form.setValue('serigrafiaColor', undefined, { shouldDirty: true });
    }
  }
};
function isAbrirModel(key?: string) {
  if (!key) return false;
  const k = key.toLowerCase();
  return (
    k.includes('sterling')
    || k.includes('diplomatagold')        // ← add this
    || k.includes('diplomata_gold')       // keep this
    || k.includes('diplomata-pivotante')
    || k.includes('diplomata_pivotante')
    || /painel[_-]?v(2|3|4)/.test(k)
  );
}
function isStrongOrPainelModel(key?: string) {
  if (!key) return false;
  const k = key.toLowerCase();
  return k.includes('strong') || k.includes('painel');
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


// Build the `model` query for the external simulator from the current model
const simModelParam = React.useMemo(() => {
  const current = (form.getValues('modelKey') || '').trim();
  if (!current) return '';

  // Normalize separators
  const parts = current.replace(/-/g, '_').split('_').filter(Boolean);

  // Detect trailing vN (case-insensitive)
  const tail = parts[parts.length - 1] || '';
  const vMatch = tail.match(/^v(\d+)$/i);

  // Base = everything before vN; join as PascalCase with NO separators
  const baseParts = vMatch ? parts.slice(0, -1) : parts;
  const basePascal = baseParts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');

  // If we had a version, append _Vn
  return vMatch ? `${basePascal}_V${vMatch[1]}` : basePascal;
}, [modelKey]);
  const selectedFinish = form.watch('finishKey');
  const fixingBarOptions = React.useMemo(
    () => [
      { value: 'padrao',     label: 'Padrão' },
      { value: 'acabamento', label: 'Cor do acabamento' },
    ],
    []
  );
  const serigrafiaColorOptions = React.useMemo(
  () => [
    { value: 'padrao',     label: 'Padrão' },
    { value: 'acabamento', label: 'Cor do acabamento' },
  ],
  []
);
const towelColorOptions = React.useMemo(
  () => [
    { value: 'padrao',     label: 'Padrão' },
    { value: 'acabamento', label: 'Cor do acabamento' },
  ],
  []
);

const serigrafiaColorChoices = React.useMemo(() => {
  // first pseudo-option "Padrão", then the allowed finishes (without cromado/anodizado)
  return [{ value: 'padrao', label: 'Padrão' } as IconOption]
    .concat((finishesNoChromeAnod as unknown as IconOption[]) ?? []);
}, [finishesNoChromeAnod]);

const getSerigrafiaColorIcon = (opt: IconOption) => {
  if (opt.value === 'padrao') {
    // shows Fosco icon (your helper already does this)
    return serigrafiaColorIconSrc('padrao', selectedFinish);
  }
  // real finishes → reuse finish previews
  return finishIconSrc(opt.value);
};

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

  const values = form.watch();

  const simulatorUrl = React.useMemo(() => {
    if (!simModelParam) {
      return 'https://simulador.mfn.pt/';
    }

    const params = new URLSearchParams();
    params.set('model', simModelParam);

    // Acabamento
    if (values.finishKey) {
      params.set('finish', values.finishKey);
    }

    // Vidro / Monocromático
    if (values.glassTypeKey) {
      const g = values.glassTypeKey;
      let glassToken = g;

      // Map "mono_gris" → "gris", "mono_bronze" → "bronze", etc.
      if (g.startsWith('mono_')) {
        glassToken = g.replace(/^mono_/, '');
      }

      params.set('glass', glassToken);
    }

    // Puxador (se modelo permitir)
    if (!hideHandles && values.handleKey) {
      params.set('handle', values.handleKey);
    }

    // Complemento
    if (values.complementos?.length) {
      const clean = values.complementos.filter(c => c !== 'nenhum');
      if (clean.length > 0) {
        params.set('complemento', clean.join(','));
      }
    }

    // Barra de fixação
    if (rule?.hasFixingBar && values.fixingBarMode) {
      params.set('fixingBarMode', values.fixingBarMode);
    }

    // Acrílico
    if (values.acrylicKey && values.acrylicKey !== 'nenhum') {
      params.set('acrylic', values.acrylicKey);
    }

    // Serigrafia
    if (values.serigrafiaKey && values.serigrafiaKey !== 'nenhum') {
      const sel = serigrafias.find(o => o.value === values.serigrafiaKey);
      const silkId = sel ? silkIdFrom(sel.value, sel.label) : values.serigrafiaKey;
      params.set('serigrafia', silkId);

      if (values.serigrafiaColor) {
        // use one of the names the simulator already accepts
        params.set('serigrafiaColor', values.serigrafiaColor);
      }
    }

    // Vision
  if (comps.includes('vision')) {
    if (values.barColor) params.set('barColor', values.barColor);
    if (values.visionSupport) params.set('visionSupport', values.visionSupport);
  }

    // Toalheiro 1
    if (comps.includes('toalheiro1') && values.towelColorMode) {
      params.set('towel', values.towelColorMode); // accepted alias in simulator
    }

    // Prateleira de Canto
    if (comps.includes('prateleira')) {
      if (values.shelfColorMode) {
        params.set('shelf', values.shelfColorMode); // shelfColorMode
      }
      if (values.shelfHeightPct != null) {
        params.set('altura', String(Math.round(values.shelfHeightPct)));
      }
      const cc = values.cornerChoice;
      if (cc === 'corner1' || cc === 'corner2') {
        params.set('corner', cc);
      }
    }

    // Medidas (cm → params; simulator will interpret them)
    if (values.widthMm)  params.set('width',  String(values.widthMm));
    if (values.heightMm) params.set('height', String(values.heightMm));
    if (!hideDepth && values.depthMm) params.set('depth', String(values.depthMm));

    return `https://simulador.mfn.pt/?${params.toString()}`;
  }, [simModelParam, values, hideHandles, hideDepth, rule, serigrafias]);

  return (
  <main className="mx-auto max-w-6xl px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-8">
    {/* Top bar with simulator logo + responsive CTA */}
  <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
    <Image
      src="/brand/logo-trackingapp_dark.png"
      alt="Goldstar Simulator"
      width={220}
      height={48}
      priority
      className="h-16 sm:h-[120px] w-auto"
    />
    <div className="sm:ml-auto w-full sm:w-auto">
      <a
        href={simulatorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-[#122C4F] px-4 py-3 text-white hover:bg-black/90
                  focus:outline-none focus:ring-2 focus:ring-yellow-400/50
                  shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]"
      >
        <Image src="/brand/sim_icon.png" alt="" width={28} height={28} className="h-7 w-7" priority />
        <span className="text-[15px] font-semibold">Ver no Simulador</span>
      </a>
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

        <form
          className="px-6 py-6 space-y-8"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
        >        {/* 2-column: Dados do Cliente + Modelo & Opções */}
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
                  <IconSelect
                    value={field.value}
                    onChange={field.onChange}
                    groups={groupedModels as unknown as Map<string, {value:string;label:string}[]>}
                    getIcon={(opt) => modelIconSrc(opt.value || opt.label)}
                    iconSize={48}       // ícone grande no botão fechado
                    itemIconSize={64}   // ícone maior dentro da lista
                  />
                )}
              />
            </FieldWrap>

              {!hideHandles && (
              <FieldWrap label="Puxador" error={form.formState.errors?.['handleKey']?.message as string | undefined}>
                <Controller
                  name="handleKey"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={field.value}
                      onChange={(v) => field.onChange(v || undefined)}
                      options={handles}
                      getIcon={(opt) => handleIconSrc(opt.value)}
                      iconSize={36}
                      itemIconSize={48}
                    />
                  )}
                />
              </FieldWrap>
            )}

              <FieldWrap label="Acabamento *" error={form.formState.errors?.['finishKey']?.message as string | undefined}>
                <Controller
                  name="finishKey"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={finishes}
                      getIcon={(opt) => finishIconSrc(opt.value)}
                      iconSize={36}
                      itemIconSize={48}
                    />
                  )}
                />
              </FieldWrap>
             {rule?.hasFixingBar && (
              <FieldWrap label="Barra de fixação *" error={form.formState.errors?.['fixingBarMode']?.message as string | undefined}>
                <Controller
                  name="fixingBarMode"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={(field.value ?? '') as string}
                      onChange={(v) => field.onChange(v || undefined)}
                      options={fixingBarOptions}
                      // Padrão -> Anodizado | Acabamento -> preview do "Acabamento" atual
                      getIcon={(opt) => fixBarIconSrc(opt.value as 'padrao'|'acabamento', selectedFinish)}
                      iconSize={36}
                      itemIconSize={48}
                      placeholder="-"
                    />
                  )}
                />
              </FieldWrap>
            )}

              <FieldWrap label="Vidro / Monocromático *" error={form.formState.errors?.['glassTypeKey']?.message as string | undefined}>
                <Controller
                  name="glassTypeKey"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={field.value}
                      onChange={(v) => handleGlassChange(v)}
                      options={[...(glassTipos ?? []), ...(monos ?? [])]}
                      getIcon={(opt) => glassIconSrcFromLabel(opt.label)}
                      iconSize={36}
                      itemIconSize={48}
                    />
                  )}
                />
              </FieldWrap>

              {allowAcrylic && (
                <FieldWrap label="Acrílico / Policarbonato" error={form.formState.errors?.['acrylicKey']?.message as string | undefined}>
                  <Controller
                    name="acrylicKey"
                    control={form.control}
                    render={({ field }) => (
                      <IconSelect
                        value={(field.value ?? '') as string}
                        onChange={(v) => handleAcrylicChange(v || undefined)}
                        options={(catalog?.ACRYLIC_AND_POLICARBONATE ?? [])}
                        getIcon={(opt) => opt.value === 'nenhum' ? '' : acrylicIconSrcFromLabel(opt.label)}
                        iconSize={36}
                        itemIconSize={48}
                      />
                    )}
                  />
                </FieldWrap>
              )}

              <FieldWrap label="Complementos">
                <Controller
                  name="complementos"
                  control={form.control}
                  render={({ field }) => (
                    <ComplementoSelector
                      value={field.value || []}
                      onChange={(v) => field.onChange(v)}
                      options={complementoFiltered}
                    />
                  )}
                />
              </FieldWrap>

              {comps.includes('vision') && (
                <>
                  < FieldWrap label="Cor da Barra Vision *" >
                    <Controller
                      name="barColor"
                      control={form.control}
                      render={({ field }) => (
                        <IconSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={barColors}
                          getIcon={(opt) => visionBarIconSrc(opt.value)}
                          iconSize={36}
                          itemIconSize={48}
                        />
                      )}
                    />
                  </FieldWrap>
                  <FieldWrap label="Cor do suporte Vision *">
                    <Controller
                      name="visionSupport"
                      control={form.control}
                      render={({ field }) => (
                        <IconSelect
                          value={field.value}
                          onChange={field.onChange}
                          options={finishesNoAnod}
                          getIcon={(opt) => finishIconSrc(opt.value)}
                          iconSize={36}
                          itemIconSize={48}
                        />
                      )}
                    />
                  </FieldWrap>
                </>
              )}

              {comps.includes('toalheiro1') && (
                <FieldWrap label="Cor do toalheiro *" error={form.formState.errors?.['towelColorMode']?.message as string | undefined}>
                  <Controller
                    name="towelColorMode"
                    control={form.control}
                    render={({ field }) => (
                      <IconSelect
                        value={(field.value ?? '') as string}
                        onChange={(v) => field.onChange(v || undefined)}
                        options={towelColorOptions}
                        // Padrão -> Cromado | Acabamento -> preview do "Acabamento" atual
                        getIcon={(opt) => towelColorIconSrc(opt.value as 'padrao'|'acabamento', selectedFinish)}
                        iconSize={36}
                        itemIconSize={48}
                        placeholder="-"
                      />
                    )}
                  />
                </FieldWrap>
              )}

              {comps.includes('prateleira') && (
                <>
                  <FieldWrap
                    label="Cor do suporte Prateleira *"
                    error={form.formState.errors?.['shelfColorMode']?.message as string | undefined}
                  >
                    <Controller
                      name="shelfColorMode"
                      control={form.control}
                      render={({ field }) => (
                        <IconSelect
                          value={(field.value ?? '') as string}
                          onChange={(v) => field.onChange(v || undefined)}
                          options={towelColorOptions} // [{padrao},{acabamento}] we already have
                          getIcon={(opt) =>
                            shelfColorIconSrc(opt.value as 'padrao' | 'acabamento', selectedFinish)
                          }
                          iconSize={36}
                          itemIconSize={48}
                          placeholder="-"
                        />
                      )}
                    />
                  </FieldWrap>

                  {/* NEW: Altura da Prateleira slider */}
                  <FieldWrap label={`Altura da prateleira (${shelfHeightPct}% )`}>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      step={1}
                      value={shelfHeightPct}
                      onChange={(e) =>
                        form.setValue('shelfHeightPct', Number(e.target.value), { shouldDirty: true })
                      }
                      className="
                        w-full h-2 appearance-none rounded-full
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
                        [&::-moz-range-thumb]:shadow
                      "
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-slate-500">
                      <span>20%</span>
                      <span>100%</span>
                    </div>
                  </FieldWrap>
                </>
              )}

              <FieldWrap label="Serigrafia" error={form.formState.errors?.['serigrafiaKey']?.message as string | undefined}>
                <Controller
                  name="serigrafiaKey"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={(field.value ?? '') as string}
                      onChange={(v) => handleSerigrafiaChange(v || undefined)}
                      options={serigrafias}
                      getIcon={(opt) => opt.value === 'nenhum' ? '' : silkIconFromOpt(opt)}
                      iconSize={36}
                      itemIconSize={48}
                    />
                  )}
                />
              </FieldWrap>
             {selSer && selSer !== 'nenhum' && (
              <FieldWrap label="Cor da Serigrafia *" error={form.formState.errors?.['serigrafiaColor']?.message as string | undefined}>
                <Controller
                  name="serigrafiaColor"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={(field.value ?? '') as string}
                      onChange={(v) => field.onChange(v || undefined)}
                      options={serigrafiaColorChoices}            // ⬅️ was finishesNoChromeAnod
                      getIcon={getSerigrafiaColorIcon}            // ⬅️ was finishIconSrc(opt.value)
                      iconSize={36}
                      itemIconSize={48}
                      placeholder="-"                              // ⬅️ optional; value shows "Padrão" anyway
                    />
                  )}
                />
              </FieldWrap>
            )}
            </div>
          </section>
        </div>

        {/* Below: single-row sections (unchanged logic, styled) */}
        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-1 text-lg font-medium text-neutral-900">Medidas</h2>
          <p className="mb-3 text-sm text-neutral-600">
            As medidas não necessitam estar 100% exatas: a nossa equipa <b>desloca-se à sua casa </b>
             para confirmar antes da produção. Indique valores próximos da realidade
            para podermos enviar um orçamento o mais preciso possível.
          </p>
          <div className={`grid grid-cols-1 ${hideDepth ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-3`}>
            <NumField f={form} name="widthMm"  label="Largura (cm)" />
            <NumField f={form} name="heightMm" label="Altura (cm)" />
            {!hideDepth && <NumField f={form} name="depthMm"  label="Profundidade (cm)" />}
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
            allowEmpty
            emptyLabel="Selecionar"
            options={[
              { value: 'entrega',    label: 'Entrega' },
              { value: 'instalacao', label: 'Entrega + Instalação (custo adicional)' },
            ]}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Select
              f={form}
              name="housingType"
              label="Tipo de Habitação"
              allowEmpty
              emptyLabel="Selecionar"
              options={HOUSING_TYPES as any}
            />
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

        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
          <h2 className="mb-1 text-lg font-medium text-neutral-900">Oferta de Lançamento</h2>
          <p className="mb-3 text-sm text-neutral-600">
            Seleccione o seu bónus de lançamento. Na compra do seu resguardo GOLDSTAR, oferecemos
            <b> 1 produto exclusivo</b>: Shampoo nutritivo ou Gel de banho hidratante.
          </p>
          <Controller
            name="launchBonus"
            control={form.control}
            render={({ field }) => (
              <BonusPicker
                value={(field.value ?? 'shampooGOLDSTAR') as 'shampooGOLDSTAR' | 'gelGOLDSTAR'}
                onChange={field.onChange}
              />
            )}
          />
        </section>

        <section className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <h2 className="mb-3 text-lg font-medium text-neutral-900">Observações</h2>
          <Textarea f={form} name="notes" label="Notas adicionais" rows={4} />
        </section>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || locked}
            aria-busy={submitting || locked}
            className={[
              "h-11 rounded-xl px-6 text-[15px] font-semibold text-white",
              "bg-black hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-400/50",
              "shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]",
              (submitting || locked) ? "opacity-70 cursor-not-allowed" : ""
            ].join(" ")}
          >
            {(submitting || locked) ? (
              <span className="inline-flex items-center">
                <span className="inline-block animate-spin rounded-full border-neutral-300 border-t-[#FFD200]" style={{width:16,height:16,borderWidth:2}} aria-hidden />
                <span className="ml-2">A enviar…</span>
              </span>
            ) : 'Enviar Orçamento'}
          </button>
        </div>
      </form>
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

// add a new prop `emptyLabel` and use it
function Select({
  f, name, label, options, allowEmpty, emptyLabel = 'Selecionar',
}:{
  f:any; name:keyof FormValues & string; label?:string; options: CatItem[]; allowEmpty?: boolean; emptyLabel?: string;
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
            {allowEmpty && <option value="">{emptyLabel}</option>}
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

function BonusPicker({
  value,
  onChange,
}: {
  value: 'shampooGOLDSTAR' | 'gelGOLDSTAR';
  onChange: (v: 'shampooGOLDSTAR' | 'gelGOLDSTAR') => void;
}) {
  const opts = [
    { id: 'shampooGOLDSTAR' as const, label: 'Shampoo Nutritivo GOLDSTAR', img: '/previews/bonus/shampoo.png' },
    { id: 'gelGOLDSTAR' as const,      label: 'Gel de Banho Hidratante GOLDSTAR', img: '/previews/bonus/gel.png' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {opts.map(o => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.id)}
            className={[
              "rounded-2xl w-full bg-white p-2 sm:p-3 border",
              selected
                ? "border-[#FFD200] ring-2 ring-[#FFD200]"
                : "border-neutral-200 hover:border-neutral-300"
            ].join(' ')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={o.img}
              alt={o.label}
              className="aspect-square w-full object-contain rounded-xl bg-white"
            />
            <span className="mt-2 block text-center text-sm font-medium">{o.label}</span>
          </button>
        );
      })}
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