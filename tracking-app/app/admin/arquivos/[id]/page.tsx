'use client';

import {use, useEffect, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

function GsSpinner({ size = 14, stroke = 2, className = '' }: { size?: number; stroke?: number; className?: string }) {
  const s = { width: size, height: size, borderWidth: stroke } as React.CSSProperties;
  return (
    <span
      className={["inline-block animate-spin rounded-full border-neutral-300 border-t-[#FFD200]", className].join(' ')}
      style={s}
      aria-hidden
    />
  );
}

type FileMeta = { url: string; name: string; size: number; mime?: string | null };

type Data = {
  id: string;
  shortId: string;
  deliveredAt: string | null;
  customer: {
    name: string; email: string | null; phone: string | null;
    address: string | null; nif: string | null; postal: string | null; city: string | null;
  } | null;
  items: { id: string; model: string | null; description: string | null }[];
  files: FileMeta[];
  budget: { id: string | null; pdfUrl: string | null } | null;
};

async function uploadFile(file: File): Promise<FileMeta> {
  // Troque este endpoint se já usa outro uploader
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/uploads', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('Falha no upload');
  const json = await r.json();
  return {
    url: json.url,
    name: json.name ?? file.name,
    size: json.size ?? file.size,
    mime: json.mime ?? file.type ?? null,
  };
}

export default function ArchiveDetail({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const p = params as any;
  const { id } = typeof p?.then === 'function' ? use(p) : p;

  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ⬇️ add these two lines
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(`/api/archives/${id}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Falha a carregar');
      const json: Data = await r.json();
      setData(json);
    } catch (e: any) {
      setError(e?.message ?? 'Erro');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !data) return;

    setSaving(true);
    try {
      const uploaded: FileMeta[] = [];
      for (const f of files) uploaded.push(await uploadFile(f));

      const next = [...(data.files || []), ...uploaded];

      const r = await fetch(`/api/orders/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', files: next }),
      });
      if (!r.ok) throw new Error('Falha a guardar ficheiros');

      await load();
      if (inputRef.current) inputRef.current.value = '';
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao adicionar ficheiros');
    } finally {
      setSaving(false);
    }
  }
  async function onDeleteFile(url: string) {
  if (!data) return;
  if (!confirm('Apagar ficheiro?')) return;

  setDeletingUrl(url);
  try {
    const current = data.files || [];
    const next = current.filter((f) => {
      const href = typeof f.url === 'string' ? f.url : String((f as any)?.url ?? '');
      return href !== url;
    });

    const r = await fetch(`/api/orders/${data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', files: next }),
    });
    if (!r.ok) throw new Error('Falha a apagar ficheiro');

    await load(); // 🔁 refresh list
  } catch (e: any) {
    alert(e?.message ?? 'Erro ao apagar ficheiro');
  } finally {
    setDeletingUrl(null);
  }
}

  if (!data) {
    return (
      <AdminShell>
        <div className="rounded-xl bg-white p-6 shadow">A carregar…</div>
      </AdminShell>
    );
  }

  const first = data.items?.[0];

  return (
    <AdminShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Arquivo - {data.shortId}</h1>
        <p className="text-sm text-muted-foreground">
          Entregue em {data.deliveredAt ? new Date(data.deliveredAt).toLocaleString('pt-PT') : '—'}
        </p>
      </header>

      {/* Cliente */}
      <section className="mb-6 rounded-2xl border border-border bg-card/60 p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground">Dados do cliente</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Item label="Nome" value={data.customer?.name} />
          <Item label="Email" value={data.customer?.email} />
          <Item label="Telefone" value={data.customer?.phone} />
          <Item label="NIF" value={data.customer?.nif} />
          <Item label="Morada" value={data.customer?.address} className="sm:col-span-2" />
          <Item label="Código Postal" value={data.customer?.postal} />
          <Item label="Localidade" value={data.customer?.city} />
        </div>
      </section>

      {/* Pedido */}
      <section className="mb-6 rounded-2xl border border-border bg-card/60 p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground">Dados do pedido</h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Item label="ID do pedido" value={data.shortId} />
          <Item label="Modelo" value={first?.model ?? 'Diversos'} />
          {/* acrescente mais campos se quiser */}
        </div>
      </section>

      {/* Ficheiros */}
      <section className="mb-10 rounded-2xl border border-border bg-card/60 p-6 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Ficheiros</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            {saving ? 'A enviar…' : 'Adicionar'}
            <input ref={inputRef} onChange={onAddFiles} type="file" multiple className="hidden" />
          </label>
        </div>

        {/* orçamento (se existir) */}
        {data.budget?.pdfUrl && (
          <div className="mb-4 rounded-lg border border-border bg-white p-3">
            <div className="text-sm font-medium text-foreground mb-1">Ficheiro de Orçamento</div>
            <a className="text-primary hover:underline break-all" href={data.budget.pdfUrl} target="_blank" rel="noreferrer">
              {data.budget.pdfUrl}
            </a>
          </div>
        )}

        <div className="rounded-lg border border-border bg-white">
          {(!data.files || data.files.length === 0) ? (
            <div className="p-4 text-sm text-muted-foreground">Sem ficheiros anexados.</div>
          ) : (
            <ul>
              {data.files.map((f, idx) => {
                const href = typeof f.url === 'string' ? f.url : String((f as any)?.url ?? '');
                const displayName =
                    (f.name && f.name.trim()) ||
                    decodeURIComponent((href.split('?')[0].split('/').pop() || 'Ficheiro'));

                return (
                    <li key={`${href}-${idx}`} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
                        <div className="truncate text-xs text-muted-foreground">{href}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        className="rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary/10"
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir
                      </a>

                      <button
                        type="button"
                        onClick={() => onDeleteFile(href)}
                        disabled={deletingUrl === href || saving}
                        className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                        title="Apagar ficheiro"
                        aria-label="Apagar ficheiro"
                      >
                        {deletingUrl === href ? <GsSpinner /> : '×'}
                      </button>
                    </div>
                    </li>
                );
                })}
            </ul>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

function Item({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{value || '—'}</div>
    </div>
  );
}
