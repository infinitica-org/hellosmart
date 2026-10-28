'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  forwardRef,
  useEffect,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';

/* ---------------------------------- Context --------------------------------- */

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: 'line' | 'pills' | 'segmented';
  fitted: boolean;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

/* ----------------------------------- Tabs ----------------------------------- */

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  variant?: 'line' | 'pills' | 'segmented';
  fitted?: boolean;
  children: ReactNode;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      defaultValue,
      value: controlledValue,
      onValueChange,
      variant = 'line',
      fitted = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? '');
    const isControlled = controlledValue !== undefined;
    const activeValue = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = (val: string) => {
      if (!isControlled) {
        setUncontrolledValue(val);
      }
      onValueChange?.(val);
    };

    return (
      <TabsContext.Provider
        value={{ value: activeValue, onValueChange: handleValueChange, variant, fitted }}
      >
        <div ref={ref} className={`w-full ${className}`} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

/* --------------------------------- TabsList --------------------------------- */

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className = '', children, ...props }, ref) => {
    const { variant, fitted } = useTabs();
    const listRef = useRef<HTMLDivElement>(null);

    const variantStyles = {
      pills: 'bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/80 gap-1',
      segmented: 'bg-neutral-100 p-1 rounded-xl border border-neutral-200 gap-1 shadow-2xs',
      line: 'border-b border-neutral-200 gap-6',
    }[variant];

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const tabs = Array.from(
        listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') || []
      );
      const currentIndex = tabs.findIndex((tab) => tab === document.activeElement);

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (currentIndex + 1) % tabs.length;
        tabs[next]?.focus();
        tabs[next]?.click();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (currentIndex - 1 + tabs.length) % tabs.length;
        tabs[prev]?.focus();
        tabs[prev]?.click();
      }
    };

    return (
      <div
        ref={(node) => {
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="tablist"
        onKeyDown={handleKeyDown}
        className={`flex items-center overflow-x-auto no-scrollbar ${
          fitted ? 'w-full [&>*]:flex-1' : ''
        } ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

/* -------------------------------- TabsTrigger ------------------------------- */

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, icon, badge, className = '', disabled, ...props }, ref) => {
    const { value: activeValue, onValueChange, variant, fitted } = useTabs();
    const isSelected = activeValue === value;

    const baseStyles =
      'inline-flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer';

    const lineStyles = isSelected
      ? 'border-b-2 border-primary text-primary pb-2.5 -mb-px font-medium'
      : 'text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent pb-2.5 -mb-px font-medium';

    const pillStyles = isSelected
      ? 'bg-primary text-white rounded-lg px-3.5 py-1.5 shadow-xs font-medium'
      : 'text-neutral-600 hover:text-neutral-900 px-3.5 py-1.5 rounded-lg hover:bg-neutral-200/60 font-medium';

    const segmentedStyles = isSelected
      ? 'bg-white text-neutral-900 rounded-lg px-3.5 py-1.5 shadow-xs border border-neutral-200/80 font-medium'
      : 'text-neutral-600 hover:text-neutral-900 px-3.5 py-1.5 rounded-lg hover:bg-neutral-200/40 border border-transparent font-medium';

    const styleVariant =
      variant === 'segmented'
        ? segmentedStyles
        : variant === 'pills'
        ? pillStyles
        : lineStyles;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        disabled={disabled}
        onClick={() => onValueChange(value)}
        className={`${baseStyles} ${fitted ? 'justify-center text-center' : ''} ${styleVariant} ${className}`}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
        {badge && <span className="shrink-0">{badge}</span>}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

/* ------------------------------- TabsContent -------------------------------- */

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, children, className = '', ...props }, ref) => {
    const { value: activeValue } = useTabs();
    const isSelected = activeValue === value;

    if (!isSelected) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        tabIndex={0}
        className={`focus-visible:outline-none animate-fade-in hs-tab-content-animate ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';