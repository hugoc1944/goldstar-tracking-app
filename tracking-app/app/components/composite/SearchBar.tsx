'use client';
import React, { useState, useEffect } from 'react';
import { useDebounce } from '@/lib/useDebounce';

export type SearchBarProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
  className?: string;
};

export function SearchBar({ value, onChange, placeholder = 'Pesquisar…', debounceMs = 350, autoFocus, className = '' }: SearchBarProps) {
  const [q, setQ] = useState(value);
  const debounced = useDebounce(q, debounceMs);
  useEffect(() => onChange(debounced), [debounced, onChange]);
  useEffect(() => setQ(value), [value]);

  return (
    <input
      className={`w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:ring-2 focus:ring-brand/40 ${className}`}
      placeholder={placeholder}
      value={q}
      onChange={(e) => setQ(e.target.value)}
      autoFocus={autoFocus}
    />
  );
}
