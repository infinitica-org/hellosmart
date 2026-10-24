'use client';

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/button';

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  variant?: 'danger' | 'warning' | 'primary' | undefined;
  loading?: boolean | undefined;
  className?: string | undefined;
  'data-testid'?: string | undefined;
}

export function AlertDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  className = '',
  'data-testid': testId,
}: AlertDialogProps): React.JSX.Element | null {
  const [mounted, setMounted] = useState(false);
  const titleId = React.useId();
  const descId = React.useId();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, loading]);

  if (!open || !mounted) return null;

  const iconColors = {
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    primary: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    primary: 'primary' as const,
  };

  const alertElement = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (!loading) onClose();
        }}
        aria-hidden="true"
      />

      {/* Alert Card */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid={testId}
        className={`relative z-10 w-full max-w-md rounded-xl border border-slate-800 bg-[#0c1222] p-6 shadow-2xl shadow-black/80 focus:outline-none transition-all ${className}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center ${iconColors[variant]}`}
          >
            {variant === 'danger' ? (
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <h2 id={titleId} className="text-base font-semibold text-slate-100">
              {title}
            </h2>
            <div id={descId} className="text-sm text-slate-400">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmBtnRef}
            variant={buttonVariants[variant]}
            size="sm"
            isLoading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(alertElement, document.body);
}

export const ConfirmationDialog = AlertDialog;
export type ConfirmationDialogProps = AlertDialogProps;
