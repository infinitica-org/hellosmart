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
        className={`w-full bg-white border text-foreground placeholder-[#8a95a3] text-[13px] rounded-sm px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white disabled:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed ${
 hasError
 ? 'border-[#d64545] focus:border-[#d64545] focus:ring-[#d64545]/15'
            : 'border-[#d8dee6] hover:border-[#c3ccd6] focus:border-nav-accent focus:ring-nav-accent/20'
        } ${className}`}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
