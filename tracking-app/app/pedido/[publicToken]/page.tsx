'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};


/* Goldstar mini spinner (reuse) */
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

/* ---------- Types coming from /api/pedido/[publicToken]/status ---------- */
type Step = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';

type PublicItem = {
  description: string;
  quantity: number;
  model?: string | null;
  complements?: string | null;
  customizations?: Record<string, string | null> | null;
};

type DeliveryInfo = {
  deliveryType?: string | null;
  housingType?: string | null;
  floorNumber?: number | null;
  hasElevator?: boolean | null;
};

type Measures = {
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  willSendLater?: boolean | null;
};

type Payload = {
  ref: string;
  status: Step;
  createdAt: string;
  eta: string | null;
  clientName: string | null;
  items: PublicItem[];
  events: Array<{ from: Step; to: Step; at: string; note: string | null }>;
  visitAwaiting?: boolean;
  delivery?: DeliveryInfo;
  measures?: Measures;
  photoUrls?: string[] | null;

  requiresConfirmation?: boolean;
  pdfUrl?: string | null; 
};

/* ------------------------------- Helpers ------------------------------- */
const CUSTOM_LABEL: Record<string, string> = {
  // legacy -> keep human-friendly names but avoid duplicate "Acrílico / Policarbonato"
  finish: 'Acabamento',
  acrylic: 'Acrílico',                // changed from "Acrílico / Policarbonato"
  serigraphy: 'Serigrafia',
  monochrome: 'Monocromáticos',
  complements: 'Complemento',

  // new public/admin vocabulary
  finishKey: 'Acabamento',
  glassTypeKey: 'Vidro / Monocromático',
  handleKey: 'Puxador',
  acrylicKey: 'Acrílico',             // keep this simple
  serigrafiaKey: 'Serigrafia',
  serigrafiaColor: 'Cor da Serigrafia',
  complemento: 'Complemento',
  barColor: 'Cor da Barra Vision',
  visionSupport: 'Cor de Suporte',
  towelColorMode: 'Cor do Toalheiro',
  shelfColorMode: 'Cor do Suporte',
  fixingBarMode: 'Barra de Fixação',
};

const PT: Record<Step, string> = {
  PREPARACAO: 'Em preparação',
  PRODUCAO: 'Em produção',
  EXPEDICAO: 'Em expedição',
  ENTREGUE: 'Entregue',
};

function RailDot({ active }: { active: boolean }) {
  // small green LED-like dot; “active” means the current left light on
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${
        active ? 'bg-emerald-500' : 'bg-neutral-300'
      }`}
    />
  );
}

function formatCustomizationValue(key: string, value: unknown): string {
  if (value == null) return '-';

  // arrays → comma-separated
  if (Array.isArray(value)) {
    return value.map(v => formatCustomizationValue(key, v)).join(', ');
  }
  // booleans → Sim/Não
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  // numbers → as-is
  if (typeof value === 'number') return String(value);
  // non-strings we can't format
  if (typeof value !== 'string') return '-';

  let v = value.trim();
  if ((key === 'handleKey' || key === 'handle') && /^h(\d)$/i.test(v)) {
    const n = v.match(/^h(\d)$/i)![1];
    return `Puxador ${n}`;
  }
  if (!v) return '-';

  // ✅ Serigrafia: keep only the code (e.g. "Ser001 Silkscreen" → "SER001")
  if (key === 'serigrafiaKey' || key === 'serigrafia' || key === 'serigraphy') {
    const m = v.match(/(ser\d+)/i);
    if (m) return m[1].toUpperCase();
  }

  // Keep pure SER codes intact (e.g. "SER001")
  if (/^SER\d+$/i.test(v)) return v.toUpperCase();

  // Humanize known enumerations
  const SPECIAL: Record<string, Record<string, string>> = {
    deliveryType:      { entrega: 'Entrega', entrega_instalacao: 'Entrega + Instalação' },
    towelColorMode:    { padrao: 'Padrão', acabamento: 'Cor do Acabamento' },
    shelfColorMode:    { padrao: 'Padrão', acabamento: 'Cor do Acabamento' },
    fixingBarMode:     { padrao: 'Padrão', acabamento: 'Cor do Acabamento' },
    serigrafiaColor:   { padrao: 'Padrão', acabamento: 'Cor do Acabamento' },
    complemento:       { vision: 'Vision', toalheiro1: 'Toalheiro 1', prateleira: 'Prateleira (canto)', nenhum: 'Nenhum' },
    complements:       { vision: 'Vision', toalheiro1: 'Toalheiro 1', prateleira: 'Prateleira (canto)', nenhum: 'Nenhum' },
  };
  const map = SPECIAL[key];
  if (map?.[v]) return map[v];

  // snake_case / ALLCAPS → Title Case
  return v.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const STEPS: Step[] = ['PREPARACAO', 'PRODUCAO', 'EXPEDICAO', 'ENTREGUE'];
const pretty = (v?: string | null) => (v && v !== 'DIVERSOS' ? v : '-');
function fmtDate(d?: string | Date | null) {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortRef(id?: string) {
  if (!id) return '-';
  return `#${id.slice(0, 4)}`;
}

const fmtEUR = (c?: number | null) =>
  typeof c === 'number'
    ? (c / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
    : '-';

function humanizeModelName(m?: string | null) {
  if (!m) return '-';
  // underscores/hyphens → spaces
  let s = m.replace(/[_-]+/g, ' ').trim();
  // "Europa V3" (or "v3") → "Europa Variação 3"
  s = s.replace(/\b[vV](\d+)\b/g, (_m, n) => `Variação ${n}`);
  // Title case per space-delimited token (avoid odd Unicode boundaries)
  s = s
    .split(/\s+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
  return s;
}

// --- Turbo detector (same logic as OrcamentoPDF) ---
function isTurboModelKey(key?: string | null) {
  if (!key) return false;
  return String(key).toLowerCase().replace(/[\s_-]+/g, '').startsWith('turbo');
}


function pickUrl(anyVal: any): string | null {
  if (!anyVal) return null;
  if (typeof anyVal === 'string') return anyVal;
  return anyVal.url ?? anyVal.href ?? anyVal.fileUrl ?? anyVal.downloadUrl ?? anyVal.src ?? null;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] tracking-wide text-neutral-600">{label}</div>
      <div className="truncate text-lg font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function iconFor(step: Step) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24' };
  switch (step) {
    case 'PREPARACAO': // clipboard
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>
          <path d="M9 4v1.5a1.5 1.5 0 0 0 1.5 1.5h3A1.5 1.5 0 0 0 15 5.5V4"/>
          <path d="M8 10h5M8 13h3M8 16h6"/>
        </svg>
      );
    case 'PRODUCAO': // box
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21 7-9-4-9 4 9 4 9-4Z" />
          <path d="M12 11v9" />
          <path d="M3 7v9l9 4 9-4V7" />
        </svg>
      );
    case 'EXPEDICAO': // truck
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 16V7h10v9" />
          <path d="M13 10h4l4 3v3h-3" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
      );
    case 'ENTREGUE':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {/* Box outline */}
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z" />
          {/* Checkmark centered */}
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
  }
}
/* -------------------------------- Page --------------------------------- */
export default function PublicOrderPage({
  params,
}: {
  // Next.js 15+: params is a Promise – but direct access still works for now.
  params: { publicToken: string } | Promise<{ publicToken: string }>;
}) {
  // Unwrap params for forward compatibility
  const { publicToken } =
    typeof (params as any).then === 'function' ? (require('react') as any).use(params) : (params as any);

  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  const [success, setSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [confirming, setConfirming] = useState(false);
  const confirmKeyRef = useState(
    () => (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now())
  )[0]; // idempotency per page-load

  // optional: clear timers if you leave the page
  useEffect(() => {
    let t: any;
    if (cooldown > 0) {
      t = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    }
    return () => t && clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        const r = await fetch(`/api/pedido/${publicToken}/status`, { cache: 'no-store' });
        if (!r.ok) {
          setErr('Pedido não encontrado.');
          setData(null);
          return;
        }
        setData(await r.json());
      } catch (e) {
        setErr('Falha a carregar o pedido.');
        setData(null);
      }
    }
    if (publicToken) load();
  }, [publicToken]);

  const reachedAt = useMemo(() => {
    const m = new Map<Step, Date>();
    data?.events.forEach((e) => {
      m.set(e.to, new Date(e.at));
    });
    // The first step is implicitly “reached” at creation
    if (data?.createdAt) m.set('PREPARACAO', new Date(data.createdAt));
    return m;
  }, [data]);

  const currentStepIndex = useMemo(
    () => Math.max(0, STEPS.indexOf(data?.status ?? 'PREPARACAO')),
    [data?.status]
  );

  async function sendMessage() {
  if (cooldown > 0 || !msg.trim()) return;

  setSending(true);
  setSuccess(null);

  try {
    const r = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author: 'CLIENTE',
        publicToken,
        body: msg.trim(),
      }),
    });

    if (!r.ok) throw new Error('Falha a enviar mensagem');

    setMsg('');
    setSuccess('Mensagem enviada com sucesso. Obrigado!');

    // lock for 60 seconds
    setCooldown(120);
  } catch (e) {
    setSuccess(null);
    alert('Não foi possível enviar a mensagem. Tente novamente dentro de instantes.');
  } finally {
    setSending(false);
  }
}

  async function confirmOrder() {
    if (confirming || !data?.requiresConfirmation) return;  // hard block
    setConfirming(true);
    try {
      const r = await fetch(`/api/pedido/${publicToken}/confirm`, {
        method: 'POST',
        headers: { 'X-Idempotency-Key': confirmKeyRef },
      });
      if (!r.ok) throw new Error('Falha ao confirmar');

      // Refetch status so the UI leaves the confirmation state
      const rr = await fetch(`/api/pedido/${publicToken}/status`, { cache: 'no-store' });
      if (rr.ok) setData(await rr.json());
    } catch {
      alert('Não foi possível confirmar. Tente novamente.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: '#fcfbfc', padding: 20}}>
      {/* top bar with logo left */}
      <div className=" pt-1 z-40">
      <Image
        src="/brand/logo-trackingapp_dark.png"
        alt="Goldstar"
        width={280}
        height={48}
        priority
        className="h-[75px] w-auto"
      />
    </div>
     <div className="mx-auto w-full max-w-6xl">
        {/* centered title */}
        <h1 className="text-center text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900">
          Acompanhe o Seu Pedido
        </h1>
        {/* error banner (if any) */}
        {err && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}
          </div>)}
        {/* main card */}
        <section className="mt-6 rounded-2xl bg-white" style={{ boxShadow: '0 0 18px 1px rgba(192,134,37,0.21)' }}>
          {/* meta in one line (wraps on small screens) */}
          <div className="flex flex-wrap gap-8 border-b border-neutral-200 px-6 py-5 md:gap-14">
            <Meta label="Nº do pedido" value={shortRef(data?.ref)} />
            <Meta label="Data do registo" value={fmtDate(data?.createdAt)} />
            <Meta label="Data prevista de entrega" value={fmtDate(data?.eta)} />
          </div>

        {/* status rail */}
        {!data?.requiresConfirmation && (
        <div className="border-b border-neutral-200 px-6 py-6">
          <h3 className="mb-4 text-[17px] font-bold text-neutral-900">
            Tracking do pedido
          </h3>

          <div className="relative mx-auto max-w-4xl">
            {/* base track (light) */}
            <div className="absolute left-6 right-6 top-8 h-1.5 rounded-full bg-neutral-200 z-0" />

            {/* filled track (yellow) */}
            {(() => {
              const ratio =
                (STEPS.length > 1 ? currentStepIndex / (STEPS.length - 1) : 0);
              return (
                <div
                  className="absolute left-6 top-8 h-1.5 rounded-full bg-yellow-400 transition-[width] duration-500 z-0"
                  style={{ width: `calc((100% - 3.8rem) * ${ratio})` }}
                />
              );
            })()}

            {/* steps */}
            <div className="relative grid grid-cols-4 gap-4 z-10">
              {STEPS.map((s, i) => {
                const done = i <= currentStepIndex;
                const when = reachedAt.get(s);
                return (
                  <div key={s} className="flex flex-col items-center text-center">
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-full border-2 ${
                        done
                          ? 'border-yellow-500 bg-yellow-100 text-yellow-700 ring-4 ring-yellow-50'
                          : 'border-neutral-300 bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {iconFor(s)}
                    </div>
                    <div
                      className={`mt-2 text-sm font-medium ${
                        done ? 'text-neutral-900' : 'text-neutral-500'
                      }`}
                    >
                      {s === 'PREPARACAO' && data?.visitAwaiting ? (
                        <span className="inline-flex items-center">
                        <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" />
                          Aguarda visita do técnico
                        </span>
                      ) : (
                        PT[s]
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{fmtDate(when)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}



        {data?.requiresConfirmation && (
          <div className="border-b border-neutral-200 px-6 py-6">
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="mb-1 text-[17px] font-bold text-neutral-900">Confirmação do Orçamento</h3>
              <p className="mb-3 text-[14px] text-neutral-700">
                Para iniciarmos a preparação do seu pedido, confirme o orçamento.
              </p>
                {data?.pdfUrl && (
                <a
                  href={data.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mr-3 inline-flex items-center justify-center h-11 rounded-xl border border-neutral-300 px-6
                            text-[15px] font-semibold text-neutral-900 bg-white hover:bg-neutral-50"
                >
                  Ver Orçamento
                </a>
              )}
              <button
                onClick={confirmOrder}
                disabled={confirming}
                aria-busy={confirming}
                className={[
                  "h-11 rounded-xl px-6 text-[15px] font-semibold text-white",
                  "bg-black hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-400/50",
                  "shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_8px_rgba(250,204,21,0.35)]",
                  confirming ? "opacity-70 cursor-not-allowed" : ""
                ].join(" ")}
              >
                {confirming ? (<span className="inline-flex items-center"><GsSpinner /><span className="ml-2">A confirmar…</span></span>) : 'Confirmo o Orçamento'}
              </button>
            </div>
          </div>
        )}

          {/* support / message */}
          <div className="border-b border-neutral-200 px-6 py-6">
            <h3 className="mb-1 text-[17px] font-bold text-neutral-900">
              Suporte GOLD<span className="text-yellow-500">STAR</span>
            </h3>
            <p className="mb-3 text-[13px] text-neutral-600">
              Tem alguma dúvida ou precisa de suporte com a sua encomenda? Envie-nos uma mensagem.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <textarea
                className="min-h-[96px] flex-1 rounded-xl border border-neutral-300 bg-neutral-50 p-3 text-[14px] outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                placeholder="Escreva a tua mensagem aqui"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !msg.trim()}
                className="h-[48px] rounded-xl bg-yellow-400 px-6 text-[15px] font-semibold text-neutral-900 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60 sm:h-[96px]"
              >
                {sending ? 'A enviar…' : 'Enviar'}
              </button>
            </div>
            {/* success message */}
            {success && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                {success} {cooldown > 0 && <span className="opacity-80">Pode enviar nova mensagem em {cooldown}s.</span>}
              </div>
            )}
          </div>

          {/* order details */}
          {/* order details */}
          {!data?.requiresConfirmation && (
          <div className="border-b border-neutral-200 px-6 py-6">
            <h3 className="mb-4 text-[17px] font-bold text-neutral-900">Detalhes do pedido</h3>

            <div className="grid gap-6 md:grid-cols-2">
              {/* ESQUERDA: Modelo e customizações */}
              <div className="rounded-xl bg-neutral-50 p-4">
                <h4 className="mb-2 text-sm font-medium text-neutral-700">Modelo e customizações</h4>
                {(() => {
                  const base = data?.items?.[0];
                  if (!base) return <div className="text-neutral-500">Sem itens.</div>;

                  // Build rows in a friendly, ordered way
                  type Row = { label: string; value: string };
                  const rows: Row[] = [];
                  const seen = new Set<string>();
                  // 1) Modelo
                  rows.push({
                    label: 'Modelo',
                    value: humanizeModelName(base.model || base.description),
                  });

                  // 2) Complemento (se existir e não for "Nenhum")
                  if (base.complements != null) {
                    const compText = formatCustomizationValue('complements', base.complements);
                    if (compText && compText !== 'Nenhum' && compText !== '-') {
                      rows.push({ label: CUSTOM_LABEL['complements'], value: compText });
                      seen.add('complemento');
                    }
                  }

                  // 3) Customizações selecionadas - ordenadas e sem “Nenhum”
                  // ---------- Turbo-aware ordered customizations ----------
                  const cust = base.customizations ?? {};
                  const isTurbo = isTurboModelKey(base.model ?? (cust as any).modelKey ?? null);

                  // ordered keys to display (we'll special-case glass/acrylic)
                  const ORDERED_KEYS = [
                    'handleKey',
                    'finishKey',
                    'glassTypeKey',   // handled specially if Turbo
                    'acrylicKey',     // handled specially for Turbo (preferred)
                    'serigrafiaKey',
                    'serigrafiaColor',
                    'barColor',
                    'visionSupport',
                    'towelColorMode',
                    'shelfColorMode',
                    'fixingBarMode',
                    'complemento',
                  ];
                  const EXCLUDE = new Set([
                    'widthMm',
                    'heightMm',
                    'depthMm',
                    'willSendLater',
                    'quotedPdfUrl',
                    'sourceBudgetId',
                    'photoUrls',
                    'priceCents',
                    'installPriceCents',
                    'modelKey',
                  ]);

                  for (const k of ORDERED_KEYS) {
                    if (EXCLUDE.has(k)) continue;

                    // Turbo: hide glassTypeKey and Barra de Fixação (fixingBarMode);
                    // prefer Acrylic row instead
                    if (isTurbo && (k === 'glassTypeKey' || k === 'fixingBarMode')) continue;

                    if (k === 'acrylicKey' && isTurbo) {
                      // Turbo-specific acrylic row: show acrylicKey or fallback to "Água Viva"
                      const raw = (cust as any)[k];
                      const fv = formatCustomizationValue(k, raw);
                      const value = fv && fv !== '-' ? fv : 'Água Viva';
                      rows.push({ label: 'Acrílico', value });
                      seen.add('acrylic');
                      seen.add('acrylicKey');
                      continue;
                    }

                    if (!(k in cust)) continue;
                    const fv = formatCustomizationValue(k, (cust as any)[k]);
                    if (k === 'complemento' && seen.has('complemento')) continue;
                    if (!fv || fv === 'Nenhum' || fv === '-') continue;

                    rows.push({ label: CUSTOM_LABEL[k] ?? k, value: fv });
                  }

                  // any remaining custom keys (not in ORDERED_KEYS)
                  for (const [k, v] of Object.entries(cust)) {
                    if (EXCLUDE.has(k) || ORDERED_KEYS.includes(k) || seen.has(k)) continue;
                    const fv = formatCustomizationValue(k, v);
                    if (!fv || fv === 'Nenhum' || fv === '-') continue;
                    rows.push({ label: CUSTOM_LABEL[k] ?? k, value: fv });
                  }

                  

                  return rows.length ? (
                    <ul className="space-y-1 text-[14px]">
                      {rows.map((r, i) => (
                        <li key={`${r.label}-${i}`}>
                          <span className="font-medium">{r.label}:</span> {r.value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[14px] text-neutral-600">Sem informação adicional.</div>
                  );
                })()}
              </div>

              {/* DIREITA: Informação Adicional (Medidas + Entrega/Instalação) */}
              <div className="rounded-xl bg-neutral-50 p-4">
                <h4 className="mb-2 text-sm font-medium text-neutral-700">Informação Adicional</h4>

                {(() => {
                  const base = data?.items?.[0];
                  const cust = (base?.customizations ?? {}) as Record<string, any>;

                  // Medidas via payload; se vazio, cair nos customizations do item
                  const wMm =
                    data?.measures?.widthMm ?? (cust.widthMm != null ? Number(cust.widthMm) : null);
                  const hMm =
                    data?.measures?.heightMm ?? (cust.heightMm != null ? Number(cust.heightMm) : null);
                  const dMm =
                    data?.measures?.depthMm ?? (cust.depthMm != null ? Number(cust.depthMm) : null);

                  const toCm = (mm?: number | null) => (mm == null ? '-' : `${Math.round(mm / 10)} cm`);

                  // --- NOVO: preços para mostrar aqui ---
                  const asNumber = (x: any): number | null => {
                    if (x == null) return null;
                    const n = typeof x === 'string' ? Number(x) : x;
                    return typeof n === 'number' && !Number.isNaN(n) ? n : null;
                  };

                  const priceCents =
                    asNumber((cust as any).priceCents) ??
                    asNumber((base as any)?.priceCents);

                  const installCents =
                    asNumber((cust as any).installPriceCents) ??
                    asNumber((base as any)?.installPriceCents);

                  return (
                    <div className="grid gap-4 md:grid-cols-1">
                      {/* Valores do Orçamento */}
                      {(priceCents != null || installCents != null) && (
                        <div className="rounded-lg bg-white/60 p-3">
                          <h5 className="mb-1 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                            Valores do Orçamento
                          </h5>
                          <ul className="space-y-1 text-[14px]">
                            {installCents != null && (
                              <li>
                                <span className="font-medium">Preço de instalação:</span>{' '}
                                {fmtEUR(installCents)}
                              </li>
                            )}
                            {priceCents != null && (
                              <li>
                                <span className="font-medium">Preço:</span> {fmtEUR(priceCents)}
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Medidas */}
                      <div className="rounded-lg bg-white/60 p-3">
                        <h5 className="mb-1 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                          Medidas
                        </h5>
                        <ul className="space-y-1 text-[14px]">
                          <li>
                            <span className="font-medium">Largura:</span> {toCm(wMm)}
                          </li>
                          <li>
                            <span className="font-medium">Altura:</span> {toCm(hMm)}
                          </li>
                          <li>
                            <span className="font-medium">Profundidade:</span> {toCm(dMm)}
                          </li>
                        </ul>
                      </div>

                      {/* Entrega / Instalação */}
                      <div className="rounded-lg bg-white/60 p-3">
                        <h5 className="mb-1 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
                          Entrega / Instalação
                        </h5>
                        {(() => {
                          const d = data?.delivery;
                          return (
                            <ul className="space-y-1 text-[14px]">
                              <li>
                                <span className="font-medium">Tipo:</span>{' '}
                                {formatCustomizationValue('deliveryType', d?.deliveryType)}
                              </li>
                              <li>
                                <span className="font-medium">Habitação:</span>{' '}
                                {formatCustomizationValue('housingType', d?.housingType)}
                              </li>
                              <li>
                                <span className="font-medium">Andar:</span> {d?.floorNumber ?? '-'}
                              </li>
                              <li>
                                <span className="font-medium">Elevador:</span>{' '}
                                {d?.hasElevator == null ? '-' : d.hasElevator ? 'Sim' : 'Não'}
                              </li>
                            </ul>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
          )}

          <div className="px-6 py-6">
            <h3 className="mb-4 text-[17px] font-bold text-neutral-900">Detalhes do cliente</h3>
            <div className="rounded-xl bg-neutral-50 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-yellow-400 text-neutral-900">
                  <svg width="40" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5.33 0-8 2.667-8 6v1h16v-1c0-3.333-2.67-6-8-6Z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-medium text-neutral-900">
                    {data?.clientName ?? 'Cliente'}
                  </div>
                  {/* Se expuser email/phone/nif/morada no endpoint público, adicione bullets aqui */}
                </div>
              </div>
            </div>
          </div> 
        </section>

        
      </div>
    </div>
  );
}
