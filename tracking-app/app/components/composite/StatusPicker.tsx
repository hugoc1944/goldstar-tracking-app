'use client';
import React, { useState } from 'react';
import type { OrderStatus } from '@/lib/types';
import { canTransition, requiresEtaOn, clearsEtaOn, ORDER_FLOW } from '@/lib/status';
import { Button } from '../ui/Button';

export type StatusPickerProps = {
  current: OrderStatus;
  onSelect: (next: { status: OrderStatus; eta?: string | null }) => Promise<void> | void;
  getNow?: () => Date;
};

export function StatusPicker({ current, onSelect, getNow }: StatusPickerProps) {
  const [eta, setEta] = useState<string>('');
  const next = ORDER_FLOW.find((s) => canTransition(current, s));
  if (!next) return null;

  const needsEta = requiresEtaOn(next);
  const handleConfirm = async () => {
    const payload: { status: OrderStatus; eta?: string | null } = { status: next };
    if (needsEta) payload.eta = eta || undefined;
    if (clearsEtaOn(next)) payload.eta = null;
    await onSelect(payload);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-text">Próximo estado: <strong>{labelPT(next)}</strong></div>
      {needsEta && (
        <input
          type="datetime-local"
          value={eta}
          onChange={(e) => setEta(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-text"
          min={(getNow?.() ?? new Date()).toISOString().slice(0, 16)}
        />
      )}
      <Button className="w-full" onClick={handleConfirm} disabled={needsEta && !eta}>
        Confirmar
      </Button>
    </div>
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
