'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

type Props = {
  q?: string;
  includeDeleted: boolean;
  status: string;
  hasPdf: boolean;
  sort: string;
  dateFrom: string;
  dateTo: string;
  minPrice: string;
  maxPrice: string;
  take: number;
};

export default function BudgetsFilterBar({
  q,
  includeDeleted,
  status,
  hasPdf,
  sort,
  dateFrom,
  dateTo,
  minPrice,
  maxPrice,
  take,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = (name: string, value: string | null) => {
    const sp = new URLSearchParams(searchParams?.toString());

    if (value === null || value === '') sp.delete(name);
    else sp.set(name, value);

    sp.delete('cursor');
    const qs = sp.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

    startTransition(() => {
      router.replace(url);
    });
  };

  const clearFilters = () => {
    startTransition(() => {
      router.replace(pathname); // no query params = clean reset
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">

      {/* Pesquisa */}
      <input
        type="text"
        name="q"
        placeholder="Pesquisar…"
        defaultValue={q ?? ''}
        onChange={(e) => updateParam('q', e.target.value || null)}
        className="border rounded-xl px-3 py-2 min-w-[220px] bg-white"
      />

      {/* Incluir apagados */}
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="deleted"
          defaultChecked={includeDeleted}
          onChange={(e) =>
            updateParam('deleted', e.target.checked ? '1' : null)
          }
        />
        <span>Incluir apagados</span>
      </label>

      {/* Status */}
      <select
        name="status"
        defaultValue={status}
        onChange={(e) =>
          updateParam('status', e.target.value === 'all' ? null : e.target.value)
        }
        className="border rounded-xl px-3 py-2 bg-white text-sm"
      >
        <option value="all">Todos os estados</option>
        <option value="not_sent">Não enviados</option>
        <option value="awaiting_confirmation">Aguardar confirmação</option>
        <option value="confirmed">Confirmados</option>
      </select>

      {/* Com Fatura */}
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="hasPdf"
          defaultChecked={hasPdf}
          onChange={(e) =>
            updateParam('hasPdf', e.target.checked ? '1' : null)
          }
        />
        <span>Com Fatura</span>
      </label>

      {/* Data */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Data:</span>
        <input
          type="date"
          name="dateFrom"
          defaultValue={dateFrom}
          onChange={(e) =>
            updateParam('dateFrom', e.target.value || null)
          }
          className="border rounded-xl px-2 py-1 bg-white"
        />
        <span>-</span>
        <input
          type="date"
          name="dateTo"
          defaultValue={dateTo}
          onChange={(e) =>
            updateParam('dateTo', e.target.value || null)
          }
          className="border rounded-xl px-2 py-1 bg-white"
        />
      </div>

      {/* Preço */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-neutral-500">Preço (€):</span>
        <input
          type="number"
          name="minPrice"
          defaultValue={minPrice}
          step="0.01"
          min="0"
          onChange={(e) =>
            updateParam('minPrice', e.target.value || null)
          }
          className="w-20 border rounded-xl px-2 py-1 bg-white"
        />
        <span>-</span>
        <input
          type="number"
          name="maxPrice"
          defaultValue={maxPrice}
          step="0.01"
          min="0"
          placeholder="máx."
          onChange={(e) =>
            updateParam('maxPrice', e.target.value || null)
          }
          className="w-20 border rounded-xl px-2 py-1 bg-white"
        />
      </div>

      {/* Sort */}
      <select
        name="sort"
        defaultValue={sort}
        onChange={(e) => updateParam('sort', e.target.value)}
        className="border rounded-xl px-3 py-2 bg-white text-sm"
      >
        <option value="createdAt_desc">Mais recentes</option>
        <option value="createdAt_asc">Mais antigos</option>
        <option value="name_asc">Nome A-Z</option>
        <option value="name_desc">Nome Z-A</option>
        <option value="price_desc">Preço mais alto</option>
        <option value="price_asc">Preço mais baixo</option>
      </select>

      {/* Take */}
      <select
        name="take"
        defaultValue={String(take)}
        onChange={(e) => updateParam('take', e.target.value)}
        className="border rounded-xl px-3 py-2 bg-white text-sm"
      >
        <option value="25">25 / pág</option>
        <option value="50">50 / pág</option>
        <option value="100">100 / pág</option>
        <option value="200">200 / pág</option>
      </select>

      {/* Limpar filtros */}
      <button
        type="button"
        onClick={clearFilters}
        className="rounded-xl bg-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-300"
      >
        Limpar
      </button>

      {/* Loading */}
      {isPending && (
        <div className="text-sm text-neutral-500 animate-pulse">
          A atualizar…
        </div>
      )}
    </div>
  );
}
