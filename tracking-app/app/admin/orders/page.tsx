import { Suspense } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import OrdersClient from './OrdersClient';

export default function Page() {
  return (
    <AdminShell>
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">A carregar…</div>}>
        <OrdersClient />
      </Suspense>
    </AdminShell>
  );
}