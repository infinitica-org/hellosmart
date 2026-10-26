import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:pointer-events-none disabled:opacity-40 cursor-pointer';

    const variants: Record<string, string> = {
      default: 'bg-white text-black hover:bg-white/90 shadow',
      destructive:
        'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30',
      outline:
        'border border-white/20 bg-transparent hover:bg-white/10 text-white',
      secondary: 'bg-white/10 text-white hover:bg-white/20',
      ghost: 'hover:bg-white/10 text-white',
      link: 'text-white underline-offset-4 hover:underline',
      glass:
        'liquid-glass text-white hover:scale-[1.02] active:scale-[0.98]',
    };

    const sizes: Record<string, string> = {
      default: 'h-11 px-6 py-2.5',
      sm: 'h-8 rounded-full px-3 text-xs',
      lg: 'h-13 rounded-full px-8 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
