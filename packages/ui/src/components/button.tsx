import React, { ButtonHTMLAttributes, AnchorHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonBaseProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  isLoading?: boolean | undefined;
  leftIcon?: ReactNode | undefined;
  rightIcon?: ReactNode | undefined;
  fullWidth?: boolean | undefined;
  href?: string | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
}

export type ButtonProps = ButtonBaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps>;

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 border border-primary/40 focus-visible:ring-primary',
  secondary:
    'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 shadow-xs focus-visible:ring-neutral-400',
  outline:
    'bg-transparent hover:bg-neutral-100 text-neutral-700 border border-neutral-300 focus-visible:ring-neutral-400',
  ghost:
    'bg-transparent hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 border-transparent focus-visible:ring-neutral-400',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/20 border border-rose-500/30 focus-visible:ring-rose-400',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg min-h-[32px]',
  md: 'text-sm px-4 py-2 gap-2 rounded-xl min-h-[40px]',
  lg: 'text-base px-5 py-2.5 gap-2.5 rounded-xl min-h-[48px]',
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      href,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

    const combinedClasses = `${baseClasses} ${variantStyles[variant]} ${sizeStyles[size]} ${
      fullWidth ? 'w-full' : ''
    } ${className}`.trim();

    const spinner = (
      <svg
        className="animate-spin -ml-0.5 w-4 h-4 text-current"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    const content = (
      <>
        {isLoading ? spinner : leftIcon}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </>
    );

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={combinedClasses}
          aria-disabled={disabled || isLoading}
          {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {content}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={(props as ButtonHTMLAttributes<HTMLButtonElement>).type || 'button'}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={combinedClasses}
        {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {content}
      </button>
    );
  }
);
Button.displayName = 'Button';

