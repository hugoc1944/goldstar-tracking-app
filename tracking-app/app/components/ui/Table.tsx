import React from 'react';
import { Skeleton } from './Skeleton';

export type Column<T> = {
  key: keyof T | string;
  header: string;
  width?: string | number;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
};

export type TableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  sort?: { key: string; dir: 'asc' | 'desc' | null };
  onSortChange?: (key: string, dir: 'asc' | 'desc' | null) => void;
};

export function Table<T>({ columns, rows, rowKey, loading, emptyState, onRowClick, sort, onSortChange }: TableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                style={{ width: c.width }}
                className="sticky top-0 z-10 border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-muted"
              >
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 ${c.sortable ? 'hover:underline' : 'cursor-default'}`}
                  onClick={() => {
                    if (!c.sortable) return;
                    const dir =
                      sort?.key !== c.key
                        ? 'asc'
                        : sort?.dir === 'asc'
                        ? 'desc'
                        : sort?.dir === 'desc'
                        ? null
                        : 'asc';
                    onSortChange?.(String(c.key), dir);
                  }}
                >
                  {c.header}
                  {c.sortable && sort?.key === c.key && (sort.dir === 'asc' ? '▲' : sort.dir === 'desc' ? '▼' : '')}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td className="px-3 py-3" colSpan={columns.length}>
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))
            : rows.length === 0
            ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-text-muted" colSpan={columns.length}>
                  {emptyState ?? 'Sem dados'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={`border-t border-border hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((c) => (
                    <td key={String(c.key)} className="px-3 py-2 text-sm text-text">
                      {c.render ? c.render(row) : (row as any)[c.key as any]}
                    </td>
                  ))}
                </tr>
              ))
            )}
        </tbody>
      </table>
    </div>
  );
}
