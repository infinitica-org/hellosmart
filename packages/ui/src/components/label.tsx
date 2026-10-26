import React, { LabelHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean | undefined;
  optional?: boolean | undefined;
  children: ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required = false, optional = false, className = '', children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`flex items-center gap-1.5 text-xs font-semibold text-neutral-800 select-none ${className}`}
        {...props}
      >
        <span>{children}</span>
        {required && (
          <span className="text-primary font-bold" aria-hidden="true">
            *
          </span>
        )}
        {optional && (
          <span className="text-[11px] font-normal text-neutral-500 ml-1">
            (optional)
          </span>
        )}
      </label>
    );
  }
);
Label.displayName = 'Label';

