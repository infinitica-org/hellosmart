import React, { forwardRef, ReactNode } from 'react';
import { Button, ButtonProps, ButtonSize } from './button';

export interface IconButtonProps extends Omit<ButtonProps, 'leftIcon' | 'rightIcon' | 'fullWidth' | 'children'> {
  'aria-label': string;
  icon: ReactNode;
}

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-xl',
  lg: 'w-12 h-12 rounded-xl',
};

export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(
  ({ 'aria-label': ariaLabel, icon, size = 'md', className = '', ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size={size}
        aria-label={ariaLabel}
        className={`p-0 ${iconSizeStyles[size]} ${className}`}
        {...props}
      >
        {icon}
      </Button>
    );
  }
);
IconButton.displayName = 'IconButton';

