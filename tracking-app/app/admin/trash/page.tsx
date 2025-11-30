"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/app/components/admin/AdminShell";
import {
  Trash2,
  RotateCcw,
  XCircle,
  Search,
  Loader2,
} from "lucide-react";

type TrashRow = {
  type: "order" | "customer" | "budget";
  id: string;
  name: string;
  email: string;
  extra: string;
  source: string;
  createdAt: string | null;
  deletedAt: string | null;
};

type ApiResponse = {
  rows: TrashRow[];
};

// Small table helpers (same vibe as other pages)
function Th({
  children,
  className = "",
  ...rest
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  children: React.ReactNode;
}) {
  return (
    <th
      {...rest}
      className={
        "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground " +
        className
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  ...rest
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  children: React.ReactNode;
}) {
  return (
    <td
      {...rest}
      className={"px-4 py-2 text-sm text-foreground " + className}
    >
      {children}
    </td>
  );
}

function GsSpinner({ size = 16 }: { size?: number }) {
  return (
    <Loader2
      size={size}
      className="inline-block animate-spin text-muted-foreground"
      aria-hidden
    />
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-PT");
}

export default function TrashPage() {
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  async function fetchTrash(currentSearch: string = "") {
    setLoading(true);
    try {
      const usp = new URLSearchParams();
      if (currentSearch.trim()) usp.set("search", currentSearch.trim());
      const res = await fetch(`/api/trash?${usp.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Falha ao carregar lixeira");
      const data: ApiResponse = await res.json();
      setRows(data.rows || []);
      // When reloading, clear selection
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
      alert("Erro ao carregar a lixeira.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrash();
  }, []);

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  async function callTrashAction(
    action: "restore" | "hard-delete",
    items: TrashRow[]
  ) {
    const payload = {
      action,
      items: items.map((r) => ({ type: r.type, id: r.id })),
    };

    const res = await fetch("/api/trash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(txt || "Erro ao aplicar ação na lixeira");
    }
  }

  async function restoreItem(row: TrashRow) {
    setPending(true);
    try {
      await callTrashAction("restore", [row]);
      await fetchTrash(search);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Erro ao restaurar registo");
    } finally {
      setPending(false);
    }
  }

  async function deleteForever(row: TrashRow) {
    if (
      !confirm(
        "Apagar definitivamente este registo? Esta ação não pode ser desfeita."
      )
    ) {
      return;
    }

    setPending(true);
    try {
      await callTrashAction("hard-delete", [row]);
      await fetchTrash(search);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Erro ao apagar registo");
    } finally {
      setPending(false);
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Apagar definitivamente ${selectedIds.size} registo(s)? Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }

    setBulkPending(true);
    try {
      const items = rows.filter((r) => selectedIds.has(r.id));
      if (!items.length) return;
      await callTrashAction("hard-delete", items);
      await fetchTrash(search);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Erro ao apagar registos");
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <AdminShell>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Trash2 size={22} /> Lixeira
          </h1>
          <p className="text-sm text-muted-foreground">
            Restaurar ou apagar definitivamente pedidos, clientes e orçamentos.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") fetchTrash(search);
              }}
              placeholder="Procurar na lixeira"
              className="w-full rounded-lg border border-border bg-surface pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="button"
            onClick={() => fetchTrash(search)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-medium text-foreground hover:bg-muted/40"
          >
            <Trash2 size={14} />
            Atualizar
          </button>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground">
              <Th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
              </Th>
              <Th>ID</Th>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Origem</Th>
              <Th>Info</Th>
              <Th>Apagado em</Th>
              <Th className="w-40 text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <Td
                  className="py-8 text-center text-muted-foreground"
                  colSpan={8}
                >
                  <GsSpinner /> <span className="ml-2">A carregar…</span>
                </Td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <Td
                  className="py-8 text-center text-muted-foreground"
                  colSpan={8}
                >
                  A lixeira está vazia.
                </Td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const checked = selectedIds.has(r.id);
                return (
                  <tr
                    key={`${r.type}-${r.id}`}
                    className={idx % 2 ? "bg-muted/10" : ""}
                  >
                    <Td className="w-10">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelect(r.id)}
                        aria-label="Selecionar linha"
                      />
                    </Td>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {r.id.slice(0, 8)}
                    </Td>
                    <Td>{r.name || "-"}</Td>
                    <Td>{r.email || "-"}</Td>
                    <Td>{r.source}</Td>
                    <Td>{r.extra}</Td>
                    <Td>{formatDate(r.deletedAt)}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => restoreItem(r)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {pending ? (
                            <GsSpinner size={14} />
                          ) : (
                            <RotateCcw size={14} />
                          )}
                          <span>Restaurar</span>
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => deleteForever(r)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          {pending ? (
                            <GsSpinner size={14} />
                          ) : (
                            <XCircle size={14} />
                          )}
                          <span>Apagar</span>
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk delete bar */}
      {rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {selectedIds.size > 0
              ? `${selectedIds.size} registo(s) selecionado(s)`
              : `${rows.length} registo(s) na lixeira`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={bulkDelete}
              disabled={selectedIds.size === 0 || bulkPending}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {bulkPending ? <GsSpinner size={14} /> : <XCircle size={14} />}
              <span>Apagar selecionados</span>
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
