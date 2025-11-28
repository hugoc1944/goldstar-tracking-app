'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

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

type Row = {
  id: string;
  shortId: string; // e.g. #c5b1
  name: string;
  email: string;
  ordersCount: number;
  status: 'Novo cliente' | 'Cliente usual';
};

type ClientsPayload = {
  rows: Row[];
  total: number;
  nextCursor: string | null;
};

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Page wrapper – provides layout and Suspense boundary (fixes the prerender error) */
export default function ClientsPage() {
  return (
    <AdminShell>
      <Suspense fallback={
        <div className="rounded-2xl border border-border bg-white p-6 text-sm text-muted-foreground">
          A carregar…
        </div>
      }>
        <ClientsPageInner />
      </Suspense>
    </AdminShell>
  );
}

/** All hook usage (useSearchParams, etc.) lives inside the Suspense boundary */
function ClientsPageInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialQ = sp.get('q') ?? '';
  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebounced(q, 350);

  const [data, setData] = useState<ClientsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => { router.prefetch('/admin/clients/new'); }, [router]);

  // sync query to URL + fetch first page whenever search changes
  useEffect(() => {
    const usp = new URLSearchParams();
    if (debouncedQ.trim()) usp.set('q', debouncedQ.trim());
    router.replace(usp.toString() ? `/admin/clients?${usp}` : '/admin/clients');
    void fetchPage(debouncedQ.trim(), null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);

  // initial load (SSR URL may already have q)
  useEffect(() => {
    void fetchPage(initialQ, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchPage(search: string, cur: string | null) {
    setLoading(true);
    try {
      const url = new URL('/api/clients', window.location.origin);
      if (search) url.searchParams.set('search', search);
      if (cur) url.searchParams.set('cursor', cur);
      url.searchParams.set('take', '20');

      const r = await fetch(url.toString(), { cache: 'no-store' });
      if (!r.ok) throw new Error('load failed');
      const json: ClientsPayload = await r.json();
      setData(cur ? mergePage(data, json) : json);
    } finally {
      setLoading(false);
    }
  }

  function mergePage(prev: ClientsPayload | null, next: ClientsPayload): ClientsPayload {
    if (!prev) return next;
    return {
      rows: [...prev.rows, ...next.rows],
      total: next.total,
      nextCursor: next.nextCursor,
    };
  }

  function loadMore() {
    if (!data?.nextCursor) return;
    void fetchPage(debouncedQ.trim(), data.nextCursor);
  }

  return (
    <>
      {/* Header (matches Orders page style) */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Gestão de clientes GOLDSTAR</p>
        </div>

        <div className="flex items-center gap-3">
          {/* search */}
          <div className="relative w-full max-w-xs">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Procurar cliente"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              if (creating) return;
              setCreating(true);
              router.push('/admin/clients/new');
            }}
            disabled={creating}
            aria-busy={creating}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium
                      text-primary-foreground hover:bg-primary/90 whitespace-nowrap leading-none shrink-0
                      disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? (
              <>
                <GsSpinner />
                <span>A abrir…</span>
              </>
            ) : (
              'Adicionar Cliente'
            )}
          </button>
        </div>
      </header>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <Th className="pl-6">ID do cliente</Th>
              <Th>Cliente</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Pedidos</Th>
              <Th className="w-16 pr-6 text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (!data || data.rows.length === 0) ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  A carregar…
                </td>
              </tr>
            ) : (data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Sem clientes.
                </td>
              </tr>
            ) : (
              data!.rows.map((c, idx) => (
                <tr key={c.id} className={idx % 2 ? 'bg-muted/20' : ''}>
                  <Td className="pl-6 font-medium text-foreground">{c.shortId}</Td>
                  <Td className="text-foreground">{c.name}</Td>
                  <Td className="text-foreground">{c.email}</Td>
                  <Td>
                    <ClientStatusBadge status={c.status} />
                  </Td>
                  <Td className="text-foreground">{c.ordersCount}</Td>
                  <Td className="pr-6 text-right">
                    <Link
                      href={`/admin/orders/new?fromClient=${c.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-muted/60"
                      title="Criar novo pedido com dados do cliente"
                    >
                      +
                    </Link>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer / pagination */}
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <div>{data?.rows.length ?? 0} de {data?.total ?? 0}</div>
          <button
            onClick={loadMore}
            disabled={!data?.nextCursor || loading}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'A carregar…' : data?.nextCursor ? 'Carregar mais' : '-'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------------- UI bits to match Orders page ---------------- */
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-3 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3 ${className}`}>{children}</td>;
}

function ClientStatusBadge({ status }: { status: 'Novo cliente' | 'Cliente usual' }) {
  const cls =
    status === 'Novo cliente'
      ? 'bg-yellow-100 text-yellow-700'
      : 'bg-emerald-100 text-emerald-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
