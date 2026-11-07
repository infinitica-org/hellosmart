import React, { ButtonHTMLAttributes, AnchorHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

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
    'bg-primary hover:bg-primary-hover text-white border border-primary/30 shadow-none focus-visible:ring-nav-accent',
  orange:
    'bg-primary hover:bg-primary-hover text-white border border-primary/30 shadow-none focus-visible:ring-nav-accent',
  black:
    'bg-chrome hover:bg-chrome-hover text-white border border-chrome shadow-none focus-visible:ring-nav-accent',
  white:
    'bg-white hover:bg-canvas text-foreground border border-[#d8dee6] shadow-none focus-visible:ring-nav-accent',
  secondary:
    'bg-white hover:bg-canvas text-foreground border border-[#d8dee6] shadow-none focus-visible:ring-nav-accent',
  outline:
    'bg-white hover:bg-canvas text-foreground border border-[#d8dee6] focus-visible:ring-nav-accent',
  ghost:
    'bg-transparent hover:bg-canvas text-[#3d4754] hover:text-foreground border-transparent shadow-none focus-visible:ring-nav-accent',
  text:
    'bg-transparent hover:bg-canvas text-[#3d4754] hover:text-foreground border-transparent shadow-none focus-visible:ring-nav-accent',
  link:
    'bg-transparent hover:underline text-nav-accent hover:text-nav p-0 h-auto min-h-0 border-transparent shadow-none focus-visible:ring-nav-accent rounded-none',
  danger:
    'bg-danger hover:bg-danger-foreground text-white border border-danger/30 shadow-none focus-visible:ring-danger',
  success:
    'bg-success hover:bg-success-foreground text-white border border-success/30 shadow-none focus-visible:ring-success',
};

function resolveButtonClasses(variant: ButtonVariant = 'primary', color?: ButtonColor): string {
  if (!color) {
    return baseVariantStyles[variant] || baseVariantStyles.primary;
  }

  if (color === 'orange') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-primary/10 text-primary border border-primary/50 focus-visible:ring-nav-accent';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-primary/10 text-primary hover:text-primary-hover border-transparent shadow-none focus-visible:ring-nav-accent';
    }
    if (variant === 'link') {
      return 'bg-transparent hover:underline text-primary hover:text-primary-hover p-0 h-auto min-h-0 border-transparent shadow-none focus-visible:ring-nav-accent rounded-none';
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
      return 'bg-transparent hover:bg-danger-muted text-danger border border-danger-border focus-visible:ring-danger';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-danger-muted text-danger hover:text-danger-foreground border-transparent shadow-none focus-visible:ring-danger';
    }
    return baseVariantStyles.danger;
  }

  if (color === 'success') {
    if (variant === 'outline') {
      return 'bg-transparent hover:bg-success-muted text-success border border-success-border focus-visible:ring-success';
    }
    if (variant === 'ghost' || variant === 'text') {
      return 'bg-transparent hover:bg-success-muted text-success hover:text-success-foreground border-transparent shadow-none focus-visible:ring-success';
    }
    return baseVariantStyles.success;
  }

  return baseVariantStyles[variant] || baseVariantStyles.primary;
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2.5 py-1 gap-1.5 rounded-sm min-h-[28px]',
  md: 'text-[13px] px-3.5 py-1.5 gap-1.5 rounded-sm min-h-[32px]',
  lg: 'text-sm px-4 py-2 gap-2 rounded-md min-h-[40px]',
};

const pillSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3.5 py-1.5 gap-1.5 rounded-full min-h-[32px]',
  md: 'text-sm px-5 py-2 gap-2 rounded-full min-h-[40px]',
  lg: 'text-base px-6 py-2.5 gap-2.5 rounded-full min-h-[48px]',
};

const textSizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-2 py-1 gap-1 rounded-md min-h-[26px]',
  md: 'text-sm px-2.5 py-1.5 gap-1.5 rounded-sm min-h-[32px]',
  lg: 'text-base px-3 py-2 gap-2 rounded-sm min-h-[38px]',
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
      'inline-flex items-center justify-center font-medium tracking-[0.01em] transition-colors duration-100 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed';

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
      <Loader2 className="animate-spin -ml-0.5 w-4 h-4 text-current" aria-hidden="true" />
    );

    const content = (
      <>
        {isLoading ? spinner : leftIcon}
        <span className="whitespace-nowrap inline-flex items-center gap-1.5">{children}</span>
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

