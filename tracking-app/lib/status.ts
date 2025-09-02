import type { OrderStatus } from './types';

export const ORDER_FLOW: OrderStatus[] = [
  'PREPARACAO', 'PRODUCAO', 'EXPEDICAO', 'ENTREGUE'
];

export function canTransition(from: OrderStatus, to: OrderStatus) {
  const i = ORDER_FLOW.indexOf(from);
  const j = ORDER_FLOW.indexOf(to);
  return i >= 0 && j === i + 1; // only forward 1 step
}

export const requiresEtaOn = (to: OrderStatus) => to === 'EXPEDICAO';
export const clearsEtaOn   = (to: OrderStatus) => to === 'ENTREGUE';