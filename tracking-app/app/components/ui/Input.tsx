'use client';
import React from 'react';

export type BaseFieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  className?: string;
};

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & BaseFieldProps;

export function Input({ label, hint, error, leadingIcon, trailingIcon, className = '', ...rest }: InputProps) {
  return (
    <label className={`block ${className}`}>
      {label && <div className="mb-1 text-sm font-medium text-text">{label}</div>}
      <div
        className={`flex items-center rounded-md border px-3 py-2 ${
          error ? 'border-danger' : 'border-border'
        } bg-surface focus-within:ring-2 focus-within:ring-brand/40`}
      >
        {leadingIcon && <span className="mr-2 text-text-muted">{leadingIcon}</span>}
        <input {...rest} className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted" />
        {trailingIcon && <span className="ml-2 text-text-muted">{trailingIcon}</span>}
      </div>
      {hint && !error && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </label>
  );
}
