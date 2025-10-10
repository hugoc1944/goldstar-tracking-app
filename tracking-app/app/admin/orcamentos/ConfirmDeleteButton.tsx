'use client';

export default function ConfirmDeleteButton({ id }: { id: string }) {
  return (
    <form
      action={`/admin/orcamentos/${id}/actions`}
      method="post"
      onSubmit={(e) => {
        const ok = window.confirm('Tem a certeza que quer apagar este orçamento?');
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="action" value="delete" />
      <button className="text-red-600 underline">Apagar</button>
    </form>
  );
}
