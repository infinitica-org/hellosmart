import React, { TextareaHTMLAttributes, forwardRef } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ hasError = false, className = '', disabled, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : undefined}
        className={`w-full bg-slate-900/80 border text-slate-100 placeholder-slate-500 text-sm rounded-xl px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${
          hasError
            ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/30'
            : 'border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/30'
        } ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

