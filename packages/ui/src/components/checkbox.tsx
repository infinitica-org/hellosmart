'use client';

import React, { InputHTMLAttributes, forwardRef, useEffect, useRef, ReactNode } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode | undefined;
  description?: ReactNode | undefined;
  indeterminate?: boolean | undefined;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, indeterminate = false, className = '', disabled, id, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null);
    const resolvedRef = (ref || innerRef) as React.RefObject<HTMLInputElement>;
    const inputId = id || (label ? `cb-${String(label).toLowerCase().replace(/\s+/g, '-')}` : undefined);

    useEffect(() => {
      if (resolvedRef.current) {
        resolvedRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate, resolvedRef]);

    return (
      <div className={`flex items-start gap-3 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
        <div className="relative flex items-center h-5">
          <input
            ref={resolvedRef}
            id={inputId}
            type="checkbox"
            disabled={disabled}
            className="peer h-4 w-4 rounded border border-neutral-300 bg-white text-primary transition-colors focus:ring-2 focus:ring-nav-accent focus:ring-offset-2 focus:ring-offset-white checked:bg-primary checked:border-primary cursor-pointer disabled:cursor-not-allowed"
            {...props}
          />
        </div>
        {(label || description) && (
          <label htmlFor={inputId} className="flex flex-col cursor-pointer">
            {label && <span className="text-sm font-medium text-neutral-900">{label}</span>}
            {description && <span className="text-xs text-neutral-500 mt-0.5">{description}</span>}
          </label>
        )}
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  name?: string | undefined;
  children: ReactNode;
}

interface RadioGroupContextValue {
  name: string;
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value: controlledValue, defaultValue, onValueChange, name, children, className = '', ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
    const autoName = React.useId();
    const groupName = name || autoName;

    const isControlled = controlledValue !== undefined;
    const activeValue = isControlled ? controlledValue : uncontrolledValue;

    const handleValueChange = (val: string) => {
      if (!isControlled) {
        setUncontrolledValue(val);
      }
      onValueChange?.(val);
    };

    return (
      <RadioGroupContext.Provider value={{ name: groupName, value: activeValue, onValueChange: handleValueChange }}>
        <div ref={ref} role="radiogroup" className={`space-y-2 ${className}`} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
  label?: ReactNode | undefined;
  description?: ReactNode | undefined;
}

export const RadioGroupItem = forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ value, label, description, className = '', disabled, id, ...props }, ref) => {
    const context = React.useContext(RadioGroupContext);
    const inputId = id || (label ? `radio-${String(label).toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const isChecked = context?.value === value;

    return (
      <div className={`flex items-start gap-3 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}>
        <div className="relative flex items-center h-5">
          <input
            ref={ref}
            id={inputId}
            type="radio"
            name={context?.name}
            value={value}
            checked={isChecked}
            onChange={() => context?.onValueChange?.(value)}
            disabled={disabled}
            className="peer h-4 w-4 rounded-full border border-neutral-300 bg-white text-primary transition-colors focus:ring-2 focus:ring-nav-accent focus:ring-offset-2 focus:ring-offset-white checked:bg-primary checked:border-primary cursor-pointer disabled:cursor-not-allowed"
            {...props}
          />
        </div>
        {(label || description) && (
          <label htmlFor={inputId} className="flex flex-col cursor-pointer">
            {label && <span className="text-sm font-medium text-neutral-900">{label}</span>}
            {description && <span className="text-xs text-neutral-500 mt-0.5">{description}</span>}
          </label>
        )}
      </div>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

