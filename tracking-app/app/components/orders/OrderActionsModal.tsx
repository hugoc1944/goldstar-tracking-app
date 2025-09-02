'use client';

export default function OrderActionsModal({
  orderId,
  onClose,
  onChangeState,
  onEditOrder,
}: {
  orderId: string;
  onClose: () => void;
  onChangeState: (orderId: string) => void;
  onEditOrder: (orderId: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold">Ações do pedido</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione a ação para o pedido <span className="font-medium">{orderId.slice(0, 8)}</span>
        </p>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            onClick={() => onChangeState(orderId)}
            className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium hover:bg-muted/60"
          >
            Alterar estado
          </button>

          <button
            type="button"
            onClick={() => onEditOrder(orderId)}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Editar pedido
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted/60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
