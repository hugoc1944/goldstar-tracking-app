'use client';
import React from 'react';

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: number[];
};

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < pages;

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="text-sm text-text-muted">
        Página {page} de {pages} — {total} registos
      </div>
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <select
            className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}/página
              </option>
            ))}
          </select>
        )}
        <button className="rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={() => onChange(1)} disabled={!canPrev}>
          «
        </button>
        <button className="rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={() => onChange(page - 1)} disabled={!canPrev}>
          ‹
        </button>
        <button className="rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={() => onChange(page + 1)} disabled={!canNext}>
          ›
        </button>
        <button className="rounded-md border border-border bg-surface px-2 py-1 text-sm hover:bg-gray-50 disabled:opacity-50" onClick={() => onChange(pages)} disabled={!canNext}>
          »
        </button>
      </div>
    </div>
  );
}
