'use client';

import * as React from 'react';
import { cn } from '../utils/cn';

// ============================================================================
// Lightweight Zero-Dependency CVA Implementation
// ============================================================================
type VariantRecord = Record<string, Record<string, string>>;

interface CvaConfig<T extends VariantRecord> {
  variants: T;
  defaultVariants?: { [K in keyof T]?: keyof T[K] };
}

function cva<T extends VariantRecord>(base: string, config: CvaConfig<T>) {
  return (props?: { [K in keyof T]?: keyof T[K] } & { className?: string }): string => {
    const classes: string[] = [base];
    if (config.variants) {
      for (const [key, variantOptions] of Object.entries(config.variants)) {
        const selected = props?.[key] ?? config.defaultVariants?.[key];
        const val = selected ? variantOptions[selected as string] : undefined;
        if (val) {
          classes.push(val);
        }
      }
    }
    if (props?.className) classes.push(props.className);
    return classes.filter(Boolean).join(' ');
  };
}

// ============================================================================
// Lightweight Zero-Dependency Radix Slot Implementation
// ============================================================================
export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>(
  ({ children, className, ...props }, ref) => {
    if (React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        ...props,
        className: cn(className, child.props.className),
        // @ts-expect-error forward ref
        ref,
      });
    }
    return null;
  }
);
Slot.displayName = 'Slot';

// ============================================================================
// TextureButton Variant Definitions (Design Token & CSS Variable Calling)
// ============================================================================
export const buttonVariantsOuter = cva(
  'inline-flex items-center justify-center select-none font-medium text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all duration-200 active:scale-[var(--tb-scale-active,0.98)] p-[var(--tb-border-width,1.5px)]',
  {
    variants: {
      variant: {
        primary: 'tb-outer-primary',
        black: 'tb-outer-black',
        dark: 'tb-outer-dark',
        brand: 'tb-outer-brand',
        orange: 'tb-outer-orange',
        accent: 'tb-outer-accent',
        destructive: 'tb-outer-destructive',
        secondary: 'tb-outer-secondary',
        minimal: 'tb-outer-minimal',
        white: 'tb-outer-white',
        icon: 'tb-outer-icon p-[var(--tb-border-width-icon,1px)]',
      },
      size: {
        sm: 'rounded-[var(--tb-radius-sm,var(--hs-radius-md,0.5rem))]',
        default: 'rounded-[var(--tb-radius-default,var(--hs-radius-lg,0.75rem))]',
        lg: 'rounded-[var(--tb-radius-lg,0.875rem)]',
        pill: 'rounded-[var(--tb-radius-pill,var(--hs-radius-full,9999px))]',
        pillLg: 'rounded-[var(--tb-radius-pill,var(--hs-radius-full,9999px))]',
        hero: 'rounded-[var(--tb-radius-pill,var(--hs-radius-full,9999px))]',
        icon: 'rounded-[var(--tb-radius-pill,var(--hs-radius-full,9999px))]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export const innerDivVariants = cva(
  'w-full h-full inline-flex items-center justify-center gap-2 select-none transition-all duration-200 font-medium',
  {
    variants: {
      variant: {
        primary: 'tb-inner-primary',
        black: 'tb-inner-black',
        dark: 'tb-inner-dark',
        brand: 'tb-inner-brand',
        orange: 'tb-inner-orange',
        accent: 'tb-inner-accent',
        destructive: 'tb-inner-destructive',
        secondary: 'tb-inner-secondary',
        minimal: 'tb-inner-minimal',
        white: 'tb-inner-white',
        icon: 'tb-inner-icon',
      },
      size: {
        sm: 'text-xs rounded-[var(--tb-inner-radius-sm,var(--hs-radius-sm,0.375rem))] px-[var(--tb-px-sm,0.875rem)] py-[var(--tb-py-sm,0.375rem)]',
        default: 'text-sm rounded-[var(--tb-inner-radius-default,0.625rem)] px-[var(--tb-px-default,1.125rem)] py-[var(--tb-py-default,0.5rem)]',
        lg: 'text-base rounded-[var(--tb-inner-radius-lg,var(--hs-radius-lg,0.75rem))] px-[var(--tb-px-lg,1.5rem)] py-[var(--tb-py-lg,0.625rem)]',
        pill: 'text-sm rounded-[var(--tb-inner-radius-pill,var(--hs-radius-full,9999px))] px-[var(--tb-px-pill,1.25rem)] py-[var(--tb-py-pill,0.5rem)]',
        pillLg: 'text-sm sm:text-base rounded-[var(--tb-inner-radius-pill,var(--hs-radius-full,9999px))] px-[var(--tb-px-pill-lg,1.75rem)] py-[var(--tb-py-pill-lg,0.75rem)]',
        hero: 'text-base sm:text-lg rounded-[var(--tb-inner-radius-pill,var(--hs-radius-full,9999px))] px-[var(--tb-px-hero,2rem)] sm:px-[var(--tb-px-hero-lg,2.25rem)] py-[var(--tb-py-hero,0.75rem)] sm:py-[var(--tb-py-hero-lg,0.875rem)] font-semibold',
        icon: 'rounded-[var(--tb-inner-radius-pill,var(--hs-radius-full,9999px))] p-[var(--tb-p-icon,0.5rem)]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface UnifiedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'brand'
    | 'secondary'
    | 'accent'
    | 'destructive'
    | 'minimal'
    | 'icon'
    | 'orange'
    | 'black'
    | 'dark'
    | 'white'
    | undefined;
  size?: 'default' | 'sm' | 'lg' | 'pill' | 'pillLg' | 'hero' | 'icon' | undefined;
  asChild?: boolean | undefined;
  href?: string | undefined;
  target?: string | undefined;
  rel?: string | undefined;
}

export const TextureButton = React.forwardRef<HTMLButtonElement, UnifiedButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'default',
      asChild = false,
      href,
      target,
      rel,
      className = '',
      ...props
    },
    ref
  ) => {
    const outerClass = cn(buttonVariantsOuter({ variant, size }), className);
    const innerClass = cn(innerDivVariants({ variant, size }));

    // 1. Direct href link support (Next.js Link or external anchor)
    if (href) {
      return (
        <a
          href={href}
          target={target}
          rel={rel ?? (target === '_blank' ? 'noopener noreferrer' : undefined)}
          className={outerClass}
        >
          <span className={innerClass}>{children}</span>
        </a>
      );
    }

    // 2. asChild delegation support
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
      return React.cloneElement(child, {
        ...props,
        className: cn(outerClass, child.props.className),
        // @ts-expect-error ref forwarding
        ref,
        children: <span className={innerClass}>{child.props.children}</span>,
      });
    }

    // 3. Standard button element
    return (
      <button
        type="button"
        className={outerClass}
        ref={ref}
        {...props}
      >
        <span className={innerClass}>{children}</span>
      </button>
    );
  }
);

TextureButton.displayName = 'TextureButton';
