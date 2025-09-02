// app/lib/types.ts
// Single source of truth for shared types
export type OrderStatus = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';

export interface CustomerLite {
  id: string;
  name: string;
  email: string;
  phone?: string;
  nif?: string;
  address?: string;
}

export interface OrderLite {
  id: string;
  status: OrderStatus;
  createdAt: string;           // ISO
  trackingNumber?: string;
  eta?: string | null;         // ISO or null
  customer: CustomerLite;
  _count?: { items?: number };
}