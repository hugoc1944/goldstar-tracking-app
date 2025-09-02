import React from 'react';

export type Chip = { label: string; onRemove: () => void };
export type FiltersToolbarProps = {
  children: React.ReactNode;
  activeChips?: Chip[];
  onClearAll?: () => void;
  rightActions?: React.ReactNode;
  className?: string;
};

export function FiltersToolbar({ children, activeChips = [], onClearAll, rightActions, className = '' }: FiltersToolbarProps) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-3 shadow-card ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-3">{children}</div>
        {rightActions}
      </div>
      {activeChips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeChips.map((c, i) => (
            <button
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text"
              onClick={c.onRemove}
              type="button"
              title="Remover filtro"
            >
              {c.label} ✕
            </button>
          ))}
          {onClearAll && (
            <button className="text-xs text-text-muted underline hover:text-text" onClick={onClearAll}>
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
