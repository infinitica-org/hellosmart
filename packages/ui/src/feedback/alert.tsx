'use client';

import React, { forwardRef, HTMLAttributes, ReactNode } from 'react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant | undefined;
  title?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  onClose?: (() => void) | undefined;
  children?: ReactNode | undefined;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string; title: string; closeBtn: string }> = {
  info: {
    container: 'bg-info-muted border-info-border text-info-foreground',
    icon: 'text-nav-accent',
    title: 'text-nav',
    closeBtn: 'text-info-foreground/60 hover:text-info-foreground hover:bg-info-foreground/10',
  },
  success: {
    container: 'bg-success-muted border-success-border text-success-foreground',
    icon: 'text-success',
    title: 'text-success-foreground',
    closeBtn: 'text-success/70 hover:text-success-foreground hover:bg-success/10',
  },
  warning: {
    container: 'bg-warning-muted border-warning-border text-warning-foreground',
    icon: 'text-warning',
    title: 'text-warning-foreground',
    closeBtn: 'text-warning-foreground/60 hover:text-warning-foreground hover:bg-warning-foreground/10',
  },
  error: {
    container: 'bg-danger-muted border-danger-border text-danger-foreground',
    icon: 'text-danger',
    title: 'text-danger-foreground',
    closeBtn: 'text-danger/70 hover:text-danger-foreground hover:bg-danger/10',
  },
};

const defaultIcons: Record<AlertVariant, React.JSX.Element> = {
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, icon, onClose, className = '', children, ...props }, ref) => {
    const cfg = variantStyles[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={`relative flex items-start gap-3 p-3 rounded-sm border text-[13px] leading-relaxed ${cfg.container} ${className}`}
        {...props}
      >
        <span className={`shrink-0 mt-0.5 ${cfg.icon}`}>{icon || defaultIcons[variant]}</span>

        <div className="flex-1 min-w-0">
          {title && <h5 className={`font-semibold text-sm mb-1 ${cfg.title}`}>{title}</h5>}
          {children}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close alert"
            className={`p-1 -mr-1 -mt-0.5 rounded-md transition-colors cursor-pointer shrink-0 ${cfg.closeBtn}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';
