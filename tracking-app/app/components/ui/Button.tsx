'use client';
import React from 'react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-60';

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand text-brand-foreground hover:bg-brand-600',
  secondary: 'bg-surface text-text border border-border hover:bg-gray-50',
  ghost: 'bg-transparent text-text hover:bg-gray-100',
  danger: 'bg-danger text-text-inverse hover:bg-red-700',
};

export function Button({
  variant = 'primary',
  loading,
  leftIcon,
  rightIcon,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={loading || rest.disabled}
      className={`${base} ${variants[variant]} ${className}`}
      aria-busy={loading ? true : undefined}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}
