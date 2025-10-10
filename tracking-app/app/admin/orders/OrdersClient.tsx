'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import OrderActionsModal from '@/components/orders/OrderActionsModal';
import { ChangeStatusModal } from '@/components/orders/ChangeStatusModal';
import { EditOrderModal } from '@/components/orders/EditOrderModal';

type Status = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';
type OrderRow = {
  id: string;
  shortId: string;
  customer: { name: string };
  status: Status;
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

const PAGE_SIZE = 20;

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
  return <td className={`py-3 ${className}`}>{children}</td>;
}

export default function OrdersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // filters (from URL)
  const [search, setSearch] = useState(sp.get('q') ?? '');
  const [status, setStatus] = useState<Status | ''>((sp.get('status') as Status) ?? '');
  const [model, setModel] = useState<string>(sp.get('model') ?? '');
  const debouncedSearch = useDebounced(search, 350);

  // data state
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  // modals
  const [actionsFor, setActionsFor] = useState<{ id: string; status: Status } | null>(null);
  const [changeFor, setChangeFor] = useState<{ id: string; status: Status } | null>(null);

  const [editFor, setEditFor] = useState<string | null>(null);
  const [editPayload, setEditPayload] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // sync filters to URL
  useEffect(() => {
    const usp = new URLSearchParams();
    if (debouncedSearch) usp.set('q', debouncedSearch);
    if (status) usp.set('status', status);
    if (model) usp.set('model', model);
    const q = usp.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [debouncedSearch, status, model, pathname, router]);

  // load initial list
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCursor(null);

    (async () => {
      const usp = new URLSearchParams();
      if (debouncedSearch) usp.set('search', debouncedSearch);
      if (status) usp.set('status', status);
      if (model) usp.set('model', model);
      usp.set('take', String(PAGE_SIZE));

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
  }, [debouncedSearch, status, model]);

  async function onLoadMore() {
    if (!cursor) return;
    setLoadingMore(true);

    const usp = new URLSearchParams();
    if (debouncedSearch) usp.set('search', debouncedSearch);
    if (status) usp.set('status', status);
    if (model) usp.set('model', model);
    usp.set('cursor', cursor);
    usp.set('take', String(PAGE_SIZE));

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
    if (debouncedSearch) usp.set('search', debouncedSearch);
    if (status) usp.set('status', status);
    if (model) usp.set('model', model);
    usp.set('take', String(PAGE_SIZE));

    const r = await fetch(`/api/orders?${usp.toString()}`, { cache: 'no-store' });
    if (!r.ok) { setRows([]); setTotal(0); setCursor(null); setLoading(false); return; }
    const data: ApiList = await r.json();
    setRows(data.rows);
    setTotal(data.total);
    setCursor(data.nextCursor ?? null);
    setLoading(false);
  };

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
      const r = await fetch('/api/catalog/MODEL');
      if (r.ok) {
        const list = (await r.json()) as { value: string; label: string }[];
        if (alive) setModelOpts(list);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">Gestão de pedidos GOLDSTAR</p>
        </div>
        <Link
          href="/admin/orders/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Novo Pedido
        </Link>
      </header>

      {/* Filters */}
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
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <Th className="w-36 pl-6">ID do pedido</Th>
              <Th>Cliente</Th>
              <Th>Estado</Th>
              <Th>Conclusão</Th>
              <Th>Modelo</Th>
              <Th className="w-16 pr-6 text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">A carregar…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Sem resultados.</td></tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 ? 'bg-muted/20' : ''}>
                  <Td className="pl-6 font-medium text-foreground">{r.shortId}</Td>
                  <Td className="text-foreground">{r.customer?.name}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td className="text-foreground">{r.eta ? new Date(r.eta).toLocaleDateString('pt-PT') : 'Em curso'}</Td>
                  <Td className="text-foreground">{r.model ?? 'Diversos'}</Td>
                  <Td className="pr-6 text-right">
                    <button
                      onClick={() => setActionsFor({ id: r.id, status: r.status })}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-primary hover:bg-primary/10"
                      title="Editar"
                      type="button"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <div>{rows.length} de {total}</div>
        {cursor ? (
          <button onClick={onLoadMore} disabled={loadingMore} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-foreground hover:bg-muted/60">
            {loadingMore ? 'A carregar…' : 'Carregar mais'}
          </button>
        ) : <div />}
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

      {changeFor && (
        <ChangeStatusModal
          orderId={changeFor.id}
          current={changeFor.status}
          onClose={() => setChangeFor(null)}
          onChanged={refetch}
        />
      )}

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
    </div>
  );
}
