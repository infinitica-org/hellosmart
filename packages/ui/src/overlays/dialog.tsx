'use client';

import React, { useEffect, useRef, useState, forwardRef, ReactNode, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

export interface DialogProps {
  /** Controls open state. When undefined, dialog operates in uncontrolled mode. */
  open?: boolean | undefined;
  /** Initial open state when uncontrolled. Defaults to false. */
  defaultOpen?: boolean | undefined;
  /** Callback fired when dialog requests close. */
  onClose?: () => void;
  /** Callback fired when open state changes. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Optional clickable trigger element that automatically opens the dialog when clicked. */
  trigger?: ReactNode | undefined;
  /** Title displayed in the dialog header. */
  title?: ReactNode | undefined;
  /** Description or subtitle displayed in the dialog header. */
  description?: ReactNode | undefined;
  /** Footer content (buttons/actions) displayed at the bottom. */
  footer?: ReactNode | undefined;
  /** Dialog content body. */
  children?: ReactNode | undefined;
  /** Additional custom CSS class names for the dialog card. */
  className?: string | undefined;
  /** Size variant of the dialog card. */
  size?: ('sm' | 'md' | 'lg' | 'xl' | 'full') | undefined;
  /** Whether to show the top-right accessible close 'X' button. Defaults to true. */
  showCloseButton?: boolean | undefined;
  /** Whether clicking the backdrop dismisses the dialog. Defaults to true. */
  closeOnBackdropClick?: boolean | undefined;
  /** Whether pressing Escape dismisses the dialog. Defaults to true. */
  closeOnEscape?: boolean | undefined;
  /** Automated test identifier. */
  'data-testid'?: string | undefined;
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onClose,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  children,
  className = '',
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  'data-testid': testId,
}: DialogProps): React.JSX.Element | null {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

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
      if (closeOnEscape && e.key === 'Escape') {
        handleOpenChange(false);
      }
    };

    // Prevent background scroll while open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw] h-[90vh]',
  };

  const dialogElement = isOpen && mounted ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-chrome/50 transition-opacity animate-fade-in"
        onClick={() => {
          if (closeOnBackdropClick) {
            handleOpenChange(false);
          }
        }}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        className={`relative z-10 w-full ${sizeClasses[size]} rounded-md border border-card-border bg-white p-5 shadow-lg focus:outline-none transition-all animate-scale-in ${className}`}
      >
        {/* Accessible Top-Right Close Button */}
        {showCloseButton && (
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Close dialog"
            className="absolute right-4 top-4 rounded-sm p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger && (
        <span
          onClick={() => handleOpenChange(true)}
          className="inline-block cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenChange(true);
            }
          }}
        >
          {trigger}
        </span>
      )}
      {dialogElement && createPortal(dialogElement, document.body)}
    </>
  );
}

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`mb-4 pr-8 space-y-1.5 ${className}`} {...props}>
      {children}
    </div>
  )
);
DialogHeader.displayName = 'DialogHeader';

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className = '', children, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold tracking-tight text-neutral-900 ${className}`}
      {...props}
    >
      {children}
    </h2>
  )
);
DialogTitle.displayName = 'DialogTitle';

export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className = '', children, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-neutral-500 leading-relaxed font-light ${className}`} {...props}>
      {children}
    </p>
  )
);
DialogDescription.displayName = 'DialogDescription';

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`py-2 text-sm text-neutral-700 ${className}`} {...props}>
      {children}
    </div>
  )
);
DialogContent.displayName = 'DialogContent';

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
DialogFooter.displayName = 'DialogFooter';

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClose?: () => void;
}

export const DialogClose = forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ className = '', children, onClick, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`rounded-sm p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors ${className}`}
      {...props}
    >
      {children ?? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
    </button>
  )
);
DialogClose.displayName = 'DialogClose';
