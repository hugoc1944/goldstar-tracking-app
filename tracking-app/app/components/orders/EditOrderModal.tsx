'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

type Opt = { value: string; label: string; category?: string | null };
type UploadInfo = { url: string; name: string; size: number; mime?: string };

async function fetchOpts(group: string): Promise<Opt[]> {
  const r = await fetch(`/api/catalog/${group}`);
  if (!r.ok) throw new Error(`Falha a carregar ${group}`);
  return r.json();
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
      phone?: string | null;
      address?: string | null;
      postal?: string | null;
      city?: string | null;
    };
    details: {
      model: string;
      finish?: string;
      acrylic?: string;
      serigraphy?: string;
      monochrome?: string;
      complements?: string;
    };
    files: UploadInfo[];
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  // ------- catalog options -------
    const [models, setModels] = useState<Opt[]>([]);
    const [profiles, setProfiles] = useState<Opt[]>([]);
    const [acrylics, setAcrylics] = useState<Opt[]>([]);
    const [serigs, setSerigs] = useState<Opt[]>([]);
    const [monos, setMonos] = useState<Opt[]>([]);
    const [complements, setComplements] = useState<Opt[]>([]);

  // ------- local form state -------
  const [client, setClient] = useState({
    phone: order.client.phone ?? '',
    address: order.client.address ?? '',
    postal: order.client.postal ?? '',
    city: order.client.city ?? '',
  });

  const [details, setDetails] = useState({
    model: order.details.model ?? 'DIVERSOS',
    finish: order.details.finish ?? 'DIVERSOS',
    acrylic: order.details.acrylic ?? 'DIVERSOS',
    serigraphy: order.details.serigraphy ?? 'DIVERSOS',
    monochrome: order.details.monochrome ?? 'DIVERSOS',
    complements: order.details.complements ?? 'DIVERSOS',
  });

  const [files, setFiles] = useState<UploadInfo[]>(order.files ?? []);
  const [saving, setSaving] = useState(false);

  // Load options (MODEL first, fallback to PROFILE if needed)
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const modelGroup = 'MODEL';
        const finishGroup = 'FINISH'; // change if your finishes live elsewhere
        const [m, p, a, s, mo, c] = await Promise.all([
          fetchOpts('MODEL'),
          fetchOpts('PROFILE'),
          fetchOpts('ACRYLIC'),
          fetchOpts('SERIGRAPHY'),
          fetchOpts('MONOCHROME'),
          fetchOpts('COMPLEMENT'),
        ]);
        if (!live) return;
        setModels(m);
        setProfiles(p);
        setAcrylics(a);
        setSerigs(s);
        setMonos(mo);
        setComplements(c);
      } catch {
        // keep defaults if it fails; UI will still render
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // ------- file handlers -------
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
  async function submit() {
    setSaving(true);
    try {
      const r = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          client,
          details: {
            model: details.model,
            finish: details.finish,
            acrylic: details.acrylic,
            serigraphy: details.serigraphy,
            monochrome: details.monochrome,
            complements: details.complements,
          },
          files,
        }),
      });
      if (!r.ok) throw new Error('Falha ao guardar');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // ------- accessibility/close on ESC/backdrop -------
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function backdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  // ------- helpers -------
  const Input = ({
    label,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
    <div className="space-y-1">
      <label className="text-sm text-foreground">{label}</label>
      <input
        {...props}
        className={`w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring ${
          props.className ?? ''
        }`}
      />
    </div>
  );

  function Select({
    label,
    value,
    onChange,
    options,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: Opt[];
  }) {
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
      ref={backdropRef}
      onMouseDown={backdropClick}
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      aria-modal
      role="dialog"
    >
      {/* Card */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-2xl font-semibold">Alterar Pedido</h3>
            <p className="text-sm text-muted-foreground">
              Edita os dados do cliente e os detalhes do produto. As alterações são aplicadas
              imediatamente após guardar.
            </p>
          </div>
          <button
            className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted/50"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Col 1 — Cliente */}
            <section className="space-y-3">
              <h4 className="text-base font-medium">Dados do cliente</h4>

              <Input
                label="Telefone"
                placeholder="Ex.: 912 345 678"
                value={client.phone}
                onChange={(e) => setClient({ ...client, phone: e.target.value })}
              />
              <Input
                label="Código Postal"
                placeholder="Ex.: 3810-123"
                value={client.postal}
                onChange={(e) => setClient({ ...client, postal: e.target.value })}
              />
              <div className="space-y-1">
                <label className="text-sm text-foreground">Localidade</label>
                <input
                  placeholder="Ex.: Aveiro"
                  value={client.city}
                  onChange={(e) => setClient({ ...client, city: e.target.value })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-foreground">Morada</label>
                <textarea
                  placeholder="Ex.: Rua, nº, andar…"
                  value={client.address}
                  onChange={(e) => setClient({ ...client, address: e.target.value })}
                  className="h-28 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </section>

            {/* Col 2 — Produto */}
            <section className="space-y-3">
              <h4 className="text-base font-medium">Detalhes do produto</h4>

              <Select
                label="Modelo"
                value={details.model}
                onChange={(v) => setDetails({ ...details, model: v })}
                options={models}
              />
              <Select
                label="Acabamentos"
                value={details.finish}
                onChange={(v) => setDetails({ ...details, finish: v })}
                options={profiles}
              />
              <Select
                label="Acrílicos/Policarbonatos"
                value={details.acrylic}
                onChange={(v) => setDetails({ ...details, acrylic: v })}
                options={acrylics}
              />
              <Select
                label="Serigrafias"
                value={details.serigraphy}
                onChange={(v) => setDetails({ ...details, serigraphy: v })}
                options={serigs}
              />
              <Select
                label="Monocromáticos"
                value={details.monochrome}
                onChange={(v) => setDetails({ ...details, monochrome: v })}
                options={monos}
              />
              <Select
                label="Complementos"
                value={details.complements}
                onChange={(v) => setDetails({ ...details, complements: v })}
                options={complements}
              />
            </section>
          </div>

          {/* Files */}
          <section className="mt-8">
            <h4 className="text-base font-medium">Ficheiros técnicos</h4>
            <div className="mt-3 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-muted/60">
                Carregar novo
                <input
                  type="file"
                  className="hidden"
                  onChange={onPickFile}
                  // tweak as needed:
                  accept=".pdf,.png,.jpg,.jpeg,.svg,.dxf,.ai,.psd,.doc,.docx,.xls,.xlsx"
                />
                <span className="ml-2">⬆</span>
              </label>
            </div>

            <ul className="mt-3 space-y-2 text-sm">
              {files.length === 0 ? (
                <li className="text-muted-foreground">Nenhum ficheiro carregado.</li>
              ) : (
                files.map((f) => (
                  <li
                    key={`${f.url}-${f.name}`}
                    className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2"
                  >
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
        </div>

        {/* Footer (sticky) */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-white/80 px-6 py-4">
          <button className="rounded-xl px-4 py-2 text-muted-foreground hover:bg-muted/60" onClick={onClose}>
            Cancelar
          </button>
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
