import React, { SelectHTMLAttributes, forwardRef } from 'react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean | undefined;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[] | undefined;
  hasError?: boolean | undefined;
  placeholder?: string | undefined;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, hasError = false, placeholder, className = '', disabled, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          className={`w-full appearance-none bg-slate-900/80 border text-slate-100 text-sm rounded-xl pl-3.5 pr-10 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${
            hasError
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/30'
              : 'border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/30'
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled className="bg-slate-900 text-slate-500">
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-slate-900 text-slate-100"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

