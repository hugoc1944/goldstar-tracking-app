'use client';

import Image from 'next/image';

const SIM_BASE = (
  process.env.NEXT_PUBLIC_SIM_ORIGIN ?? 'https://simulador.mfn.pt'
).replace(/\/+$/, '');

/**
 * Converts an internal glass catalog key to the canonical inbound simulator value.
 * Strips `mono_` prefix: mono_gris → gris, mono_verde → verde, etc.
 */
function toPublicGlass(raw?: string | null): string {
  if (!raw || raw === 'nenhum') return '';
  const k = raw.toLowerCase().replace(/\s+/g, '');
  if (k.startsWith('mono_')) return k.slice(5);
  return k;
}

/**
 * Normalizes a model catalog key to the "ModelFamily_VN" format the simulator accepts.
 * e.g. "sterling_v3" → "Sterling_V3", "diplomata_gold_v5" → "DiplomataGold_V5"
 */
function toModelParam(input?: string): string {
  if (!input) return '';
  const parts = input
    .replace(/-/g, '_')
    .replace(/\s+/g, '_')
    .split('_')
    .filter(Boolean);
  const tail = parts[parts.length - 1] ?? '';
  const v = tail.match(/^v(\d+)$/i)?.[1];
  const baseParts = v ? parts.slice(0, -1) : parts;
  const base = baseParts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  return v ? `${base}_V${v}` : base;
}

/**
 * Normalizes a serigrafia catalog key to the ID the simulator expects.
 * e.g. "ser005_silkscreen" → "SER005", "quadro1" → "Quadro1", "elo2" → "Elo2"
 */
function toSerigrafiaParam(key: string): string {
  const s = key.trim();
  const ser = s.match(/^ser0*(\d+)/i);
  if (ser) return `SER${String(ser[1]).padStart(3, '0')}`;
  const quadro = s.match(/^quadro\s*(\d+)/i);
  if (quadro) return `Quadro${quadro[1]}`;
  const elo = s.match(/^elo\s*(\d+)/i);
  if (elo) return `Elo${elo[1]}`;
  if (s.toLowerCase().includes('sereno')) return 'Sereno';
  return s.replace(/[\s_-]+/g, '').replace(/^\w/, c => c.toUpperCase());
}

export interface SimulatorButtonProps {
  // — product configuration (drives URL) —
  modelKey?: string;
  finishKey?: string;
  /** Internal glass catalog key — mono_* prefix is stripped automatically. */
  glassTypeKey?: string;
  handleKey?: string;
  acrylicKey?: string;
  serigrafiaKey?: string;
  serigrafiaColor?: string;
  fixingBarMode?: string;
  complementos?: string[];
  barColor?: string;
  visionSupport?: string;
  towelColorMode?: string;
  shelfColorMode?: string;
  shelfHeightPct?: number;
  cornerChoice?: string;
  painelCorner?: string;
  widthMm?: number;
  heightMm?: number;
  depthMm?: number;
  /** Adds compact=1 to put the simulator in locked-viewer mode (admin/PDF). */
  compact?: boolean;
  // — display —
  /** Override the default public branded style. */
  className?: string;
  /** Show the Goldstar simulator icon (default: true). Pass false for compact admin buttons. */
  showIcon?: boolean;
  /** Open link in a new tab (default: false — public form navigates in-place). */
  newTab?: boolean;
  onClick?: () => void;
}

const DEFAULT_CLASS =
  'inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl bg-[#122C4F] px-4 py-3 ' +
  'text-white hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 ' +
  'shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]';

export function SimulatorButton({
  modelKey,
  finishKey,
  glassTypeKey,
  handleKey,
  acrylicKey,
  serigrafiaKey,
  serigrafiaColor,
  fixingBarMode,
  complementos,
  barColor,
  visionSupport,
  towelColorMode,
  shelfColorMode,
  shelfHeightPct,
  cornerChoice,
  painelCorner,
  widthMm,
  heightMm,
  depthMm,
  compact,
  className,
  showIcon = true,
  newTab = false,
  onClick,
}: SimulatorButtonProps) {
  const modelParam = toModelParam(modelKey);
  let href = `${SIM_BASE}/`;

  if (modelParam) {
    const q = new URLSearchParams();
    q.set('model', modelParam);

    if (finishKey) q.set('finish', finishKey);
    if (handleKey) q.set('handle', handleKey);

    const glass = toPublicGlass(glassTypeKey);
    if (glass) q.set('glass', glass);

    if (acrylicKey && acrylicKey !== 'nenhum') q.set('acrylic', acrylicKey);

    if (serigrafiaKey && serigrafiaKey !== 'nenhum') {
      q.set('serigrafia', toSerigrafiaParam(serigrafiaKey));
      if (serigrafiaColor) q.set('serigrafiaColor', serigrafiaColor);
    }

    if (fixingBarMode) q.set('fixingBarMode', fixingBarMode);

    const comps = (complementos ?? [])
      .map(c => c.trim().toLowerCase())
      .filter(c => c && c !== 'nenhum');

    if (comps.length) {
      q.set('complemento', comps.join(','));

      if (comps.includes('vision')) {
        if (barColor) q.set('barColor', barColor);
        if (visionSupport) q.set('visionSupport', visionSupport);
      }
      if (comps.includes('toalheiro1') && towelColorMode) {
        q.set('towel', towelColorMode);
      }
      if (comps.includes('prateleira')) {
        if (shelfColorMode) q.set('shelf', shelfColorMode);
        if (shelfHeightPct != null) q.set('altura', String(Math.round(shelfHeightPct)));
        if (cornerChoice === 'corner1' || cornerChoice === 'corner2') {
          q.set('corner', cornerChoice);
        }
      }
    }

    // painelCorner — only for Painel_V2 when corner is 'reto'
    if (painelCorner === 'reto' && /painel[_-]?v2\b/i.test(modelKey ?? '')) {
      q.set('painelCorner', 'reto');
    }

    if (widthMm) q.set('width', String(widthMm));
    if (heightMm) q.set('height', String(heightMm));
    if (depthMm) q.set('depth', String(depthMm));

    if (compact) q.set('compact', '1');

    href = `${SIM_BASE}/?${q.toString()}`;
  }

  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      className={className ?? DEFAULT_CLASS}
    >
      {showIcon && (
        <Image
          src="/brand/sim_icon.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7"
          priority
        />
      )}
      <span className={showIcon ? 'text-[15px] font-semibold' : undefined}>
        Ver no Simulador
      </span>
    </a>
  );
}
