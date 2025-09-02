'use client';
import React, { useEffect, useState } from 'react';
import type { CustomerLite } from '@/lib/types';

export type ClientAutocompleteProps = {
  value?: CustomerLite | null;
  onChange: (c: CustomerLite | null) => void;
  onCreateNew?: () => void;
};

export function ClientAutocomplete({ value, onChange, onCreateNew }: ClientAutocompleteProps) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState<CustomerLite[]>([]);
  useEffect(() => {
    let active = true;
    (async () => {
      if (!q) { setOpts([]); return; }
      const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
      if (!active) return;
      const data = await res.json();
      setOpts(data ?? []);
    })();
    return () => { active = false; };
  }, [q]);

  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted"
        placeholder="Cliente"
        value={value?.name ?? q}
        onChange={(e) => { setQ(e.target.value); onChange(null); }}
      />
      {opts.length > 0 && (
        <div className="rounded-md border border-border bg-surface shadow-card">
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-text hover:bg-gray-50"
              onClick={() => onChange(o)}
            >
              <span className="font-medium">{o.name}</span>
              <span className="text-xs text-text-muted">{o.email}</span>
            </button>
          ))}
          {onCreateNew && (
            <div className="border-t border-border p-2 text-right">
              <button className="text-sm text-text hover:underline" onClick={onCreateNew}>Novo cliente</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
