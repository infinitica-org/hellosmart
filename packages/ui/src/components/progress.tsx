import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

export type ProgressVariant = 'primary' | 'success' | 'warning' | 'danger';
export type ProgressSize = 'sm' | 'md' | 'lg';

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number | undefined;
  variant?: ProgressVariant | undefined;
  size?: ProgressSize | undefined;
  label?: ReactNode | undefined;
  showValue?: boolean | undefined;
}

const variantStyles: Record<ProgressVariant, string> = {
  primary: 'bg-indigo-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
};

const sizeStyles: Record<ProgressSize, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      value,
      max = 100,
      variant = 'primary',
      size = 'md',
      label,
      showValue = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max(Math.round((value / max) * 100), 0), 100);

    return (
      <div ref={ref} className={`w-full flex flex-col space-y-1.5 ${className}`} {...props}>
        {(label || showValue) && (
          <div className="flex justify-between items-center text-xs font-medium text-slate-300">
            {label && <span>{label}</span>}
            {showValue && <span className="font-mono text-slate-400">{percentage}%</span>}
          </div>
        )}

        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={`w-full bg-slate-800 rounded-full overflow-hidden ${sizeStyles[size]}`}
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${variantStyles[variant]}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  }
);
Progress.displayName = 'Progress';

export const ProgressBar = Progress;
export type ProgressBarProps = ProgressProps;

