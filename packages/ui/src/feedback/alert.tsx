'use client';

import React, { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

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
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle2 className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  error: <AlertCircle className="w-5 h-5" />,
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
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';
