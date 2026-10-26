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

const variantStyles: Record<AlertVariant, { container: string; icon: string; title: string }> = {
  info: {
    container: 'bg-primary/10 border-primary/25 text-neutral-800',
    icon: 'text-primary',
    title: 'text-primary',
  },
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: 'text-emerald-600',
    title: 'text-emerald-900',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-800',
    icon: 'text-amber-600',
    title: 'text-amber-900',
  },
  error: {
    container: 'bg-rose-50 border-rose-200 text-rose-800',
    icon: 'text-rose-600',
    title: 'text-rose-900',
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
        className={`relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm text-xs leading-relaxed ${cfg.container} ${className}`}
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
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
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
