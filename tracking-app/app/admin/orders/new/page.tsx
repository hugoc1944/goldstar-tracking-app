'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import React from 'react';

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

  const glassTipos  = useMemo(() => catalog?.GLASS_TIPO ?? [], [catalog]);
  const monos       = useMemo(() => catalog?.MONOCROMATICO ?? [], [catalog]);
  const acrylics    = useMemo(() => catalog?.ACRYLIC_AND_POLICARBONATE ?? [], [catalog]);
  const serPrime    = useMemo(() => catalog?.SERIGRAFIA_PRIME ?? [], [catalog]);
  const serQuadros  = useMemo(() => catalog?.SERIGRAFIA_QUADROS ?? [], [catalog]);
  const serElo      = useMemo(() => catalog?.SERIGRAFIA_ELO_SERENO ?? [], [catalog]);
  const serigrafias = useMemo(
    () => uniqByValue([...(serPrime ?? []), ...(serQuadros ?? []), ...(serElo ?? [])]),
    [serPrime, serQuadros, serElo]
  );
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
  /* ---------- Submit ---------- */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (etaRequired && !eta) {
      alert('ETA é obrigatória quando o estado inicial é "Em expedição".');
      return;
    }
    setSubmitting(true);
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

          // NEW:
          delivery: {
            deliveryType: delivery.deliveryType,
            housingType:  delivery.housingType || undefined,
            floorNumber:  delivery.floorNumber ? Number(delivery.floorNumber) : undefined,
            hasElevator:  delivery.hasElevator === '1' ? true : false,
          },

          initialStatus,
          eta: eta || null,
          items: [],
          files: [],
        },
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
            <select
              className="w-full border rounded px-3 py-2"
              value={details.model}
              onChange={(e) => setDetails({ ...details, model: e.target.value })}
            >
              {ensureSelectedWithLabel(models, details.model).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Puxador */}
          {!hideHandles && (
            <div>
              <label className="block text-sm mb-1">Puxador</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={details.handleKey}
                onChange={(e) => setDetails({ ...details, handleKey: e.target.value })}
              >
                {ensureSelectedWithLabel(handles, details.handleKey).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Acabamento */}
          <div>
            <label className="block text-sm mb-1">Acabamento *</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={details.finish}
              onChange={(e) => setDetails({ ...details, finish: e.target.value })}
            >
              {ensureSelectedWithLabel(finishes, details.finish).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Fixing bar (if rule) */}
          {showFixBar && (
            <div>
              <label className="block text-sm mb-1">Barra de fixação *</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={details.fixingBarMode}
                onChange={(e) => setDetails({ ...details, fixingBarMode: e.target.value })}
              >
                <option value="padrao">Padrão</option>
                <option value="acabamento">Cor do acabamento</option>
              </select>
            </div>
          )}

          {/* Vidro / Monocromático */}
          <div>
            <label className="block text-sm mb-1">Vidro / Monocromático *</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={details.glassTypeKey}
              onChange={(e) => setDetails({ ...details, glassTypeKey: e.target.value })}
            >
              {ensureSelectedWithLabel([...(glassTipos ?? []), ...(monos ?? [])], details.glassTypeKey).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Acrílico / Policarbonato */}
          {showAcrylic && (
            <div>
              <label className="block text-sm mb-1">Acrílico / Policarbonato</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={details.acrylic}
                onChange={(e) => setDetails({ ...details, acrylic: e.target.value })}
              >
                {ensureSelectedWithLabel(acrylics, details.acrylic).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Complemento */}
          <div>
  <label className="block text-sm mb-1">Complementos *</label>
  <div className="space-y-2 rounded border border-gray-200 p-3">
    {complements.filter(o => o.value !== 'nenhum').map((o) => {
      const checked = comps.includes(o.value);
      return (
        <label key={o.value} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              const next = e.target.checked
                ? [...comps, o.value]
                : comps.filter(v => v !== o.value);

              setDetails((d) => ({
                ...d,
                complements: next,
                ...(o.value === 'vision'     && !e.target.checked ? { barColor:'', visionSupport:'' } : {}),
                ...(o.value === 'toalheiro1' && !e.target.checked ? { towelColorMode:'' } : {}),
                ...(o.value === 'prateleira'&& !e.target.checked ? { shelfColorMode:'' } : {}),
              }));
            }}
          />
          {o.label}
        </label>
      );
    })}

    {comps.length === 0 && (
      <div className="text-xs text-slate-500">Nenhum complemento selecionado.</div>
    )}
  </div>
          </div>

          {/* Vision-only */}
          {hasVision && (
            <>
              <div>
                <label className="block text-sm mb-1">Cor da Barra Vision *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={details.barColor}
                  onChange={(e) => setDetails({ ...details, barColor: e.target.value })}
                >
                  {ensureSelectedWithLabel(vbarColors, details.barColor).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Cor de Suporte *</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={details.visionSupport}
                  onChange={(e) => setDetails({ ...details, visionSupport: e.target.value })}
                >
                  {ensureSelectedWithLabel(finishes, details.visionSupport).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Toalheiro 1 */}
          {allowTowel1 && hasTowel1 && (
            <div>
              <label className="block text-sm mb-1">Cor do toalheiro *</label>
              <select
                className="w-full border rounded px-3 py-2"
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
                className="w-full border rounded px-3 py-2"
                value={details.shelfColorMode}
                onChange={(e) => setDetails({ ...details, shelfColorMode: e.target.value })}
              >
                <option value="padrao">Padrão</option>
                <option value="acabamento">Cor do Acabamento</option>
              </select>
            </div>
          )}

          {/* Serigrafia + cor */}
          <div>
            <label className="block text-sm mb-1">Serigrafia</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={details.serigraphy}
              onChange={(e) => setDetails({
                ...details,
                serigraphy: e.target.value,
                serigrafiaColor: e.target.value === 'nenhum' ? '' : details.serigrafiaColor
              })}
            >
              {ensureSelectedWithLabel(serigrafias, details.serigraphy).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {details.serigraphy && details.serigraphy !== 'nenhum' && (
            <div>
              <label className="block text-sm mb-1">Cor da Serigrafia *</label>
              <select
                className="w-full border rounded px-3 py-2"
                value={details.serigrafiaColor}
                onChange={(e) => setDetails({ ...details, serigrafiaColor: e.target.value })}
              >
                <option value="padrao">Padrão</option>
                <option value="acabamento">Cor do Acabamento</option>
              </select>
            </div>
          )}
        </section>

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
            <Field label="Tipo de Habitação" value={delivery.housingType} onChange={(v) => setDelivery({ ...delivery, housingType: v })} />
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

        {/* Submit */}
        <div className="pt-2">
          <div className="flex items-center justify-center">
            <button
              disabled={submitting}
              className="w-full max-w-sm rounded-xl bg-primary px-4 py-3 text-center text-primary-foreground font-semibold shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? 'A criar…' : 'Criar Pedido'}
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
