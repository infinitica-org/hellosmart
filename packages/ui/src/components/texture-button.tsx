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
// TextureButton Variant Definitions
// ============================================================================
export const buttonVariantsOuter = cva(
  'inline-flex items-center justify-center select-none font-medium text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-all duration-200 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'border border-black/20 bg-gradient-to-b from-neutral-700/80 via-neutral-900 to-black p-[1.5px] shadow-lg shadow-neutral-950/20 hover:shadow-xl hover:shadow-neutral-950/30',
        brand:
          'border border-primary/40 bg-gradient-to-b from-primary-300 via-primary to-primary-700 p-[1.5px] shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35',
        accent:
          'border border-indigo-400/40 bg-gradient-to-b from-indigo-300/90 to-indigo-600 p-[1.5px] shadow-md shadow-indigo-600/20',
        destructive:
          'border border-red-400/40 bg-gradient-to-b from-red-300/90 to-red-600 p-[1.5px] shadow-md shadow-red-600/20',
        secondary:
          'border border-neutral-300/70 bg-gradient-to-b from-neutral-100 to-neutral-200/90 p-[1.5px] shadow-xs',
        minimal:
          'group border border-neutral-300/80 bg-gradient-to-b from-white via-neutral-200/70 to-neutral-300/80 p-[1.5px] shadow-xs hover:border-neutral-400 transition-all duration-200',
        icon:
          'group rounded-full border border-black/15 bg-white/70 p-[1px] shadow-xs hover:bg-neutral-100 transition duration-200',
      },
      size: {
        sm: 'rounded-[8px]',
        default: 'rounded-[12px]',
        lg: 'rounded-[14px]',
        pill: 'rounded-full',
        pillLg: 'rounded-full',
        hero: 'rounded-full',
        icon: 'rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export const innerDivVariants = cva(
  'w-full h-full inline-flex items-center justify-center gap-2 select-none transition-all duration-200',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-b from-neutral-800 via-neutral-900 to-black text-white hover:from-neutral-700 hover:to-neutral-900 active:from-black active:to-black font-medium shadow-inner',
        brand:
          'bg-gradient-to-b from-primary via-primary-600 to-primary-700 text-white hover:from-primary-400 hover:to-primary-700 active:from-primary-600 active:to-primary-800 font-medium shadow-inner',
        accent:
          'bg-gradient-to-b from-indigo-400 to-indigo-600 text-white hover:from-indigo-300 hover:to-indigo-500 font-medium shadow-inner',
        destructive:
          'bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-400 hover:to-red-500 font-medium shadow-inner',
        secondary:
          'bg-gradient-to-b from-neutral-50 to-neutral-200/80 text-neutral-800 hover:from-white hover:to-neutral-100 font-medium',
        minimal:
          'bg-gradient-to-b from-white via-surface-subtle to-neutral-100/90 text-neutral-900 hover:from-white hover:to-neutral-100 active:from-neutral-100 active:to-neutral-200 font-medium',
        icon:
          'bg-gradient-to-b from-white to-neutral-100 text-neutral-700 rounded-full',
      },
      size: {
        sm: 'text-xs rounded-[6px] px-3.5 py-1.5',
        default: 'text-sm rounded-[10px] px-4.5 py-2',
        lg: 'text-base rounded-[12px] px-6 py-2.5',
        pill: 'text-sm rounded-full px-5 py-2',
        pillLg: 'text-sm sm:text-base rounded-full px-7 py-3',
        hero: 'text-base sm:text-lg rounded-full px-8 sm:px-9 py-3.5 sm:py-4 font-semibold',
        icon: 'rounded-full p-2',
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
