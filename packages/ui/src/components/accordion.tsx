'use client';

import React, { createContext, useContext, useState, forwardRef, ReactNode, HTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionContextType {
  openItems: string[];
  toggleItem: (value: string) => void;
  type: 'single' | 'multiple';
}

const AccordionContext = createContext<AccordionContextType | undefined>(undefined);

export interface AccordionProps extends HTMLAttributes<HTMLDivElement> {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  children: ReactNode;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  (
    {
      type = 'single',
      defaultValue,
      value: controlledValue,
      onValueChange,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isControlled = controlledValue !== undefined;
    const initialOpen = defaultValue
      ? Array.isArray(defaultValue)
        ? defaultValue
        : [defaultValue]
      : [];
    const [internalOpen, setInternalOpen] = useState<string[]>(initialOpen);

    const openItems = isControlled
      ? Array.isArray(controlledValue)
        ? controlledValue
        : controlledValue
        ? [controlledValue]
        : []
      : internalOpen;

    const toggleItem = (val: string) => {
      let next: string[];
      if (type === 'single') {
        next = openItems.includes(val) ? [] : [val];
      } else {
        next = openItems.includes(val)
          ? openItems.filter((i) => i !== val)
          : [...openItems, val];
      }
      if (!isControlled) {
        setInternalOpen(next);
      }
      onValueChange?.(type === 'single' ? (next[0] || '') : next);
    };

    return (
      <AccordionContext.Provider value={{ openItems, toggleItem, type }}>
        <div ref={ref} className={`divide-y divide-neutral-200 border-y border-neutral-200 ${className}`} {...props}>
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = 'Accordion';

interface AccordionItemContextType {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextType | undefined>(undefined);

export interface AccordionItemProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  children: ReactNode;
}

export const AccordionItem = forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ value, className = '', children, ...props }, ref) => {
    const context = useContext(AccordionContext);
    const isOpen = context?.openItems.includes(value) ?? false;

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div ref={ref} className={`py-1 ${className}`} {...props}>
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = 'AccordionItem';

export interface AccordionTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export const AccordionTrigger = forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className = '', children, ...props }, ref) => {
    const itemContext = useContext(AccordionItemContext);
    const accordionContext = useContext(AccordionContext);

    const isOpen = itemContext?.isOpen ?? false;

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => itemContext && accordionContext?.toggleItem(itemContext.value)}
        aria-expanded={isOpen}
        className={`flex w-full items-center justify-between py-3 font-medium text-neutral-900 transition-all hover:text-primary-600 ${className}`}
        {...props}
      >
        <span>{children}</span>
        <ChevronDown className={"h-4 w-4 shrink-0 transition-transform duration-200 "} />
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

export interface AccordionContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const AccordionContent = forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className = '', children, ...props }, ref) => {
    const itemContext = useContext(AccordionItemContext);
    if (!itemContext?.isOpen) return null;

    return (
      <div
        ref={ref}
        className={`overflow-hidden pb-3 text-sm text-neutral-600 transition-all animate-fade-in ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';

