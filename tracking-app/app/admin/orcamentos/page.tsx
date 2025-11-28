// app/admin/orcamentos/page.tsx
import Link from 'next/link';
import { headers } from 'next/headers';
import { requireAdminSession } from '@/lib/auth-helpers';
import AdminShell from '@/app/components/admin/AdminShell';
import ConfirmDeleteButton from './ConfirmDeleteButton';
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

async function fetchBudgets({ q, includeDeleted }: { q?: string; includeDeleted?: boolean }) {
  const sp = new URLSearchParams();
  sp.set('take', '50');
  if (q) sp.set('q', q);
  if (includeDeleted) sp.set('includeDeleted', '1');

  const h = await headers();
  const host  = h.get('x-forwarded-host') ?? h.get('host')!;
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const base  = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;

  const res = await fetch(`${base}/api/budgets?${sp.toString()}`, { cache: 'no-store' });
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

  const items = await fetchBudgets({ q, includeDeleted });

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold mb-4">Orçamentos</h1>

      {/* Toolbar */}
      <form className="mb-4 flex flex-wrap items-center gap-3" action="/admin/orcamentos" method="get">
        <input
          type="text"
          name="q"
          placeholder="Pesquisar…"
          defaultValue={q ?? ''}
          className="border rounded-xl px-3 py-2 min-w-[260px] bg-white"
        />
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" name="deleted" value="1" defaultChecked={includeDeleted} />
          <span>Incluir apagados</span>
        </label>
        <button
          className="rounded-xl bg-black px-3 py-2 text-white shadow-[0_2px_10px_rgba(0,0,0,0.15),0_0_6px_rgba(250,204,21,0.25)]
                    hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
        >
          Filtrar
        </button>
      </form>

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
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {(items ?? []).map((b: any) => (
              <tr key={b.id} className="hover:bg-neutral-50/60">
                <td className="px-4 py-3">{new Date(b.createdAt).toLocaleDateString('pt-PT')}</td>
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
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <Link className="text-yellow-700 hover:underline" href={`/admin/orcamentos/${b.id}`}>Abrir</Link>
                    {!b.deletedAt ? (
                      <ConfirmDeleteButton id={b.id} />
                    ) : (
                      <form action={`/admin/orcamentos/${b.id}/actions`} method="post">
                        <input type="hidden" name="action" value="restore" />
                        <button className="text-emerald-700 hover:underline">Restaurar</button>
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
