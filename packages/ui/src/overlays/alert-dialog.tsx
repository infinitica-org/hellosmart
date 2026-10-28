'use client';

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../components/button';

export interface AlertDialogProps {
  open?: boolean | undefined;
  onClose?: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  trigger?: ReactNode | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  variant?: ('danger' | 'warning' | 'primary') | undefined;
  loading?: boolean | undefined;
  className?: string | undefined;
  'data-testid'?: string | undefined;
}

export function AlertDialog({
  open: controlledOpen,
  onClose,
  onConfirm,
  title,
  description,
  trigger,
  onOpenChange,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  className = '',
  'data-testid': testId,
}: AlertDialogProps): React.JSX.Element | null {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = React.useId();
  const descId = React.useId();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      onClose?.();
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        handleOpenChange(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading]);

  const iconColors = {
    danger: 'bg-rose-50 text-rose-600 border-rose-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    primary: 'bg-primary/10 text-primary border-primary/30',
  };

  const buttonVariants = {
    danger: 'danger' as const,
    warning: 'primary' as const,
    primary: 'primary' as const,
  };

  const alertElement = isOpen && mounted ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity"
        onClick={() => {
          if (!loading) handleOpenChange(false);
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
        className={`relative z-10 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl focus:outline-none transition-all ${className}`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${iconColors[variant]}`}
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
            ) : variant === 'warning' ? (
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
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <h2 id={titleId} className="text-base font-semibold text-neutral-900 leading-snug">
              {title}
            </h2>
            <div id={descId} className="text-sm text-neutral-600 leading-relaxed font-light">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
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
  ) : null;

  return (
    <>
      {trigger && (
        <span
          onClick={() => handleOpenChange(true)}
          className="inline-block cursor-pointer"
        >
          {trigger}
        </span>
      )}
      {alertElement && createPortal(alertElement, document.body)}
    </>
  );
}

export const ConfirmationDialog = AlertDialog;
export type ConfirmationDialogProps = AlertDialogProps;
