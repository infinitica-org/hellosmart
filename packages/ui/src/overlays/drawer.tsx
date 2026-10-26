'use client';

import React, { useEffect, useState, forwardRef, ReactNode, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';

export type DrawerPosition = 'left' | 'right' | 'bottom' | 'top';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: DrawerPosition | undefined;
  className?: string | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | undefined;
}

export function Drawer({
  open,
  onClose,
  children,
  position = 'right',
  className = '',
  size = 'md',
}: DrawerProps): React.JSX.Element | null {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const positionClasses: Record<DrawerPosition, string> = {
    right: 'inset-y-0 right-0 h-full border-l border-neutral-200',
    left: 'inset-y-0 left-0 h-full border-r border-neutral-200',
    top: 'inset-x-0 top-0 w-full border-b border-neutral-200',
    bottom: 'inset-x-0 bottom-0 w-full border-t border-neutral-200',
  };

  const horizontalSizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };

  const verticalSizeClasses = {
    sm: 'max-h-60',
    md: 'max-h-96',
    lg: 'max-h-[70vh]',
    xl: 'max-h-[85vh]',
    full: 'max-h-full',
  };

  const sizeClass =
    position === 'left' || position === 'right'
      ? horizontalSizeClasses[size]
      : verticalSizeClasses[size];

  const drawerElement = (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed z-10 w-full bg-white text-neutral-900 shadow-2xl flex flex-col justify-between overflow-y-auto animate-fade-in ${positionClasses[position]} ${sizeClass} ${className}`}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(drawerElement, document.body);
}

export interface DrawerHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DrawerHeader = forwardRef<HTMLDivElement, DrawerHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`p-6 border-b border-neutral-200 space-y-1.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
DrawerHeader.displayName = 'DrawerHeader';

export interface DrawerTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const DrawerTitle = forwardRef<HTMLHeadingElement, DrawerTitleProps>(
  ({ className = '', children, ...props }, ref) => (
    <h2
      ref={ref}
      className={`text-lg font-semibold tracking-tight text-neutral-900 ${className}`}
      {...props}
    >
      {children}
    </h2>
  )
);
DrawerTitle.displayName = 'DrawerTitle';

export interface DrawerDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const DrawerDescription = forwardRef<HTMLParagraphElement, DrawerDescriptionProps>(
  ({ className = '', children, ...props }, ref) => (
    <p ref={ref} className={`text-sm text-neutral-500 ${className}`} {...props}>
      {children}
    </p>
  )
);
DrawerDescription.displayName = 'DrawerDescription';

export interface DrawerContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DrawerContent = forwardRef<HTMLDivElement, DrawerContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`p-6 flex-1 overflow-y-auto text-neutral-700 ${className}`} {...props}>
      {children}
    </div>
  )
);
DrawerContent.displayName = 'DrawerContent';

export interface DrawerFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DrawerFooter = forwardRef<HTMLDivElement, DrawerFooterProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`p-6 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
DrawerFooter.displayName = 'DrawerFooter';

export const Sheet = Drawer;
export type SheetProps = DrawerProps;
export const SheetHeader = DrawerHeader;
export const SheetTitle = DrawerTitle;
export const SheetDescription = DrawerDescription;
export const SheetContent = DrawerContent;
export const SheetFooter = DrawerFooter;
