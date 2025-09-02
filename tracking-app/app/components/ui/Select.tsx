'use client';
import React from 'react';
import type { BaseFieldProps } from './Input';

export type SelectOption = { label: string; value: string };
export type SelectProps = BaseFieldProps & {
  value?: string;
  onChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
};

export function Select({ label, hint, error, value, onChange, options, placeholder, disabled, className = '' }: SelectProps) {
  return (
    <label className={`block ${className}`}>
      {label && <div className="mb-1 text-sm font-medium text-text">{label}</div>}
      <div className={`rounded-md border ${error ? 'border-danger' : 'border-border'} bg-surface`}>
        <select
          className="w-full appearance-none bg-transparent px-3 py-2 text-sm text-text outline-none"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}
