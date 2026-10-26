import * as React from 'react';
import { cn } from '@/lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'glass';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'border-transparent bg-white/20 text-white',
    secondary: 'border-transparent bg-white/10 text-slate-300',
    destructive: 'border-red-500/30 bg-red-500/15 text-red-300',
    outline: 'border-white/20 text-slate-300',
    glass: 'border border-white/10 bg-white/[0.04] backdrop-blur-md text-slate-200',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors font-mono',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
