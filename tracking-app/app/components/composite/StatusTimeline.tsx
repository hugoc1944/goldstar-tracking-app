'use client';

import React from 'react';
import type { OrderStatus } from '@/lib/types';
import { ORDER_FLOW } from '@/lib/status';

export type StatusEvent = { from: OrderStatus; to: OrderStatus; at: string; note?: string };
export type StatusTimelineProps = {
  current: OrderStatus;
  createdAt?: string;
  eta?: string | null;
  compact?: boolean;
  events?: StatusEvent[];
};

export function StatusTimeline({ current, createdAt, eta, compact = false, events = [] }: StatusTimelineProps) {
  const currentIdx = Math.max(0, ORDER_FLOW.indexOf(current));

  return (
    <ol className={compact ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-4 gap-4'}>
      {ORDER_FLOW.map((step, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;

        const dotBase = 'flex h-3 w-3 items-center justify-center rounded-full';
        const dot = isDone ? 'bg-success' : isCurrent ? 'bg-brand' : 'bg-border';
        const bar = i < ORDER_FLOW.length - 1 ? (isDone ? 'bg-success' : isCurrent ? 'bg-brand/40' : 'bg-border') : '';
        const ev = events.find((e) => e.to === step);

        return (
          <li key={step} className="relative">
            {i < ORDER_FLOW.length - 1 && (
              <div className={`absolute left-[calc(50%+0.5rem)] top-2 h-0.5 w-[calc(100%-1rem)] ${bar}`} aria-hidden />
            )}

            <div className="flex items-center gap-2">
              <span className={`${dotBase} ${dot}`} aria-hidden />
              <span className={compact ? 'text-[11px] font-medium tracking-tight text-text' : 'text-sm font-medium text-text'}>
                {labelPT(step)}
              </span>
            </div>

            <div className="ml-5 mt-1 text-xs text-text-muted">
              {i === 0 && createdAt && <div>{fmtDateTime(createdAt)}</div>}
              {ev?.at && i > 0 && <div>{fmtDateTime(ev.at)}</div>}
              {step === 'EXPEDICAO' && isCurrent && eta && <div className="text-warning">ETA: {fmtDateTime(eta)}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function labelPT(s: OrderStatus) {
  switch (s) {
    case 'PREPARACAO': return 'Em preparação';
    case 'PRODUCAO': return 'Em produção';
    case 'EXPEDICAO': return 'Em expedição';
    case 'ENTREGUE': return 'Entregue';
  }
}

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d);
  } catch {
    return iso;
  }
}
