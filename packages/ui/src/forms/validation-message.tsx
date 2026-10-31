import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export interface ValidationMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  type?: 'error' | 'warning' | 'success' | 'info' | undefined;
  children: ReactNode;
}

const typeStyles = {
  error: 'text-danger',
  warning: 'text-warning',
  success: 'text-success',
  info: 'text-info',
};

const typeIcons = {
  error: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  success: <CheckCircle className="w-3.5 h-3.5 shrink-0" />,
  info: <Info className="w-3.5 h-3.5 shrink-0" />,
};

export const ValidationMessage = forwardRef<HTMLParagraphElement, ValidationMessageProps>(
  ({ type = 'error', className = '', children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        role={type === 'error' ? 'alert' : 'status'}
        className={`text-xs font-medium flex items-center gap-1.5 mt-1 ${typeStyles[type]} ${className}`}
        {...props}
      >
        {typeIcons[type]}
        <span>{children}</span>
      </p>
    );
  }
);
ValidationMessage.displayName = 'ValidationMessage';

