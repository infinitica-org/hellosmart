import React, { ButtonHTMLAttributes, AnchorHTMLAttributes, forwardRef, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'text'
  | 'link'
  | 'orange'
  | 'black'
  | 'white'
  | 'success';

export type ButtonColor = 'orange' | 'black' | 'white' | 'neutral' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonShape = 'default' | 'rounded' | 'pill' | 'full' | 'circle';

export interface ButtonBaseProps {
  variant?: ButtonVariant | undefined;
  color?: ButtonColor | undefined;
  size?: ButtonSize | undefined;
  shape?: ButtonShape | undefined;
  rounded?: boolean | 'full' | 'default' | undefined;
  pill?: boolean | undefined;
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

const baseVariantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/25 border border-primary/40 focus-visible:ring-primary',
  orange:
    'bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/25 border border-primary/40 focus-visible:ring-primary',
  black:
    'bg-neutral-900 hover:bg-black text-white shadow-md shadow-neutral-950/25 border border-neutral-800 focus-visible:ring-neutral-900',
  white:
    'bg-white hover:bg-neutral-50 text-neutral-900 shadow-xs border border-neutral-200 focus-visible:ring-neutral-400',
  secondary:
    'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 shadow-xs focus-visible:ring-neutral-400',
  outline:
    'bg-transparent hover:bg-neutral-100 text-neutral-700 border border-neutral-300 focus-visible:ring-neutral-400',
  ghost:
    'bg-transparent hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 border-transparent shadow-none focus-visible:ring-neutral-400',
  text:
    'bg-transparent hover:bg-neutral-100/80 text-neutral-700 hover:text-neutral-900 border-transparent shadow-none focus-visible:ring-neutral-400',
  link:
    'bg-transparent hover:underline text-primary hover:text-primary-hover p-0 h-auto min-h-0 border-transparent shadow-none focus-visible:ring-primary rounded-none',
  danger:
    'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-950/20 border border-rose-500/30 focus-visible:ring-rose-400',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/20 border border-emerald-500/30 focus-visible:ring-emerald-400',
};

function resolveButtonClasses(variant: ButtonVariant = 'primary', color?: ButtonColor): string {
  if (!color) {
    return baseVariantStyles[variant] || baseVariantStyles.primary;
  }

  if (color === 'orange') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-primary/10 text-primary border border-primary/50 focus-visible:ring-primary';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-primary/10 text-primary hover:text-primary-hover border-transparent shadow-none focus-visible:ring-primary';
    }
    if (variant === 'link') {
      return 'bg-transparent hover:underline text-primary hover:text-primary-hover p-0 h-auto min-h-0 border-transparent shadow-none focus-visible:ring-primary rounded-none';
    }
    return baseVariantStyles.orange;
  }

  if (color === 'black') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-neutral-100 text-neutral-900 border border-neutral-900 focus-visible:ring-neutral-900';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-neutral-100 text-neutral-900 hover:text-black border-transparent shadow-none focus-visible:ring-neutral-900';
    }
    if (variant === 'link') {
      return 'bg-transparent hover:underline text-neutral-900 hover:text-black p-0 h-auto min-h-0 border-transparent shadow-none focus-visible:ring-neutral-900 rounded-none';
    }
    return baseVariantStyles.black;
  }

  if (color === 'white') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-white/10 text-white border border-white/60 focus-visible:ring-white';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-white/10 text-white hover:text-white border-transparent shadow-none focus-visible:ring-white';
    }
    return baseVariantStyles.white;
  }

  if (color === 'danger') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-rose-50 text-rose-600 border border-rose-300 focus-visible:ring-rose-400';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-rose-50 text-rose-600 hover:text-rose-700 border-transparent shadow-none focus-visible:ring-rose-400';
    }
    return baseVariantStyles.danger;
  }

  if (color === 'success') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-emerald-50 text-emerald-600 border border-emerald-300 focus-visible:ring-emerald-400';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 border-transparent shadow-none focus-visible:ring-emerald-400';
    }
    return baseVariantStyles.success;
  }

  return baseVariantStyles[variant] || baseVariantStyles.primary;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-lg min-h-[32px]',
  md: 'text-sm px-4 py-2 gap-2 rounded-xl min-h-[40px]',
  lg: 'text-base px-5 py-2.5 gap-2.5 rounded-xl min-h-[48px]',
};

const pillSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3.5 py-1.5 gap-1.5 rounded-full min-h-[32px]',
  md: 'text-sm px-5 py-2 gap-2 rounded-full min-h-[40px]',
  lg: 'text-base px-6 py-2.5 gap-2.5 rounded-full min-h-[48px]',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2 py-1 gap-1 rounded-md min-h-[26px]',
  md: 'text-sm px-2.5 py-1.5 gap-1.5 rounded-lg min-h-[32px]',
  lg: 'text-base px-3 py-2 gap-2 rounded-lg min-h-[38px]',
};

const pillTextSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1 gap-1 rounded-full min-h-[26px]',
  md: 'text-sm px-3.5 py-1.5 gap-1.5 rounded-full min-h-[32px]',
  lg: 'text-base px-4 py-2 gap-2 rounded-full min-h-[38px]',
};

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = 'primary',
      color,
      size = 'md',
      shape = 'default',
      rounded,
      pill,
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
    const isRoundedFull =
      shape === 'full' ||
      shape === 'pill' ||
      shape === 'circle' ||
      rounded === true ||
      rounded === 'full' ||
      pill === true;

    const baseClasses =
      'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

    const appliedSizeStyles =
      variant === 'link'
        ? 'text-xs'
        : variant === 'text'
        ? (isRoundedFull ? pillTextSizeStyles[size] : textSizeStyles[size])
        : (isRoundedFull ? pillSizeStyles[size] : sizeStyles[size]);

    const variantClasses = resolveButtonClasses(variant, color);

    const combinedClasses = `${baseClasses} ${variantClasses} ${appliedSizeStyles} ${
      isRoundedFull ? 'rounded-full' : ''
    } ${fullWidth ? 'w-full' : ''} ${className}`.trim();


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

