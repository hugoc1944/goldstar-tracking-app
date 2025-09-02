'use client';

import { useEffect, useState } from 'react';

type Opt = { value: string; label: string; category?: string | null };
type UploadInfo = { url: string; name: string; size: number; mime?: string };

async function fetchOpts(group: string): Promise<Opt[]> {
  const r = await fetch(`/api/catalog/${group}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Falha a carregar opções');
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
    tracking?: string | null;
    client: {
      phone?: string | null;
      address?: string | null;
      postal?: string | null;
      city?: string | null;
    };
    details: {
      model: string;
      finish?: string | null;
      acrylic?: string | null;
      serigraphy?: string | null;
      monochrome?: string | null;
    };
    files: UploadInfo[];
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [models, setModels] = useState<Opt[]>([]);
  const [finishes, setFinishes] = useState<Opt[]>([]);
  const [acrylics, setAcrylics] = useState<Opt[]>([]);
  const [serigs, setSerigs] = useState<Opt[]>([]);
  const [monos, setMonos] = useState<Opt[]>([]);

  const [client, setClient] = useState({
    phone: order.client.phone ?? '',
    address: order.client.address ?? '',
    postal: order.client.postal ?? '',
    city: order.client.city ?? '',
  });

  const [details, setDetails] = useState({
    model: order.details.model || 'DIVERSOS',
    finish: order.details.finish ?? 'DIVERSOS',
    acrylic: order.details.acrylic ?? 'DIVERSOS',
    serigraphy: order.details.serigraphy ?? 'DIVERSOS',
    monochrome: order.details.monochrome ?? 'DIVERSOS',
    tracking: order.tracking ?? '',
  });

  const [files, setFiles] = useState<UploadInfo[]>(order.files ?? []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, f, a, s, mn] = await Promise.all([
        fetchOpts('MODEL'),
        fetchOpts('PROFILE'), // finishes live in PROFILE per your seed
        fetchOpts('ACRYLIC'),
        fetchOpts('SERIGRAPHY'),
        fetchOpts('MONOCHROME'),
      ]);
      if (!alive) return;
      setModels(m);
      setFinishes(f);
      setAcrylics(a);
      setSerigs(s);
      setMonos(mn);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const up = await uploadFile(f);
    setFiles((prev) => [...prev, up]);
    e.target.value = '';
  }
  function removeFile(name: string) {
    setFiles((prev) => prev.filter((x) => x.name !== name));
  }

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
            tracking: details.tracking || null,
          },
          files,
        }),
      });
      if (!r.ok) throw new Error('Falha ao guardar pedido');
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-[101] bg-black/40 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="w-[880px] max-w-[95%] rounded-2xl bg-white p-6 shadow-xl"
        onClick={stop}
      >
        <h3 className="text-lg font-semibold">Editar pedido</h3>

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Cliente */}
          <section className="space-y-2">
            <h4 className="font-medium">Dados do cliente</h4>
            <input
              className="input"
              placeholder="Telefone"
              value={client.phone}
              onChange={(e) => setClient({ ...client, phone: e.target.value })}
            />
            <input
              className="input"
              placeholder="Código Postal"
              value={client.postal}
              onChange={(e) => setClient({ ...client, postal: e.target.value })}
            />
            <input
              className="input"
              placeholder="Localidade"
              value={client.city}
              onChange={(e) => setClient({ ...client, city: e.target.value })}
            />
            <textarea
              className="input"
              placeholder="Morada"
              value={client.address}
              onChange={(e) => setClient({ ...client, address: e.target.value })}
            />
          </section>

          {/* Detalhes */}
          <section className="space-y-2">
            <h4 className="font-medium">Detalhes do produto</h4>

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
              options={finishes}
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
            <input
              className="input"
              placeholder="Tracking"
              value={details.tracking}
              onChange={(e) =>
                setDetails({ ...details, tracking: e.target.value })
              }
            />
          </section>
        </div>

        {/* Files */}
        <div className="mt-6">
          <label className="text-sm font-medium">Ficheiros técnicos</label>
          <div className="mt-2">
            <input type="file" onChange={onUpload} />
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {files.map((f) => (
              <li
                key={f.url}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2"
              >
                <span className="truncate">{f.name}</span>
                <div className="flex items-center gap-3">
                  {/* Preview: opens in a new tab */}
                  <a
                    className="text-primary hover:underline"
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Abrir ficheiro"
                  >
                    👁
                  </a>
                  <button
                    type="button"
                    className="text-danger"
                    onClick={() => removeFile(f.name)}
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={submit}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? 'A guardar…' : 'Guardar alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      <label className="text-sm">{label}</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
