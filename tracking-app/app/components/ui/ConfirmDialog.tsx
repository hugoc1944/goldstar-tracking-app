'use client';
import React from 'react';
import { Modal } from './Modal';

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
  onConfirm(): Promise<void> | void;
  onCancel(): void;
};

export function ConfirmDialog({
  open, title, description,
  confirmText = 'Confirmar', cancelText = 'Cancelar',
  variant = 'default', onConfirm, onCancel
}: ConfirmDialogProps) {
  return (
    <Modal title={title} open={open} onClose={onCancel} footer={
      <>
        <button className="rounded-xl px-3 py-2 text-sm text-text hover:bg-gray-100" onClick={onCancel}>{cancelText}</button>
        <button
          className={`rounded-xl px-3 py-2 text-sm text-white ${variant === 'danger' ? 'bg-danger hover:bg-red-700' : 'bg-text hover:bg-black'}`}
          onClick={async () => { await onConfirm(); }}
        >
          {confirmText}
        </button>
      </>
    }>
      {description && <p className="text-sm text-text-muted">{description}</p>}
    </Modal>
  );
}
