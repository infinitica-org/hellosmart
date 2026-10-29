import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize | undefined;
  hasError?: boolean | undefined;
  isLoading?: boolean | undefined;
  leftIcon?: ReactNode | undefined;
  rightIcon?: ReactNode | undefined;
  onClear?: (() => void) | undefined;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'text-xs py-1.5 px-3 rounded-md',
  md: 'text-sm py-2 px-3.5 rounded-lg',
  lg: 'text-base py-2.5 px-4 rounded-xl',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      hasError = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      onClear,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-neutral-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled || isLoading}
          aria-invalid={hasError ? 'true' : undefined}
          className={`w-full bg-white border text-neutral-900 placeholder-neutral-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${
            sizeStyles[size]
          } ${
            hasError
              ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20'
              : 'border-neutral-200/90 hover:border-neutral-300 focus:border-primary focus:ring-primary/20'
          } ${leftIcon ? 'pl-9' : ''} ${rightIcon || onClear || isLoading ? 'pr-9' : ''} ${className}`}
          {...props}
        />
        {isLoading ? (
          <div className="absolute right-3 flex items-center pointer-events-none">
            <svg
              className="w-4 h-4 text-primary animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : onClear && props.value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear input"
            className="absolute right-2.5 flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        ) : rightIcon ? (
          <div className="absolute right-3 flex items-center text-neutral-400">
            {rightIcon}
          </div>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

