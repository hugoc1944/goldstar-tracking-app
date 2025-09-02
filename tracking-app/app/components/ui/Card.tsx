import React from 'react';

export type CardProps = {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function Card({ title, actions, children, className = '' }: CardProps) {
  return (
    <section className={`rounded-2xl border border-border bg-surface p-4 shadow-card ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-base font-semibold text-text">{title}</h3>}
          {actions}
        </header>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}
