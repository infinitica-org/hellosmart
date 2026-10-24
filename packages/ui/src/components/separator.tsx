import React, { HTMLAttributes, forwardRef } from 'react';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical' | undefined;
  decorative?: boolean | undefined;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = 'horizontal', decorative = true, className = '', ...props }, ref) => {
    const isHorizontal = orientation === 'horizontal';

    return (
      <div
        ref={ref}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        className={`bg-slate-800/80 shrink-0 ${
          isHorizontal ? 'h-[1px] w-full my-4' : 'h-full w-[1px] mx-4'
        } ${className}`}
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';

