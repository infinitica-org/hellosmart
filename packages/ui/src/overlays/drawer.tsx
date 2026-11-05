'use client';

import React, { useEffect, useState, forwardRef, ReactNode, HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export type DrawerPosition = 'left' | 'right' | 'bottom' | 'top';

export interface DrawerProps {
  /** Controls open state. When undefined, drawer operates in uncontrolled mode. */
  open?: boolean | undefined;
  /** Initial open state when uncontrolled. Defaults to false. */
  defaultOpen?: boolean | undefined;
  /** Callback fired when drawer requests close. */
  onClose?: () => void;
  /** Callback fired when open state changes. */
  onOpenChange?: ((open: boolean) => void) | undefined;
  /** Optional clickable trigger element that automatically opens the drawer when clicked. */
  trigger?: ReactNode | undefined;
  /** Title displayed in the drawer header. */
  title?: ReactNode | undefined;
  /** Description or subtitle displayed in the drawer header. */
  description?: ReactNode | undefined;
  /** Footer content (buttons/actions) displayed at the bottom. */
  footer?: ReactNode | undefined;
  /** Drawer content body. */
  children?: ReactNode | undefined;
  /** Position from which the drawer slides in. Defaults to 'right'. */
  position?: DrawerPosition | undefined;
  /** Additional custom CSS class names for the drawer container. */
  className?: string | undefined;
  /** Size variant of the drawer panel. */
  size?: ('sm' | 'md' | 'lg' | 'xl' | 'full') | undefined;
  /** Whether to show the top-right accessible close 'X' button. Defaults to true. */
  showCloseButton?: boolean | undefined;
  /** Whether clicking the backdrop dismisses the drawer. Defaults to true. */
  closeOnBackdropClick?: boolean | undefined;
  /** Whether pressing Escape dismisses the drawer. Defaults to true. */
  closeOnEscape?: boolean | undefined;
  /** Automated test identifier. */
  'data-testid'?: string | undefined;
}

export function Drawer({
  open: controlledOpen,
  defaultOpen = false,
  onClose,
  onOpenChange,
  trigger,
  title,
  description,
  footer,
  children,
  position = 'right',
  className = '',
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  'data-testid': testId,
}: DrawerProps): React.JSX.Element | null {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      onClose?.();
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        handleOpenChange(false);
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeOnEscape]);

  const positionClasses: Record<DrawerPosition, string> = {
    right: 'inset-y-0 right-0 h-full border-l border-neutral-200',
    left: 'inset-y-0 left-0 h-full border-r border-neutral-200',
    top: 'inset-x-0 top-0 w-full border-b border-neutral-200',
    bottom: 'inset-x-0 bottom-0 w-full border-t border-neutral-200',
  };

  const animationClasses: Record<DrawerPosition, string> = {
    right: 'animate-slide-in-right',
    left: 'animate-slide-in-left',
    top: 'animate-slide-in-top',
    bottom: 'animate-slide-in-bottom',
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

  const drawerElement = isOpen && mounted ? (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-chrome/50 transition-opacity animate-fade-in"
        onClick={() => {
          if (closeOnBackdropClick) {
            handleOpenChange(false);
          }
        }}
        aria-hidden="true"
      />

      {/* Drawer Container with Smooth Directional Slide-in Animation */}
      <div
        role="dialog"
        aria-modal="true"
        data-testid={testId}
        className={`fixed z-10 w-full bg-white text-neutral-900 shadow-lg flex flex-col justify-between overflow-y-auto ${positionClasses[position]} ${sizeClass} ${animationClasses[position]} ${className}`}
      >
        {/* Accessible Close Button */}
        {showCloseButton && (
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            aria-label="Close drawer"
            className="absolute right-4 top-4 rounded-sm p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 flex flex-col min-h-0">
          {(title || description) && (
            <DrawerHeader>
              {title && <DrawerTitle>{title}</DrawerTitle>}
              {description && <DrawerDescription>{description}</DrawerDescription>}
            </DrawerHeader>
          )}
          {children}
        </div>
        {footer && <DrawerFooter>{footer}</DrawerFooter>}
      </div>
    </div>
  ) : null;

  return (
    <>
      {trigger && (
        <span
          onClick={() => handleOpenChange(true)}
          className="inline-block cursor-pointer"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOpenChange(true);
            }
          }}
        >
          {trigger}
        </span>
      )}
      {drawerElement && createPortal(drawerElement, document.body)}
    </>
  );
}

export interface DrawerHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const DrawerHeader = forwardRef<HTMLDivElement, DrawerHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`p-6 pr-12 border-b border-neutral-200 space-y-1.5 flex-shrink-0 ${className}`}
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
    <p ref={ref} className={`text-sm text-neutral-500 leading-relaxed font-light ${className}`} {...props}>
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
      className={`p-6 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 gap-2 flex-shrink-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
DrawerFooter.displayName = 'DrawerFooter';

export interface DrawerCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClose?: () => void;
}

export const DrawerClose = forwardRef<HTMLButtonElement, DrawerCloseProps>(
  ({ className = '', children, onClick, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={`rounded-sm p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors ${className}`}
      {...props}
    >
      {children ?? <X className="w-5 h-5" />}
    </button>
  )
);
DrawerClose.displayName = 'DrawerClose';

export const Sheet = Drawer;
export type SheetProps = DrawerProps;
export const SheetHeader = DrawerHeader;
export const SheetTitle = DrawerTitle;
export const SheetDescription = DrawerDescription;
export const SheetContent = DrawerContent;
export const SheetFooter = DrawerFooter;
export const SheetClose = DrawerClose;
