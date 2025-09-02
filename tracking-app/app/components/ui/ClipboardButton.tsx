'use client';
import React from 'react';

export type ClipboardButtonProps = {
  text: string;
  onCopied?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function ClipboardButton({ text, onCopied, children, className = '' }: ClipboardButtonProps) {
  return (
    <button
      type="button"
      className={`rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text hover:bg-gray-50 ${className}`}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        onCopied?.();
      }}
    >
      {children}
    </button>
  );
}
