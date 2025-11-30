import { requireAdminSession } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import AdminBudgetEditor from './AdminBudgetEditor';
import AdminShell from '@/app/components/admin/AdminShell';

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type Search = Record<string, string | string[] | undefined>;

// Works whether Next gives you a Promise or a plain object
async function resolveSearchParams(
  spOrPromise?: Search | Promise<Search>
): Promise<Search> {
  if (!spOrPromise) return {};
  // @ts-ignore – narrow "thenable"
  return typeof spOrPromise.then === 'function'
    // @ts-ignore
    ? await spOrPromise
    : (spOrPromise as Search);
}

function pick(sp: Search, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}



export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;

  const budget = await prisma.budget.findUnique({ where: { id } });
  if (!budget) {
    return (
      <AdminShell>
        <div className="p-6">Orçamento não encontrado.</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <h1 className="text-2xl font-semibold mb-6">Orçamento</h1>
      <AdminBudgetEditor budget={budget} />
    </AdminShell>
  );
}
