'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

type Status = 'AGUARDA_VISITA' | 'PREPARACAO' | 'PRODUCAO' | 'EXPEDICAO' | 'ENTREGUE';

const LABEL: Record<Status, string> = {
  AGUARDA_VISITA: 'Aguarda visita', // <- NEW
  PREPARACAO: 'Em preparação',
  PRODUCAO: 'Em produção',
  EXPEDICAO: 'Em expedição',
  ENTREGUE: 'Entregue',
};

const FLOW: Record<Status, Status | null> = {
  AGUARDA_VISITA: 'PREPARACAO',
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
  const [saving, setSaving] = useState(false);

  // Local pickers
  const [etaLocal, setEtaLocal] = useState('');        // EXPEDIÇÃO only
  const [visitAtLocal, setVisitAtLocal] = useState(''); // AGUARDA_VISITA only

  const [visitPeriod, setVisitPeriod] = useState<'MANHA' | 'TARDE'>('MANHA');
  const [expeditionPeriod, setExpeditionPeriod] = useState<'MANHA' | 'TARDE'>('MANHA');



  const [initialVisitAtLocal, setInitialVisitAtLocal] = useState('');
  const [initialVisitPeriod, setInitialVisitPeriod] =
    useState<'MANHA' | 'TARDE'>('MANHA');

  const [initialEtaLocal, setInitialEtaLocal] = useState('');
  const [initialExpeditionPeriod, setInitialExpeditionPeriod] =
    useState<'MANHA' | 'TARDE'>('MANHA');
  // Prefill the visit date when the order is in "Aguarda visita"
  useEffect(() => {
    if (current !== 'AGUARDA_VISITA') return;
    (async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        const iso = data?.forModal?.state?.visitAt ?? null;
        const period = data?.forModal?.state?.visitPeriod ?? 'MANHA';

        if (iso) {
          const dateOnly = String(iso).slice(0, 10);
          setVisitAtLocal(dateOnly);
          setInitialVisitAtLocal(dateOnly);

          setVisitPeriod(period);
          setInitialVisitPeriod(period);
        }
      } catch {}
    })();
  }, [orderId, current]);
  // Prefill ETA when order is already in "Em expedição"
  useEffect(() => {
    if (current !== 'EXPEDICAO') return;
    (async () => {
      try {
        const r = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();

        const iso = data?.forModal?.state?.eta ?? null;
        const period = data?.forModal?.state?.expeditionPeriod ?? 'MANHA';

        if (iso) {
          const dateOnly = String(iso).slice(0, 10);
          setEtaLocal(dateOnly);
          setInitialEtaLocal(dateOnly);

          setExpeditionPeriod(period);
          setInitialExpeditionPeriod(period);
        }
      } catch {}
    })();
  }, [orderId, current]);

  const next = FLOW[current];
  const showEta = to === 'EXPEDICAO';
  const showVisit = to === 'AGUARDA_VISITA';

  useEffect(() => {
  if (to !== 'EXPEDICAO' && current === 'EXPEDICAO') {
    setEtaLocal('');
    setExpeditionPeriod('MANHA');
  }

  if (to !== 'AGUARDA_VISITA' && current === 'AGUARDA_VISITA') {
    setVisitAtLocal('');
    setVisitPeriod('MANHA');
  }
}, [to, current]);

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit() {
    const payload: any = { action: 'status', to };

    if (to === 'EXPEDICAO') {
      if (!etaLocal) {
        throw new Error('ETA em falta para expedição');
      }

      payload.eta = etaLocal; // always send
      payload.expeditionPeriod = expeditionPeriod;
    }

    if (to === 'AGUARDA_VISITA' && visitAtLocal) {
      payload.visitAt = visitAtLocal; // yyyy-mm-dd
      payload.visitPeriod = visitPeriod;
    }

    setSaving(true);
    try {
      const r = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('Falha ao alterar estado');
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!Portal) return null;

  const stateChanged = to !== current;
  const visitChanged =
    to === 'AGUARDA_VISITA' &&
    visitAtLocal &&
    (visitAtLocal !== initialVisitAtLocal ||
      visitPeriod !== initialVisitPeriod);

  const expeditionChanged =
    to === 'EXPEDICAO' &&
    etaLocal &&
    (etaLocal !== initialEtaLocal ||
      expeditionPeriod !== initialExpeditionPeriod);

  const btnLabel = stateChanged ? 'Alterar Estado' : 'Guardar Estado';
  const canSubmit =
    stateChanged ||
    visitChanged ||
    expeditionChanged;

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
                <option value="AGUARDA_VISITA">{LABEL.AGUARDA_VISITA}</option>
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

          {/* Data da Visita — only for "Aguarda visita" */}
          {showVisit && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Data da Visita
                </label>
                <input
                  type="date"
                  value={visitAtLocal}
                  onChange={(e) => setVisitAtLocal(e.target.value)}
                  className="w-64 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Período do Dia
                </label>
                <select
                  value={visitPeriod}
                  onChange={(e) => setVisitPeriod(e.target.value as 'MANHA' | 'TARDE')}
                  className="w-64 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                >
                  <option value="MANHA">
                    Manhã (08:30 – 13:00)
                  </option>
                  <option value="TARDE">
                    Tarde (14:00 – 18:00)
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* ETA — only for "Em expedição" */}
          {showEta && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Data prevista de Expedição
              </label>
              <input
                type="date"
                value={etaLocal}
                onChange={(e) => setEtaLocal(e.target.value)}
                className="w-64 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Período do Dia
              </label>
              <select
                value={expeditionPeriod}
                onChange={(e) =>
                  setExpeditionPeriod(e.target.value as 'MANHA' | 'TARDE')
                }
                className="w-64 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              >
                <option value="MANHA">
                  Manhã (08:30 – 13:00)
                </option>
                <option value="TARDE">
                  Tarde (14:00 – 18:00)
                </option>
              </select>
            </div>
          </div>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <button
              onClick={submit}
              disabled={saving || !canSubmit}
              className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'A guardar…' : btnLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
