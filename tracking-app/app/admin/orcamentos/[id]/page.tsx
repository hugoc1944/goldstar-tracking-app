import { requireAdminSession } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import AdminBudgetEditor from './AdminBudgetEditor';
import AdminShell from '@/app/components/admin/AdminShell';

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
