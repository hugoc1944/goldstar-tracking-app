'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

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
  shortId: string;
  customer: { name: string };
  deliveredAt: string; // ISO
  model: string | null;
};

type ApiList = {
  rows: Row[];
  total: number;
  nextCursor?: string | null;
};

function useDebounced<T>(v: T, ms = 350) {
  const [val, setVal] = useState(v);
  useEffect(() => { const t = setTimeout(() => setVal(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return val;
}

export default function ArchivesPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const router = useRouter();
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const debounced = useDebounced(search);
  const [trashPendingId, setTrashPendingId] = useState<string | null>(null);

  async function load(first = false) {
    const usp = new URLSearchParams();
    if (debounced) usp.set('search', debounced);
    usp.set('sort', sort);
    if (!first && cursor) usp.set('cursor', cursor);

    const r = await fetch(`/api/archives?${usp.toString()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('Falha ao carregar');
    const data: ApiList = await r.json();

    if (first) {
      setRows(data.rows);
    } else {
      setRows((prev) => [...prev, ...(data.rows || [])]);
    }
    setCursor(data.nextCursor ?? null);
  }

  // first load or when search/sort changes
  useEffect(() => {
    setLoading(true);
    setCursor(null);
    load(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, sort]);

  async function onLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try { await load(false); } finally { setLoadingMore(false); }
  }

  async function sendArchiveToTrash(orderId: string) {
    if (!confirm('Enviar este pedido arquivado para a lixeira?')) return;

    setTrashPendingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/trash`, {
        method: 'POST',
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || 'Erro ao enviar pedido para a lixeira.');
      }

      // reload first page with current filters
      setCursor(null);
      setLoading(true);
      await load(true);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? 'Erro ao enviar pedido para a lixeira.');
    } finally {
      setLoading(false);
      setTrashPendingId(null);
    }
  }

  return (
    <AdminShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Arquivos</h1>
          <p className="text-sm text-muted-foreground">Pedidos entregues</p>
        </div>
      </header>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por ID ou cliente"
            className="w-72 rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <th className="py-3 text-left font-medium pl-6 w-36">ID do pedido</th>
              <th className="py-3 text-left font-medium">Cliente</th>
              <th className="py-3 text-left font-medium">Data Entregue</th>
              <th className="py-3 text-left font-medium">Modelo</th>
              <th className="py-3 text-right font-medium pr-6 w-16">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">A carregar…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Sem resultados.</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={r.id} className={idx % 2 ? 'bg-muted/20' : ''}>
                <td className="py-3 pl-6 font-medium text-foreground">{r.shortId}</td>
                <td className="py-3 text-foreground">{r.customer?.name || '-'}</td>
                <td className="py-3 text-foreground">
                  {r.deliveredAt ? new Date(r.deliveredAt).toLocaleString('pt-PT') : '-'}
                </td>
                <td className="py-3 text-foreground">{r.model ?? 'Diversos'}</td>
                <td className="py-3 pr-6 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    {/* Send archived order to trash */}
                    <button
                      type="button"
                      onClick={() => sendArchiveToTrash(r.id)}
                      disabled={trashPendingId === r.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-red-600 hover:bg-red-50 disabled:opacity-60"
                      title="Enviar pedido para a lixeira"
                    >
                      {trashPendingId === r.id ? (
                        <GsSpinner size={14} />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>

                    {/* View archived order */}
                    <button
                      type="button"
                      onClick={() => {
                        if (navigatingId) return;
                        setNavigatingId(r.id);
                        router.push(`/admin/arquivos/${r.id}`);
                      }}
                      disabled={navigatingId === r.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      {navigatingId === r.id ? (
                        <>
                          <GsSpinner />
                          <span className="ml-1.5">A abrir…</span>
                        </>
                      ) : (
                        'Ver'
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / paginação simples */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>{rows.length} resultados</div>
        {cursor ? (
          <button onClick={onLoadMore} disabled={loadingMore} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground hover:bg-muted/60">
            {loadingMore ? 'A carregar…' : 'Carregar mais'}
          </button>
        ) : <div />}
      </div>
    </AdminShell>
  );
}
