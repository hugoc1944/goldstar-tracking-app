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
        setCatalog({});
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
    complements: order.details.complements ?? 'nenhum',
    barColor: order.details.barColor ?? '',
    visionSupport: order.details.visionSupport ?? '',
    towelColorMode: order.details.towelColorMode ?? '',
    shelfColorMode: order.details.shelfColorMode ?? '',
    fixingBarMode: order.details.fixingBarMode ?? '',
  });

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
  async function submit() {
    setSaving(true);
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

            complements: details.complements || null,
            barColor: details.complements === 'vision' ? (details.barColor || null) : null,
            visionSupport: details.complements === 'vision' ? (details.visionSupport || null) : null,
            towelColorMode: details.complements === 'toalheiro1' ? (details.towelColorMode || null) : null,
            shelfColorMode: details.complements === 'prateleira' ? (details.shelfColorMode || null) : null,
            fixingBarMode: showFixBar ? (details.fixingBarMode || null) : null,
          },
          // NEW: delivery
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
            <p className="text-sm text-muted-foreground">Edita os dados do cliente e os detalhes do produto.</p>
          </div>
          <button className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted/50" onClick={onClose} aria-label="Fechar">✕</button>
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
              <Select
                label="Complemento *"
                value={details.complements}
                onChange={(v) => {
                  const next = { ...details, complements: v };
                  if (v !== 'vision') { next.barColor = ''; next.visionSupport = ''; }
                  if (v !== 'toalheiro1') next.towelColorMode = '';
                  if (v !== 'prateleira') next.shelfColorMode = '';
                  setDetails(next);
                }}
                options={ensureSelected(complements, details.complements)}
              />

              {/* Vision-only */}
              {details.complements === 'vision' && (
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
              {allowTowel1 && details.complements === 'toalheiro1' && (
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

              {/* Prateleira de canto */}
              {details.complements === 'prateleira' && (
                <Select
                  label="Cor do suporte *"
                  value={details.shelfColorMode}
                  onChange={(v) => setDetails({ ...details, shelfColorMode: v })}
                  options={[
                    { value: 'padrao', label: 'Padrão' },
                    { value: 'acabamento', label: 'Cor do Acabamento' },
                  ]}
                />
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
