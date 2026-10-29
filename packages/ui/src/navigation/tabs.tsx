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
      pills: 'bg-[#f4f6f8] p-0.5 rounded-sm border border-[#d8dee6] gap-0.5',
      segmented: 'bg-[#f4f6f8] p-0.5 rounded-sm border border-[#d8dee6] gap-0.5',
      line: 'border-b border-[#d8dee6] gap-5',
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
      'inline-flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm font-medium transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 select-none cursor-pointer';

    const lineStyles = isSelected
      ? 'border-b-2 border-nav-accent text-nav pb-2.5 -mb-px font-semibold'
      : 'text-[#5b6775] hover:text-nav border-b-2 border-transparent pb-2.5 -mb-px font-medium';

    const pillStyles = isSelected
      ? 'bg-nav text-white rounded-sm px-3 py-1.5 font-medium'
      : 'text-[#5b6775] hover:text-nav px-3 py-1.5 rounded-sm hover:bg-white font-medium';

    const segmentedStyles = isSelected
      ? 'bg-white text-nav rounded-sm px-3 py-1.5 border border-[#d8dee6] font-semibold'
      : 'text-[#5b6775] hover:text-nav px-3 py-1.5 rounded-sm hover:bg-white border border-transparent font-medium';

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