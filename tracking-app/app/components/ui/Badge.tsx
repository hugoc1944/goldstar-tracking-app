import React from 'react';
import type { OrderStatus } from '@/lib/types';

type BadgeProps = { status: OrderStatus; onClick?(): void; asButton?: boolean };

const COLORS: Record<OrderStatus, string> = {
  PREPARACAO: 'bg-info/10 text-info',
  PRODUCAO: 'bg-brand/10 text-brand',
  EXPEDICAO: 'bg-warning/10 text-warning',
  ENTREGUE: 'bg-success/10 text-success',
};

export function Badge({ status, onClick, asButton }: BadgeProps) {
  const cls = `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COLORS[status]}`;
  return asButton ? (
    <button type="button" onClick={onClick} className={`${cls} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-brand/40`}>
      {status}
    </button>
  ) : (
    <span className={cls}>{status}</span>
  );
}
