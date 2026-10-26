'use client';

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  forwardRef,
  ReactNode,
  HTMLAttributes,
  ButtonHTMLAttributes,
} from 'react';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: 'line' | 'pills';
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string | undefined;
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  variant?: ('line' | 'pills') | undefined;
  children: ReactNode;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      defaultValue,
      value: controlledValue,
      onValueChange,
      variant = 'line',
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
      <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange, variant }}>
        <div ref={ref} className={`w-full ${className}`} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className = '', children, ...props }, ref) => {
    const { variant } = useTabs();
    const listRef = useRef<HTMLDivElement>(null);

    const variantStyles =
      variant === 'pills'
        ? 'bg-neutral-100 p-1 rounded-xl border border-neutral-200'
        : 'border-b border-neutral-200 space-x-6';

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
        className={`flex items-center overflow-x-auto no-scrollbar ${variantStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
  icon?: ReactNode | undefined;
  badge?: ReactNode | undefined;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, children, icon, badge, className = '', disabled, ...props }, ref) => {
    const { value: activeValue, onValueChange, variant } = useTabs();
    const isSelected = activeValue === value;

    const baseStyles =
      'inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40';

    const lineStyles = isSelected
      ? 'border-b-2 border-primary text-primary pb-3 -mb-px font-semibold'
      : 'text-neutral-500 hover:text-neutral-900 border-b-2 border-transparent pb-3 -mb-px';

    const pillStyles = isSelected
      ? 'bg-primary text-white rounded-lg px-3 py-1.5 shadow-xs font-semibold'
      : 'text-neutral-600 hover:text-neutral-900 px-3 py-1.5 rounded-lg';

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isSelected}
        tabIndex={isSelected ? 0 : -1}
        disabled={disabled}
        onClick={() => onValueChange(value)}
        className={`${baseStyles} ${variant === 'pills' ? pillStyles : lineStyles} ${className}`}
        {...props}
      >
        {icon}
        <span>{children}</span>
        {badge}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, children, className = '', ...props }, ref) => {
    const { value: activeValue } = useTabs();
    if (activeValue !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        tabIndex={0}
        className={`mt-4 focus-visible:outline-none ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';

interface AccordionContextValue {
  openItems: string[];
  toggleItem: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  type?: ('single' | 'multiple') | undefined;
  defaultValue?: string | string[] | undefined;
  children: ReactNode;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ type = 'single', defaultValue, children, className = '', ...props }, ref) => {
    const [openItems, setOpenItems] = useState<string[]>(() => {
      if (!defaultValue) return [];
      return Array.isArray(defaultValue) ? defaultValue : [defaultValue];
    });

    const toggleItem = (val: string) => {
      setOpenItems((prev) => {
        if (type === 'single') {
          return prev.includes(val) ? [] : [val];
        }
        return prev.includes(val) ? prev.filter((i) => i !== val) : [...prev, val];
      });
    };

    return (
      <AccordionContext.Provider value={{ openItems, toggleItem }}>
        <div ref={ref} className={`divide-y divide-slate-800 rounded-xl border border-slate-800 ${className}`} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = 'Accordion';

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, children, className = '', ...props }, ref) => (
    <div ref={ref} data-value={value} className={`overflow-hidden ${className}`} {...props}>
      {children}
    </div>
  )
);
AccordionItem.displayName = 'AccordionItem';

export interface AccordionTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: ReactNode;
}

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ value, children, className = '', ...props }, ref) => {
    const context = useContext(AccordionContext);
    const isOpen = context?.openItems.includes(value);

    return (
      <button
        ref={ref}
        type="button"
        aria-expanded={isOpen}
        onClick={() => context?.toggleItem(value)}
        className={`flex w-full items-center justify-between py-4 px-5 text-sm font-medium text-slate-200 transition-colors hover:text-white ${className}`}
        {...props}
      >
        <span>{children}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

export interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ value, children, className = '', ...props }, ref) => {
    const context = useContext(AccordionContext);
    const isOpen = context?.openItems.includes(value);
    if (!isOpen) return null;

    return (
      <div ref={ref} className={`pb-4 px-5 text-sm text-slate-400 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';
