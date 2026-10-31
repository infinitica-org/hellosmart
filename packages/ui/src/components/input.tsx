import React, { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';

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
  sm: 'text-xs py-1 px-2.5 rounded-sm',
  md: 'text-[13px] py-1.5 px-3 rounded-sm',
  lg: 'text-sm py-2 px-3.5 rounded-md',
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
          className={`w-full bg-white border text-foreground placeholder-[#8a95a3] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${
 sizeStyles[size]
 } ${
            hasError
              ? 'border-[#d64545] focus:border-[#d64545] focus:ring-[#d64545]/15'
              : 'border-[#d8dee6] hover:border-[#c3ccd6] focus:border-nav-accent focus:ring-nav-accent/20'
          } ${leftIcon ? 'pl-9' : ''} ${rightIcon || onClear || isLoading ? 'pr-9' : ''} ${className}`}
          {...props}
        />
        {isLoading ? (
          <div className="absolute right-3 flex items-center pointer-events-none">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : onClear && props.value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear input"
            className="absolute right-2.5 flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
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

