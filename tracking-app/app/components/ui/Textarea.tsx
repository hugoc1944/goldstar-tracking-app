'use client';
import React from 'react';
import type { BaseFieldProps } from './Input';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & BaseFieldProps;

export function Textarea({ label, hint, error, className = '', ...rest }: TextareaProps) {
  return (
    <label className={`block ${className}`}>
      {label && <div className="mb-1 text-sm font-medium text-text">{label}</div>}
      <textarea
        {...rest}
        className={`w-full rounded-md border px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted ${
          error ? 'border-danger' : 'border-border'
        } bg-surface focus:ring-2 focus:ring-brand/40`}
      />
      {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}
