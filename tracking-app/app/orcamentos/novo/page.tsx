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
function modelStemFromAny(input: string) {
  // normaliza separadores: espaços/hífens -> "_"
  const s = input.replace(/-/g, '_').replace(/\s+/g, '_').trim();

  // detecta versão vN no final (com ou sem "_")
  const m = s.match(/^(.*?)(?:_)?v(\d+)$/i);
  let base = m ? m[1] : s;
  const v = m ? m[2] : undefined;

  // se tiver "_" fazemos PascalCase por tokens; caso contrário, preservamos CamelCase existente
  if (base.includes('_')) {
    base = base
      .split('_')
      .filter(Boolean)
      .map(tok => tok ? tok[0].toUpperCase() + tok.slice(1).toLowerCase() : tok)
      .join('');
  } else {
    // já pode vir em CamelCase; garantimos 1ª letra maiúscula
    base = base ? base[0].toUpperCase() + base.slice(1) : base;
  }

  return v ? `${base}_V${v}` : base;
}

const PRE = '/previews';

// — modelos (agora robusto a label/value com espaços/hífens/CamelCase)
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

// — acabamentos
const finishIconSrc = (name: string) => `${PRE}/finishes/${toPascalNoSep(name)}.png`;

// — puxadores (catálogo usa p.ex. h1..h7/sem); simulador usa Handle_1..8 e none/default
function handleIconSrc(value?: string) {
  if (!value || value === '' ) return `${PRE}/handles/default.png`;
  if (/^h(\d)$/i.test(value)) return `${PRE}/handles/Handle_${value.replace(/^h/i,'')}.png`;
  if (value.toLowerCase() === 'sem') return `${PRE}/handles/none.png`;
  return `${PRE}/handles/default.png`;
}

// — vidros/monos (ficheiros tipo Transparente.png, Fosco.png, Gris.png, ...)
const glassIconSrcFromLabel = (label: string) => `${PRE}/glass/vidros/${labelToStem(label)}.png`;

// — acrílicos (ficheiros tipo AguaViva.png, PolicarbonatoTransparente.png, ...)
const acrylicIconSrcFromLabel = (label: string) => `${PRE}/acrylics/${labelToStem(label)}.png`;

// — serigrafias (ficheiros tipo SER001.png, Quadro1.png, Elo2.png, ...)
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

// — complemento (ícones opcionais)
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

// — Vision > cor da barra (catálogo costuma ter 'glass' | 'white' | 'black')
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
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(' ')
      .filter(Boolean)
      .map(t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
      .join('');

  // Build a candidate list with different casings & extensions
  const candidates = React.useMemo(() => {
    const { dir, file, query } = splitDir(src);
    const base = stripExt(file); // filename without extension
    const exts = ['png', 'jpg']; // keep tight to avoid long loops

    // Some specific helpful shapes:
    // - as-is
    // - lowercased
    // - PascalCase (e.g., "VisioSun" → "Visiosun")
    // - SER ids also in lowercase (SER001 → ser001)
    const shapes = [base, base.toLowerCase(), pascal(base)];
    if (/^ser\d+$/i.test(base.replace(/[^a-z0-9]/gi, ''))) {
      shapes.push(base.toLowerCase());
    }

    // De-duplicate while preserving order
    const seen = new Set<string>();
    const uniq = (arr: string[]) => arr.filter(v => (seen.has(v) ? false : (seen.add(v), true)));

    const out: string[] = [];
    for (const shape of uniq(shapes)) {
      for (const ext of exts) {
        out.push(`${dir}${shape}.${ext}${query}`);
      }
    }
    return uniq(out);
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
  placeholder = '—',
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
    const rawBar = (search.get('barColor') ?? '').toLowerCase();
      if (rawBar) {
        // Friendly aliases → try canonical + localized variants.
        const aliases: Record<string, string[]> = {
          white: ['white', 'branco'],
          black: ['black', 'preto'],
          glass: ['glass', 'vidro', 'transparente'],
        };

        let matched = matchOption(barColorsAll, rawBar);

        if (!matched) {
          for (const [canon, list] of Object.entries(aliases)) {
            if (list.includes(rawBar)) {
              matched =
                matchOption(barColorsAll, canon) ||
                list
                  .filter(a => a !== rawBar)
                  .map(a => matchOption(barColorsAll, a))
                  .find(Boolean);
              if (matched) break;
            }
          }
        }

        if (matched) form.setValue('barColor', matched, { shouldDirty: false });
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
  // If model is not Strong/Painel, force-remove "toalheiro1"
React.useEffect(() => {
  if (!showToalheiro1 && form.getValues('complemento') === 'toalheiro1') {
    form.setValue('complemento', 'nenhum', { shouldDirty: true });
    form.setValue('towelColorMode', undefined, { shouldDirty: true });
  }
}, [showToalheiro1]);

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
  return (
  <main className="mx-auto max-w-6xl p-6 md:p-8">
    {/* Top bar with simulator logo (left) */}
    <div className="mb-5 flex items-center gap-4">
      <Image
        src="/brand/logo-trackingapp_dark.png"
        alt="Goldstar Simulator"
        width={220}
        height={48}
        priority
        className="h-[120px] w-auto"
      />
      <div className="ml-auto">
        <a
          href={`https://simulador.mfn.pt/?model=${encodeURIComponent(simModelParam)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-[#122C4F] px-3 py-2 text-white hover:bg-black/90
                    focus:outline-none focus:ring-2 focus:ring-yellow-400/50
                    shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]"
        >
          <Image
            src="/brand/sim_icon.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10"
            priority
          />
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
                      placeholder="—"
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

              <FieldWrap label="Complemento *" error={form.formState.errors?.['complemento']?.message as string | undefined}>
                <Controller
                  name="complemento"
                  control={form.control}
                  render={({ field }) => (
                    <IconSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={complementoFiltered}   // ← was `complemento`
                      getIcon={(opt) => complementoIconSrc(opt.value)}
                      iconSize={36}
                      itemIconSize={48}
                    />
                  )}
                />
              </FieldWrap>

              {comp === 'vision' && (
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
                  <FieldWrap label="Cor de Suporte *">
                    <Controller
                      name="visionSupport"
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
                </>
              )}

              {comp === 'toalheiro1' && (
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
                        placeholder="—"
                      />
                    )}
                  />
                </FieldWrap>
              )}

              {comp === 'prateleira' && (
                <FieldWrap
                  label="Cor do suporte *"
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
                        placeholder="—"
                      />
                    )}
                  />
                </FieldWrap>
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

export default function NewBudgetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-600">A carregar…</div>}>
      <BudgetFormPageInner />
    </Suspense>
  );
}