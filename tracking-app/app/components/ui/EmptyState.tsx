import React from 'react';

export type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center rounded-2xl border border-border p-8 text-center">
      <div>
        <h3 className="text-base font-medium text-text">{title}</h3>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
