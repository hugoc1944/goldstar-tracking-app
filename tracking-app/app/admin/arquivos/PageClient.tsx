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
      className={['inline-block animate-spin rounded-full border-neutral-300 border-t-[#FFD200]', className].join(' ')}
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
  useEffect(() => {
    const t = setTimeout(() => setVal(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return val;
}

// helpers for month/year options
const MONTHS: { value: string; label: string }[] = [
  { value: '', label: 'Mês' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

function buildYearOptions() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 5; y--) {
    years.push(y);
  }
  return years;
}

export default function ArchivesPage() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  // NEW: month/year period filter
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');

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

    // NEW: send month/year to API
    if (year) usp.set('year', year);
    if (month) usp.set('month', month);

    if (!first && cursor) usp.set('cursor', cursor);

    const r = await fetch(`/api/archives?${usp.toString()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('Falha ao carregar');
    const data: ApiList = await r.json();

    if (first) {
      setRows(data.rows);
    } else {
      // FIXED: proper spread of previous rows + new rows
      setRows((prev) => [...prev, ...(data.rows || [])]);
    }
    setCursor(data.nextCursor ?? null);
  }

  // first load or when search/sort/period changes
  useEffect(() => {
    setLoading(true);
    setCursor(null);
    load(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, sort, year, month]);

  async function onLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      await load(false);
    } finally {
      setLoadingMore(false);
    }
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

  const years = buildYearOptions();
  const periodLabel =
    year && month
      ? `${MONTHS.find((m) => m.value === month)?.label} ${year}`
      : year
      ? `Ano ${year}`
      : month
      ? MONTHS.find((m) => m.value === month)?.label ?? ''
      : '';

  return (
    <AdminShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Arquivos</h1>
          <p className="text-sm text-muted-foreground">
            Pedidos entregues {periodLabel ? `· ${periodLabel}` : ''}
          </p>
        </div>
      </header>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* search */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
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

        {/* sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="newest">Mais recentes</option>
          <option value="oldest">Mais antigos</option>
        </select>

        {/* NEW: year filter */}
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Ano</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {y}
            </option>
          ))}
        </select>

        {/* NEW: month filter */}
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {MONTHS.map((m) => (
            <option key={m.value || 'empty'} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* NEW: clear period button */}
        {(year || month) && (
          <button
            type="button"
            onClick={() => {
              setYear('');
              setMonth('');
            }}
            className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-muted"
          >
            Limpar período
          </button>
        )}
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
              <th className="py-3 text-right font-medium pr-6">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  A carregar…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  Sem pedidos entregues.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 ? 'bg-muted/20' : ''}>
                  <td className="pl-6 py-2.5 font-medium text-foreground">{r.shortId}</td>
                  <td className="py-2.5 text-foreground">{r.customer?.name}</td>
                  <td className="py-2.5 text-foreground">
                    {new Date(r.deliveredAt).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="py-2.5 text-foreground">{r.model ?? 'Diversos'}</td>
                  <td className="py-2.5 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/arquivos/${r.id}`}
                        onClick={() => setNavigatingId(r.id)}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-2 text-xs text-foreground hover:bg-muted/60"
                      >
                        {navigatingId === r.id ? (
                          <GsSpinner size={14} />
                        ) : (
                          'Ver pedido'
                        )}
                      </Link>

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
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Footer / pagination */}
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <div>{rows.length} pedidos carregados</div>
          <button
            onClick={onLoadMore}
            disabled={!cursor || loadingMore}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'A carregar…' : cursor ? 'Carregar mais' : '-'}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}
