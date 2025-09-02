'use client';
import React, { useEffect, useRef } from 'react';

export type ModalProps = {
  title: string;
  open: boolean;
  onClose(): void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement>;
};

export function Modal({ title, open, onClose, children, footer, initialFocusRef }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && initialFocusRef?.current) initialFocusRef.current.focus();
  }, [open, initialFocusRef]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-2xl bg-surface p-4 shadow-modal">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Fechar">×</button>
        </div>
        <div className="space-y-3">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
