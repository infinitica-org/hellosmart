import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
  leftIcon?: ReactNode | undefined;
  rightIcon?: ReactNode | undefined;
  onClear?: (() => void) | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ hasError = false, leftIcon, rightIcon, onClear, className = '', disabled, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-500">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          className={`w-full bg-slate-900/80 border text-slate-100 placeholder-slate-500 text-sm rounded-xl px-3.5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${
            hasError
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/30'
              : 'border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/30'
          } ${leftIcon ? 'pl-10' : ''} ${rightIcon || onClear ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {onClear && props.value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear input"
            className="absolute right-3 flex items-center justify-center w-5 h-5 rounded-full text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        {!onClear && rightIcon && (
          <div className="absolute right-3.5 flex items-center pointer-events-none text-slate-500">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

