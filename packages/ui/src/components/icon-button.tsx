import React, { forwardRef, ReactNode } from 'react';
import { Button, ButtonProps, ButtonSize } from './button';

export type IconButtonShape = 'circle' | 'rounded' | 'full';

export interface IconButtonProps
  extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'fullWidth' | 'children' | 'shape'> {
  'aria-label': string;
  icon: ReactNode;
  shape?: IconButtonShape | undefined;
}

const roundedSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8 rounded-sm',
  md: 'w-10 h-10 rounded-md',
  lg: 'w-12 h-12 rounded-md',
};

const circleSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8 rounded-full',
  md: 'w-10 h-10 rounded-full',
  lg: 'w-12 h-12 rounded-full',
};

export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(
  (
    {
      'aria-label': ariaLabel,
      icon,
      size = 'md',
      shape = 'rounded',
      rounded,
      className = '',
      ...props
    },
    ref
  ) => {
    const isCircle =
      shape === 'circle' || shape === 'full' || rounded === true || rounded === 'full';
    const sizeStyle = isCircle ? circleSizeStyles[size] : roundedSizeStyles[size];

    return (
      <Button
        ref={ref}
        size={size}
        shape={isCircle ? 'full' : 'default'}
        aria-label={ariaLabel}
        className={`p-0 shrink-0 ${sizeStyle} ${className}`}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';
