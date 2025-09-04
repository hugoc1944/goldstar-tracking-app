'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useMemo, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';

/* ---------- types & helpers ---------- */
type Opt = { value: string; label: string; category?: string | null };
type UploadInfo = { url: string; name: string; size: number; mime?: string };

const estados = [
  { value: 'PREPARACAO', label: 'Em preparação' },
  { value: 'PRODUCAO', label: 'Em produção' },
  { value: 'EXPEDICAO', label: 'Em expedição' },
  { value: 'ENTREGUE', label: 'Entregue' },
];

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

/* ---------- sidebar nav item ---------- */
function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm',
        active ? 'bg-muted/70 text-foreground' : 'text-muted-foreground hover:bg-muted/40',
      ].join(' ')}
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

/* ===========================================================
   PAGE
=========================================================== */
export function NewOrderClient() {
  const router = useRouter();

  // catalog options
  const [models, setModels] = useState<Opt[]>([]);
  const [profiles, setProfiles] = useState<Opt[]>([]);
  const [acrylics, setAcrylics] = useState<Opt[]>([]);
  const [serigs, setSerigs] = useState<Opt[]>([]);
  const [monos, setMonos] = useState<Opt[]>([]);
  const [complements, setComplements] = useState<Opt[]>([]);
  const [files, setFiles] = useState<UploadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // form state
  const [client, setClient] = useState({
    name: '',
    email: '',
    phone: '',
    nif: '',
    address: '',
    postal: '',
    city: '',
  });

  const [order, setOrder] = useState({
    model: 'DIVERSOS',
    finish: 'DIVERSOS',
    acrylic: 'DIVERSOS',
    serigraphy: 'DIVERSOS',
    monochrome: 'DIVERSOS',
    complements: 'DIVERSOS',
    initialStatus: 'PREPARACAO',
    eta: '' as string | '',
  });

  // read ?fromClient=<customerId> to prefill
  const searchParams = useSearchParams();
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
          name: c.name ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          nif: c.nif ?? '',
          address: c.address ?? '',
          postal: c.postal ?? '',
          city: c.city ?? '',
        });

        // optional: if you're using the suggestions list, close it
        setOpenList(false);
        setSelectedCustomerId(c.id ?? null);
      } catch (_) {
        // no-op; keep form empty if fetch fails
      }
    })();

    return () => { cancelled = true; };
  }, [fromClient]);


    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<Array<{
    id: string; name: string; email: string | null;
    phone?: string | null; nif?: string | null; address?: string | null; postal?: string | null; city?: string | null;
    }>>([]);
    const [openList, setOpenList] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

  const etaRequired = useMemo(() => order.initialStatus === 'EXPEDICAO', [order.initialStatus]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
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
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const up = await uploadFile(file);
    setFiles((prev) => [...prev, up]);
    e.target.value = '';
  }
  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (etaRequired && !order.eta) {
      alert('ETA é obrigatória quando o estado inicial é "Em expedição".');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client,
          order: {
            model: order.model,
            finish: order.finish,
            acrylic: order.acrylic,
            serigraphy: order.serigraphy,
            monochrome: order.monochrome,
            complements: order.complements,
            initialStatus: order.initialStatus,
            eta: order.eta || null,
            files,
            items: [],
          },
        }),
      });
      if (!res.ok) throw new Error('Falha a criar pedido');
      router.push('/admin/orders');
    } finally {
      setSubmitting(false);
    }
  }

  function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v; }
  const debouncedName = useDebounced(client.name, 250);

    useEffect(() => {
    // If user starts typing a different name, forget previous selection
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
        ...client,
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

  if (loading) {
    return (
      <AdminShell >
        <div className="py-16 text-center text-muted-foreground">A carregar…</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      {/* Single scrollable column */}
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl space-y-10 pb-24">
        {/* Header */}
        <header className="pt-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Novo pedido</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Preencha os dados do cliente e os detalhes do produto.
          </p>
        </header>

        {/* Card — Dados do cliente */}
        <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">Dados do cliente</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative">
                <label className="mb-1 block text-sm font-medium text-foreground">Nome*</label>
                <input
                    className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/50"
                    required
                    value={client.name}
                    onChange={(e) => {
                    setClient({ ...client, name: e.target.value });
                    setOpenList(true);
                    }}
                    onKeyDown={(e) => {
                    if (!openList || suggestions.length === 0) return;
                    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1)); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
                    else if (e.key === 'Enter') { e.preventDefault(); pickSuggestion(activeIndex); }
                    else if (e.key === 'Escape') { setOpenList(false); }
                    }}
                    onBlur={() => { setTimeout(() => setOpenList(false), 120); }} // allow click
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
                            i === activeIndex ? 'bg-muted/60' : 'hover:bg-muted/30'
                        ].join(' ')}
                        >
                        <span className="truncate">{s.name}</span>
                        <span className="ml-3 truncate text-muted-foreground">
                            {truncateEmail(s.email ?? '')}
                        </span>
                        </li>
                    ))}
                    </ul>
                )}
                </div>
                <Field
                label="Email*"
                type="email"
                required
                value={client.email}
                onChange={(v) => setClient({ ...client, email: v })}
                />
                <Field
                label="Telefone"
                value={client.phone}
                onChange={(v) => setClient({ ...client, phone: v })}
                />
                <Field label="NIF" value={client.nif} onChange={(v) => setClient({ ...client, nif: v })} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Textarea
                className="sm:col-span-2"
                label="Morada"
                rows={4}
                value={client.address}
                onChange={(v) => setClient({ ...client, address: v })}
                />
                <Field
                label="Código Postal"
                value={client.postal}
                onChange={(v) => setClient({ ...client, postal: v })}
                />
                <Field
                label="Localidade"
                value={client.city}
                onChange={(v) => setClient({ ...client, city: v })}
                />
            </div>
        </section>

        {/* Card — Detalhes do produto */}
        <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-card">
          <h2 className="text-lg font-semibold text-foreground">Detalhes do produto</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Modelo*"
              value={order.model}
              onChange={(v) => setOrder({ ...order, model: v })}
              options={models}
            />
            <Select
              label="Acabamentos"
              value={order.finish}
              onChange={(v) => setOrder({ ...order, finish: v })}
              options={profiles}
            />
            <Select
              label="Acrílicos"
              value={order.acrylic}
              onChange={(v) => setOrder({ ...order, acrylic: v })}
              options={acrylics}
            />
            <Select
              label="Serigrafias"
              value={order.serigraphy}
              onChange={(v) => setOrder({ ...order, serigraphy: v })}
              options={serigs}
            />
            <Select
              label="Monocromáticos"
              value={order.monochrome}
              onChange={(v) => setOrder({ ...order, monochrome: v })}
              options={monos}
            />
            <Select
              label="Complementos"
              value={order.complements}
              onChange={(v) => setOrder({ ...order, complements: v })}
              options={complements}
            />
            <Select
              label="Estado inicial*"
              value={order.initialStatus}
              onChange={(v) => setOrder({ ...order, initialStatus: v })}
              options={estados}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateField
              label={
                <>
                  Data prevista de entrega{' '}
                  {etaRequired && <span className="text-destructive">*</span>}
                </>
              }
              value={order.eta}
              onChange={(v) => setOrder({ ...order, eta: v })}
            />
            <div />
          </div>

          {/* Ficheiros */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-foreground">Ficheiros técnicos</label>
            <div className="mt-2 flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center justify-center rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/80">
                <input
                  type="file"
                  className="absolute inset-0 z-10 cursor-pointer opacity-0"
                  onChange={onUpload}
                />
                Carregar novo
              </label>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2 text-sm">
                {files.map((f) => (
                  <li
                    key={f.url}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2"
                  >
                    

                    <div>
                        <span className="truncate">{f.name}</span>
                        <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md p-2 text-muted-foreground hover:bg-muted/60"
                            title="Abrir ficheiro">
                            {/* Simple eye SVG (no external deps) */}
                            <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="inline-block align-middle"
                            >
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                            </svg>
                        </a>
                    </div>
                    <button
                      type="button"
                      className="text-destructive hover:opacity-80"
                      onClick={() => removeFile(f.name)}
                      aria-label={`Remover ${f.name}`}
                    >
                      remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Submit button centered */}
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

/* ---------- Small UI helpers (use Tailwind tokens) ---------- */
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
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <select
        className="block w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/50"
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