'use client';

import React, { useState, useRef, forwardRef, ReactNode, HTMLAttributes } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  content: ReactNode;
  position?: TooltipPosition | undefined;
  delayMs?: number | undefined;
  children: ReactNode;
}

export const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ content, position = 'top', delayMs = 150, className = '', children, ...props }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tooltipId = React.useId();

    const showTooltip = () => {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delayMs);
    };

    const hideTooltip = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsVisible(false);
    };

    const positionClasses: Record<TooltipPosition, string> = {
      top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
      bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
      left: 'right-full top-1/2 -translate-y-1/2 mr-2',
      right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    return (
      <div
        ref={ref}
        className="relative inline-flex items-center"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        aria-describedby={isVisible ? tooltipId : undefined}
        {...props}
      >
        {children}

        {isVisible && (
          <div
            id={tooltipId}
            role="tooltip"
            className={`absolute z-50 whitespace-nowrap rounded-lg bg-slate-900 border border-slate-700/80 px-2.5 py-1 text-xs font-medium text-slate-200 shadow-xl shadow-black/50 pointer-events-none animate-fade-in ${positionClasses[position]} ${className}`}
          >
            {content}
          </div>
        )}
      </div>
    );
  }
);
Tooltip.displayName = 'Tooltip';

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  trigger: ReactNode;
  content: ReactNode;
  align?: ('left' | 'right' | 'center') | undefined;
  position?: TooltipPosition | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export const Popover = forwardRef<HTMLDivElement, PopoverProps>(
  (
    {
      trigger,
      content,
      align = 'center',
      position = 'bottom',
      open: controlledOpen,
      onOpenChange,
      className = '',
      ...props
    },
    ref
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

    const setOpen = (val: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(val);
      }
      onOpenChange?.(val);
    };

    React.useEffect(() => {
      if (!isOpen) return;
      const handleClick = (e: MouseEvent) => {
        if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('mousedown', handleClick);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClick);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen]);

    const positionClasses: Record<TooltipPosition, string> = {
      top: 'bottom-full mb-2',
      bottom: 'top-full mt-2',
      left: 'right-full mr-2',
      right: 'left-full ml-2',
    };

    const alignClasses =
      align === 'left' ? 'left-0' : align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2';

    return (
      <div
        ref={(node) => {
          popoverRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="relative inline-block"
        {...props}
      >
        <div
          role="button"
          tabIndex={0}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!isOpen);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOpen(!isOpen);
            }
          }}
          className="cursor-pointer inline-flex focus:outline-none"
        >
          {trigger}
        </div>
        {isOpen && (
          <div
            role="dialog"
            aria-modal="false"
            className={`absolute z-50 w-max min-w-[14rem] max-w-sm rounded-xl border border-slate-800 bg-[#0c1222] p-4 shadow-2xl shadow-black/80 animate-fade-in ${positionClasses[position]} ${alignClasses} ${className}`}
          >
            {content}
          </div>
        )}
      </div>
    );
  }
);
Popover.displayName = 'Popover';

export interface HoverCardProps extends TooltipProps {}
export const HoverCard = forwardRef<HTMLDivElement, HoverCardProps>(
  ({ className = '', ...props }, ref) => (
    <Tooltip ref={ref} delayMs={200} className={`p-4 whitespace-normal max-w-xs ${className}`} {...props} />
  )
);
HoverCard.displayName = 'HoverCard';
