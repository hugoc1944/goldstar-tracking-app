'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type Status = 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';

const LABEL: Record<Status, string> = {
  PREPARACAO: 'Em preparação',
  PRODUCAO: 'Em produção',
  EXPEDICAO: 'Em expedição',
  ENTREGUE: 'Entregue',
};

const FLOW: Record<Status, Status | null> = {
  PREPARACAO: 'PRODUCAO',
  PRODUCAO: 'EXPEDICAO',
  EXPEDICAO: 'ENTREGUE',
  ENTREGUE: null,
};

function usePortal() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  return mounted ? createPortal : null;
}

function useScrollLock(lock: boolean) {
  useEffect(() => {
    if (!lock) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [lock]);
}

export function ChangeStatusModal({
  orderId,
  current,
  onClose,
  onChanged,
}: {
  orderId: string;
  current: Status;
  onClose: () => void;
  onChanged: () => void;
}) {
  const Portal = usePortal();
  useScrollLock(true);

  const [to, setTo] = useState<Status>(current);
  const [eta, setEta] = useState('');
  const [saving, setSaving] = useState(false);
  const [etaLocal, setEtaLocal] = useState(''); // e.g. "2025-11-05T14:30"
  const next = FLOW[current];
  const needETA = to === 'EXPEDICAO';

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    if (needETA && !etaLocal) {
      alert('ETA é obrigatória para Expedição.');
      return;
    }

    const etaISO = etaLocal ? `${etaLocal}:00Z` : null;

    setSaving(true);
    try {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', to, eta: etaISO || null }),
      });
      if (!r.ok) throw new Error('Falha ao alterar estado');
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!Portal) return null;

  return Portal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative z-10 w-[min(680px,92vw)] rounded-2xl bg-white p-6 shadow-2xl">
        {/* Close (X) */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          aria-label="Fechar"
        >
          ✕
        </button>

        <h3 className="mb-4 text-2xl font-bold tracking-tight">Alterar estado</h3>

        <div className="space-y-6">
          {/* Current status */}
          <div className="text-lg">
            <span className="text-zinc-600">Estado atual do pedido: </span>
            <span className="font-semibold text-zinc-900">{LABEL[current]}</span>
          </div>

          {/* Row: Próximo Estado OR Select */}
          <div className="flex items-center gap-4">
            <button
              disabled={!next}
              onClick={() => next && setTo(next)}
              className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-sm ${
                next
                  ? 'bg-yellow-400 text-zinc-900 hover:bg-yellow-300'
                  : 'cursor-not-allowed bg-zinc-200 text-zinc-500'
              }`}
            >
              Próximo Estado
            </button>

            <span className="text-zinc-500">Ou</span>

            <div className="relative">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value as Status)}
                className="w-56 appearance-none rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 pr-9 text-sm outline-none ring-0 focus:border-zinc-400"
              >
                <option value="PREPARACAO">{LABEL.PREPARACAO}</option>
                <option value="PRODUCAO">{LABEL.PRODUCAO}</option>
                <option value="EXPEDICAO">{LABEL.EXPEDICAO}</option>
                <option value="ENTREGUE">{LABEL.ENTREGUE}</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                ▾
              </span>
            </div>
          </div>

          {/* ETA (only for EXPEDICAO) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Data Estimada de Entrega {needETA && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={etaLocal}
                onChange={(e) => setEtaLocal(e.target.value)}
                className="w-64 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                disabled={!needETA}
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'A guardar…' : 'Alterar Estado'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
