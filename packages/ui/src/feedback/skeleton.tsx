import React, { HTMLAttributes, forwardRef } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'circular' | 'text' | undefined;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = 'rectangular', className = '', ...props }, ref) => {
    const variantStyles = {
      rectangular: 'rounded-md',
      circular: 'rounded-full',
      text: 'rounded-md h-4 w-full',
    };

    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`animate-pulse bg-neutral-200/80 ${variantStyles[variant]} ${className}`}
        {...props}
      />
    );
  }
);
Skeleton.displayName = 'Skeleton';

