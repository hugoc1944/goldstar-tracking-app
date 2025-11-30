// app/admin/orcamentos/page.tsx
import Link from 'next/link';
import { headers } from 'next/headers';
import { requireAdminSession } from '@/lib/auth-helpers';
import AdminShell from '@/app/components/admin/AdminShell';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import BudgetsFilterBar from './BudgetsFilterBar';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type BudgetFilters = {
  q?: string;
  includeDeleted?: boolean;
  status?: string;
  hasPdf?: boolean;
  sort?: string;
  dateFrom?: string;
  dateTo?: string;
  minPrice?: string;
  maxPrice?: string;
  take?: number;
};

async function fetchBudgets(filters: BudgetFilters) {
  const sp = new URLSearchParams();

  sp.set('take', String(filters.take ?? 50));

  if (filters.q) sp.set('q', filters.q);
  if (filters.includeDeleted) sp.set('includeDeleted', '1');
  if (filters.status && filters.status !== 'all') sp.set('status', filters.status);
  if (filters.hasPdf) sp.set('hasPdf', '1');
  if (filters.sort) sp.set('sort', filters.sort);
  if (filters.dateFrom) sp.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) sp.set('dateTo', filters.dateTo);
  if (filters.minPrice) sp.set('minPrice', filters.minPrice);
  if (filters.maxPrice) sp.set('maxPrice', filters.maxPrice);

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host')!;
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const base = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;

  const res = await fetch(`${base}/api/budgets?${sp.toString()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('failed to load budgets');
  const data = await res.json();
  return (data.items ?? []) as any[];
}

export default async function AdminBudgetsPage({
  searchParams,
}: {
  // accept either a plain object or a Promise (newer Next)
  searchParams?: Promise<Record<string, string | string[] | undefined>> |
                 Record<string, string | string[] | undefined>;
}) {
  await requireAdminSession();

  const sp =
    typeof (searchParams as any)?.then === 'function'
      ? await (searchParams as Promise<Record<string, string | string[] | undefined>>)
      : ((searchParams as Record<string, string | string[] | undefined>) ?? {});

  const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

  const q = first(sp.q)?.trim() || undefined;
  const includeDeleted = first(sp.deleted) === '1';
  const status = first(sp.status) || 'all';
  const hasPdf = first(sp.hasPdf) === '1';
  const sort = first(sp.sort) || 'createdAt_desc';

  const dateFrom = first(sp.dateFrom) || '';
  const dateTo = first(sp.dateTo) || '';
  const minPrice = first(sp.minPrice) || '';
  const maxPrice = first(sp.maxPrice) || '';

  const takeParam = first(sp.take);
  const take = takeParam ? Number(takeParam) || 50 : 50;

  const items = await fetchBudgets({
    q,
    includeDeleted,
    status,
    hasPdf,
    sort,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    minPrice: minPrice || undefined,
    maxPrice: maxPrice || undefined,
    take,
  });

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold mb-4">Orçamentos</h1>

       {/* Toolbar */}
           <BudgetsFilterBar
        q={q ?? ''}
        includeDeleted={includeDeleted}
        status={status}
        hasPdf={hasPdf}
        sort={sort}
        dateFrom={dateFrom}
        dateTo={dateTo}
        minPrice={minPrice}
        maxPrice={maxPrice}
        take={take}
      />

      {/* Card + table with Goldstar look */}
      <div
        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
        style={{ boxShadow: '0 0 14px 1px rgba(192,134,37,0.14)' }}
      >
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50/80 text-neutral-700">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Data</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Modelo</th>
              <th className="px-4 py-3 text-left font-semibold">Estado</th>
              <th className="px-4 py-3 text-left font-semibold">Valor</th>
              <th className="px-4 py-3 text-left font-semibold">Fatura</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-neutral-200">
            {(items ?? []).map((b: any) => (
              <tr key={b.id} className="hover:bg-neutral-50/60">
                <td className="px-4 py-3">
                  {new Date(b.createdAt).toLocaleDateString('pt-PT')}
                </td>
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3">{b.email}</td>
                <td className="px-4 py-3">{b.modelKey}</td>
                <td className="px-4 py-3">
                  {b.deletedAt ? (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      Apagado
                    </span>
                  ) : !b.sentAt ? (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      Não enviado
                    </span>
                  ) : !b.confirmedAt ? (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Aguarda Confirmação
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Confirmado
                    </span>
                  )}
                </td>

                {/* Valor */}
                <td className="px-4 py-3">
                  {typeof b.priceCents === 'number' ? (
                    <>
                      {(b.priceCents / 100).toLocaleString('pt-PT', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                      {typeof b.installPriceCents === 'number' &&
                        b.installPriceCents > 0 && (
                          <span className="ml-1 text-xs text-neutral-500">
                            +
                            {(b.installPriceCents / 100).toLocaleString(
                              'pt-PT',
                              {
                                style: 'currency',
                                currency: 'EUR',
                              }
                            )}{' '}
                            instalação
                          </span>
                        )}
                    </>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>

                {/* PDF */}
                <td className="px-4 py-3">
                  {b.invoicePdfUrl ? (
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">
                      Sim
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">Não</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link
                      className="text-yellow-700 hover:underline"
                      href={`/admin/orcamentos/${b.id}`}
                    >
                      Abrir
                    </Link>
                    {!b.deletedAt ? (
                      <ConfirmDeleteButton id={b.id} />
                    ) : (
                      <form
                        action={`/admin/orcamentos/${b.id}/actions`}
                        method="post"
                      >
                        <input
                          type="hidden"
                          name="action"
                          value="restore"
                        />
                        <button className="text-emerald-700 hover:underline">
                          Restaurar
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}