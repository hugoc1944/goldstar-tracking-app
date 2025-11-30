'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import OrderActionsModal from '@/components/orders/OrderActionsModal';
import { ChangeStatusModal } from '@/components/orders/ChangeStatusModal';
import { EditOrderModal } from '@/components/orders/EditOrderModal';
import { BulkChangeStatusModal } from '@/components/orders/BulkChangeStatusModal';
import { Search, Loader2, Filter, Trash2 } from 'lucide-react';

type Status = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';
type OrderRow = {
  id: string;
  shortId: string;
  customer: { name: string; city?: string | null; district?: string | null };
  status: Status;
  visitAwaiting?: boolean;
  visitAt?: string | null;    
  eta: string | null;
  model: string | null;
  createdAt: string;
};
type ApiList = {
  rows: OrderRow[];
  total: number;
  nextCursor?: string | null;
};

const STATUS_LABEL: Record<Status, string> = {
  PREPARACAO: 'Em preparação',
  PRODUCAO: 'Em produção',
  EXPEDICAO: 'Em expedição',
  ENTREGUE: 'Entregue',
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
function StatusBadge({ status }: { status: Status }) {
  const label = STATUS_LABEL[status];
  const cls =
    status === 'ENTREGUE'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'EXPEDICAO'
      ? 'bg-amber-100 text-amber-700'
      : status === 'PRODUCAO'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-zinc-100 text-zinc-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}


function useDebounced<T>(value: T, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-3 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-2.5 ${className}`}>{children}</td>;
}

export default function OrdersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // filters (from URL or saved in localStorage)
  const [search, setSearch] = useState(sp.get('q') ?? '');
  const [status, setStatus] = useState<Status | ''>((sp.get('status') as Status) ?? '');
  const [model, setModel] = useState<string>(sp.get('model') ?? '');

  // page size (take)
  const [pageSize, setPageSize] = useState<number>(() => {
    const t = sp.get('take');
    const n = t ? Number(t) : 20;
    return [20, 50, 100].includes(n) ? n : 20;
  });

  // created date range
  const [createdFrom, setCreatedFrom] = useState(sp.get('createdFrom') ?? '');
  const [createdTo, setCreatedTo] = useState(sp.get('createdTo') ?? '');


  const debouncedSearch = useDebounced(search, 350);
  // Load saved filters from localStorage if URL is "clean"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // if URL already has filters, respect those
    if (sp.toString()) return;

    try {
      const raw = window.localStorage.getItem('gs-orders-filters');
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        search?: string;
        status?: Status | '';
        model?: string;
        createdFrom?: string;
        createdTo?: string;
        pageSize?: number;
      };

      if (saved.search) setSearch(saved.search);
      if (saved.status) setStatus(saved.status);
      if (saved.model) setModel(saved.model);
      if (saved.createdFrom) setCreatedFrom(saved.createdFrom);
      if (saved.createdTo) setCreatedTo(saved.createdTo);
      if (saved.pageSize && [20, 50, 100].includes(saved.pageSize)) {
        setPageSize(saved.pageSize);
      }
    } catch {
      // ignore malformed JSON
    }
    // we only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persist filters so admins keep their usual view
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = {
      search,
      status,
      model,
      createdFrom,
      createdTo,
      pageSize,
    };
    try {
      window.localStorage.setItem('gs-orders-filters', JSON.stringify(payload));
    } catch {
      // ignore quota errors
    }
  }, [search, status, model, createdFrom, createdTo, pageSize]);




  const [creating, setCreating] = useState(false);
  useEffect(() => { router.prefetch('/admin/orders/new'); }, [router]);
  // Load quick stats
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setStatsLoading(true);
        const res = await fetch('/api/orders/stats', { cache: 'no-store' });
        if (!res.ok) throw new Error('Falha ao carregar estatísticas');
        const data = await res.json();
        if (!alive) return;
        setStats(data);
      } catch (e) {
        console.warn('Erro a carregar /orders/stats', e);
      } finally {
        if (alive) setStatsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);
  // data state
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  // Quick pipeline stats
  const [stats, setStats] = useState<{
    PREPARACAO: number;
    PRODUCAO: number;
    EXPEDICAO: number;
    ENTREGUE: number;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // modals
  const [actionsFor, setActionsFor] = useState<{ id: string; status: Status } | null>(null);
  const [changeFor, setChangeFor] = useState<{ id: string; status: Status } | null>(null);

  const [editFor, setEditFor] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);


  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }
  const allIds = rows.map(r => r.id);
  const allChecked = selected.length > 0 && selected.length === allIds.length;
  const someChecked = selected.length > 0 && selected.length < allIds.length;
  function toggleAll() {
    setSelected(prev => (prev.length === allIds.length ? [] : allIds));
  }
  useEffect(() => {
    // prune selection when list refetches
    const setIds = new Set(allIds);
    setSelected(prev => prev.filter(id => setIds.has(id)));
  }, [rows]);
  type UiStatus = 'AGUARDA_VISITA' | 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';
  function toUiStatus(r: OrderRow): UiStatus {
    return r.status === 'PREPARACAO' && r.visitAwaiting ? 'AGUARDA_VISITA' : (r.status as UiStatus);
  }
  const selectedRows = rows.filter(r => selected.includes(r.id));
  const commonCurrent: UiStatus | null = (() => {
    if (!selectedRows.length) return null;
    const first = toUiStatus(selectedRows[0]);
    return selectedRows.every(r => toUiStatus(r) === first) ? first : null;
  })();
  // Map filters -> URLSearchParams (handles the special 'Aguarda visita')
// Map filters -> URLSearchParams (handles the special 'Aguarda visita')
 function fillListParams(usp: URLSearchParams, opts?: { cursor?: string }) {
    if (debouncedSearch) usp.set('search', debouncedSearch);

    // paging
    usp.set('take', String(pageSize));

    // status (use special AGUARDA_VISITA value, API knows how to handle it)
    const s = (status || '') as string;
    if (s) {
      usp.set('status', s as Status);
    }

    if (model) usp.set('model', model);

    // created date range
    if (createdFrom) usp.set('createdFrom', createdFrom);
    if (createdTo) usp.set('createdTo', createdTo);

    if (opts?.cursor) usp.set('cursor', opts.cursor);
  }

 // sync filters to URL (so they can be bookmarked / shared)
  useEffect(() => {
    const usp = new URLSearchParams();

    if (debouncedSearch) usp.set('q', debouncedSearch);
    if (status) usp.set('status', status);
    if (model) usp.set('model', model);
    if (createdFrom) usp.set('createdFrom', createdFrom);
    if (createdTo) usp.set('createdTo', createdTo);
    if (pageSize !== 20) usp.set('take', String(pageSize));

    const q = usp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [
    debouncedSearch,
    status,
    model,
    createdFrom,
    createdTo,
    pageSize,
    pathname,
    router,
  ]);
  // load initial list
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCursor(null);

    (async () => {
      const usp = new URLSearchParams();
      fillListParams(usp);

      const r = await fetch(`/api/orders?${usp.toString()}`, { cache: 'no-store' });
      if (!alive) return;

      if (!r.ok) {
        setRows([]); setTotal(0); setCursor(null); setLoading(false);
        return;
      }

      const data: ApiList = await r.json();
      setRows(data.rows);
      setTotal(data.total);
      setCursor(data.nextCursor ?? null);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, [debouncedSearch, status, model, pageSize, createdFrom, createdTo]);

  async function onLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);

    const usp = new URLSearchParams();
    // ensure we only pass a string (not null)
    fillListParams(usp, { cursor: cursor ?? undefined });

    const r = await fetch(`/api/orders?${usp.toString()}`, { cache: 'no-store' });
    if (!r.ok) { setLoadingMore(false); return; }
    const data: ApiList = await r.json();
    setRows(prev => [...prev, ...data.rows]);
    setCursor(data.nextCursor ?? null);
    setLoadingMore(false);
  }

  const refetch = async () => {
    setLoading(true);
    setCursor(null);

    const usp = new URLSearchParams();
    fillListParams(usp);

    const r = await fetch(`/api/orders?${usp.toString()}`, { cache: 'no-store' });
    if (!r.ok) { setRows([]); setTotal(0); setCursor(null); setLoading(false); return; }
    const data: ApiList = await r.json();
    setRows(data.rows);
    setTotal(data.total);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  };
   async function sendOrderToTrash(orderId: string) {
    if (!confirm('Enviar este pedido para a lixeira?')) return;

    const res = await fetch(`/api/orders/${orderId}/trash`, {
      method: 'POST',
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      alert(txt || 'Erro ao enviar pedido para a lixeira.');
      return;
    }

    await refetch();
  }


function decodeComplements(raw: any, custom: any) {
  // We store Vision colors either in complements JSON or in customizations.
  // Normalize to a single shape the modal expects.
  let code = 'DIVERSOS';
  let barColor = '';
  let visionSupport = '';
  let towelColorMode = '';
  let shelfColorMode = '';

  try {
    if (typeof raw === 'string') {
      const maybeObj = JSON.parse(raw);
      if (maybeObj && typeof maybeObj === 'object') {
        code = maybeObj.code ?? raw ?? 'DIVERSOS';
        barColor = maybeObj.barColor ?? '';
        visionSupport = maybeObj.visionSupport ?? '';
        towelColorMode = maybeObj.towelColorMode ?? '';
        shelfColorMode = maybeObj.shelfColorMode ?? '';
      } else {
        code = raw || 'DIVERSOS';
      }
    } else if (raw && typeof raw === 'object') {
      code = raw.code ?? 'DIVERSOS';
      barColor = raw.barColor ?? '';
      visionSupport = raw.visionSupport ?? '';
      towelColorMode = raw.towelColorMode ?? '';
      shelfColorMode = raw.shelfColorMode ?? '';
    }
  } catch {
    // raw was a plain string like "vision" / "nenhum"
    if (typeof raw === 'string') code = raw || 'DIVERSOS';
  }

  // fallbacks from customizations if not in complements
  if (!barColor) barColor = custom?.barColor ?? '';
  if (!visionSupport) visionSupport = custom?.visionSupport ?? '';
  if (!towelColorMode) towelColorMode = custom?.towelColorMode ?? '';
  if (!shelfColorMode) shelfColorMode = custom?.shelfColorMode ?? '';

  return { code, barColor, visionSupport, towelColorMode, shelfColorMode };
}

  // lazy load payload for EditOrderModal
useEffect(() => {
  let alive = true;
  (async () => {
    if (!editFor) return;
    setEditLoading(true);
    setEditPayload(null);

    const r = await fetch(`/api/orders/${editFor}`, { cache: 'no-store' });
    if (!alive) return;

    if (!r.ok) {
      setEditFor(null);
      setEditLoading(false);
      return;
    }

    const data = await r.json();

    // Prefer the "forModal" shape if your API now returns it
    if (data.forModal) {
      const f = data.forModal;
      setEditPayload({
    id: f.id,
    tracking: data.trackingNumber ?? '',
    client: {
      name:  data.customer?.name  ?? '',
      email: data.customer?.email ?? '',
      phone:  f.client?.phone      ?? '',
      address:f.client?.address    ?? '',
      postal: f.client?.postal     ?? '',
      city:   f.client?.city       ?? '',
    },
    details: {
      model:           f.details?.model           ?? 'DIVERSOS',
      handleKey:       f.details?.handleKey       ?? '',
      finish:          f.details?.finish          ?? 'DIVERSOS',
      glassTypeKey:    f.details?.glassTypeKey    ?? '',
      acrylic:         f.details?.acrylic         ?? 'DIVERSOS',
      serigraphy:      f.details?.serigraphy      ?? 'DIVERSOS',
      serigrafiaColor: f.details?.serigrafiaColor ?? '',
      complements:     f.details?.complements     ?? 'DIVERSOS',
      barColor:        f.details?.barColor        ?? '',
      visionSupport:   f.details?.visionSupport   ?? '',
      towelColorMode:  f.details?.towelColorMode  ?? '',
      shelfColorMode:  f.details?.shelfColorMode  ?? '',
      fixingBarMode:   f.details?.fixingBarMode   ?? '',
    },

    // ✅ NEW: forward delivery so EditOrderModal can prefill
    delivery: {
      deliveryType: f.delivery?.deliveryType ?? null,
      housingType:  f.delivery?.housingType  ?? null,
      floorNumber:  f.delivery?.floorNumber  ?? null,
      hasElevator:  f.delivery?.hasElevator  ?? null,
    },

    files: Array.isArray(data.filesJson) ? data.filesJson : [],
     state: {                                     // <- NEW
    status:        f.state?.status ?? 'PREPARACAO',
    visitAwaiting: !!f.state?.visitAwaiting,
    visitAt:       f.state?.visitAt ?? null,
  },
  });
  setEditLoading(false);
  return;
}

    // Back-compat: build from items/customizations if "forModal" isn’t present
    const first = data.items?.[0] ?? {};
    const custom = (first?.customizations ?? {}) as any;

    const {
      code: complementsCode,
      barColor,
      visionSupport,
      towelColorMode,
      shelfColorMode,
    } = decodeComplements(first?.complements, custom);

    setEditPayload({
      id: data.id,
      tracking: data.trackingNumber ?? '',
      client: {
        name:  data.customer?.name  ?? '',
        email: data.customer?.email ?? '',
        phone:  data.customer?.phone  ?? '',
        address:data.customer?.address?? '',
        postal: data.customer?.postal ?? '',
        city:   data.customer?.city   ?? '',
      },
      details: {
        model:           first?.model ?? 'DIVERSOS',
        handleKey:       custom.handleKey ?? '',
        finish:          custom.finish    ?? 'DIVERSOS',
        glassTypeKey:    custom.glassTypeKey ?? custom.glassType ?? '',
        acrylic:         custom.acrylic   ?? 'DIVERSOS',
        serigraphy:      custom.serigraphy?? 'DIVERSOS',
        serigrafiaColor: custom.serigrafiaColor ?? '',
        complements:     complementsCode,
        barColor,
        visionSupport,
        towelColorMode,
        shelfColorMode,
        fixingBarMode:   custom.fixingBarMode ?? '',
      },
      delivery: {
        deliveryType: (data as any).deliveryType ?? null,
        housingType:  (data as any).housingType  ?? null,
        floorNumber:  (data as any).floorNumber  ?? null,
        hasElevator:  (data as any).hasElevator  ?? null,
      },
      files: Array.isArray(data.filesJson) ? data.filesJson : [],
    });

    setEditLoading(false);
  })();
  return () => { alive = false; };
}, [editFor]);

  // load model filter options
  const [modelOpts, setModelOpts] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch('/api/catalog', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();

        const models = data?.MODEL ?? [];

        if (!alive) return;

        const opts = models.map((m: any) => ({
          value: m.value || m.key || m.id,
          label: m.label || m.name || m.value,
        }));

        setModelOpts(opts);
      } catch (err) {
        console.warn('Failed loading models catalog', err);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);


  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gestão de pedidos GOLDSTAR</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (creating) return;
            setCreating(true);
            router.push('/admin/orders/new'); // keep your route here
          }}
          disabled={creating}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {creating ? (
            <span className="inline-flex items-center">
              <GsSpinner />
              <span className="ml-2">A abrir…</span>
            </span>
          ) : (
            'Novo Pedido'
          )}
        </button>
      </header>
      {/* Quick stats bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
        <div className="inline-flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-zinc-500" />
          <span>
            Em preparação:{' '}
            <span className="font-semibold text-foreground">
              {stats ? stats.PREPARACAO : '–'}
            </span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-blue-500" />
          <span>
            Em produção:{' '}
            <span className="font-semibold text-foreground">
              {stats ? stats.PRODUCAO : '–'}
            </span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span>
            Em expedição:{' '}
            <span className="font-semibold text-foreground">
              {stats ? stats.EXPEDICAO : '–'}
            </span>
          </span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-muted/40 px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span>
            Entregues:{' '}
            <span className="font-semibold text-foreground">
              {stats ? stats.ENTREGUE : '–'}
            </span>
          </span>
        </div>

        {statsLoading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <GsSpinner size={12} />
            a atualizar…
          </span>
        )}
      </div>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value={20}>20 / página</option>
          <option value={50}>50 / página</option>
          <option value={100}>100 / página</option>
        </select>
        
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
            placeholder="Procurar pedido"
            className="w-72 rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
          
        <select
          value={status}
          onChange={(e) => setStatus((e.target.value || '') as Status | '')}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Estado</option>
          <option value="AGUARDA_VISITA">Aguarda visita</option>
          <option value="PREPARACAO">Em preparação</option>
          <option value="PRODUCAO">Em produção</option>
          <option value="EXPEDICAO">Em expedição</option>
          <option value="ENTREGUE">Entregue</option>
        </select>

        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Modelo</option>
          {modelOpts.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
         {/* NEW: Criado entre */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Criado</span>
          <input
            type="date"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <input
            type="date"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-sm"
          />
        </div>
        </div>

        {/* Main content: table + chips + pagination */}
        <div className="flex flex-col gap-4">

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <Th className="w-10 pl-6">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </Th>
              <Th className="w-36 pl-6">ID do pedido</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th>Criado em</Th>
              <Th>Modelo</Th>

              <Th className="w-16 pr-6 text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">A carregar…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Sem resultados.</td></tr>
            ) : (
              rows.map((r, idx) => (
              <tr key={r.id}   className={`hover:bg-muted/30 transition-colors ${idx % 2 ? 'bg-muted/20' : ''}`}>
                <Td className="pl-6">
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`Selecionar ${r.shortId}`}
                  />
                </Td>

                {/* ID */}
                <Td className="pl-6 font-medium text-foreground">{r.shortId}</Td>

                {/* Cliente */}
                <Td className="text-foreground">{r.customer?.name}</Td>

                {/* Estado */}
                <Td className="text-foreground">
                  {r.status === 'PREPARACAO' && r.visitAwaiting ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-yellow-700">
                      <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
                      Aguarda visita
                    </span>
                  ) : (
                    <StatusBadge status={r.status} />
                  )}
                </Td>

                {/* Criado em */}
                <Td className="text-foreground">
                  {new Date(r.createdAt).toLocaleDateString('pt-PT')}
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({Math.ceil((Date.now() - new Date(r.createdAt).getTime()) / 86400000)}d)
                  </span>
                </Td>

                {/* Modelo */}
                <Td className="text-foreground">{r.model ?? 'Diversos'}</Td>

                {/* Ações */}
                <Td className="pr-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {/* Ver / editar (pencil) */}
                    <button
                      onClick={() => setActionsFor({ id: r.id, status: r.status })}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary/10"
                      title="Ver / editar"
                      type="button"
                    >
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
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>

                    {/* Enviar para lixeira */}
                    <button
                      type="button"
                      onClick={() => sendOrderToTrash(r.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      title="Enviar pedido para a lixeira"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </Td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>
    {/* Active filter chips */}
      {(() => {
        const chips = [];
        if (debouncedSearch) chips.push({ key:'q', label:`Pesquisa: ${debouncedSearch}`, clear: () => setSearch('') });
        if (status) chips.push({ key:'status', label:`Estado: ${status}`, clear: () => setStatus('') });
        if (model) chips.push({ key:'model', label:`Modelo: ${model}`, clear: () => setModel('') });
        if (createdFrom || createdTo) chips.push({
          key:'created',
          label:`Criado: ${createdFrom||'…'} → ${createdTo||'…'}`,
          clear: () => { setCreatedFrom(''); setCreatedTo(''); }
        });
        if (pageSize !== 20) chips.push({
          key:'take',
          label:`Página: ${pageSize}`,
          clear: () => setPageSize(20)
        });

        return (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map(c => (
              <button
                key={c.key}
                type="button"
                onClick={c.clear}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs text-foreground hover:bg-muted"
                title="Remover filtro"
              >
                {c.label}
                <span className="text-muted-foreground">✕</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatus('');
                setModel('');
                setCreatedFrom('');
                setCreatedTo('');
                setPageSize(20);
              }}
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
            >
              Limpar tudo
            </button>
          </div>
        );
      })()}
      {/* Footer / pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>{rows.length} de {total}</div>
        {cursor ? (
          <button onClick={onLoadMore} disabled={loadingMore} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground hover:bg-muted/60">
            {loadingMore ? 'A carregar…' : 'Carregar mais'}
          </button>
        ) : <div />}
      </div>
    </div>

      {/* Modals */}
      {actionsFor && (
        <OrderActionsModal
          orderId={actionsFor.id}
          onClose={() => setActionsFor(null)}
          onChangeState={(id) => {
            setActionsFor(null);
            setChangeFor({ id, status: actionsFor.status });
          }}
          onEditOrder={(id) => {
            setActionsFor(null);
            setEditFor(id);
          }}
        />
      )}

      {changeFor && (() => {
        const row = rows.find((x) => x.id === changeFor.id);
        const currentForModal =
          row && row.status === 'PREPARACAO' && row.visitAwaiting
            ? 'AGUARDA_VISITA'
            : (row?.status ?? changeFor.status);


        return (
          <ChangeStatusModal
            orderId={changeFor.id}
            current={currentForModal as any} // ChangeStatusModal accepts 'AGUARDA_VISITA' union
            onClose={() => setChangeFor(null)}
            onChanged={refetch}
          />
        );
      })()}

      {editFor && (editLoading ? (
        <div className="fixed inset-0 z-[101] grid place-items-center bg-black/40">
          <div className="rounded-xl bg-white px-6 py-4 shadow">A carregar…</div>
        </div>
      ) : editPayload ? (
        <EditOrderModal
          order={editPayload}
          onClose={() => { setEditFor(null); setEditPayload(null); }}
          onSaved={refetch}
        />
      ) : null)}

      {bulkOpen && (
        <BulkChangeStatusModal
          orderIds={selected}
          commonCurrent={commonCurrent}
          onClose={() => setBulkOpen(false)}
          onChanged={() => { setSelected([]); refetch(); }}
        />
      )}
    </div>
  );
}
