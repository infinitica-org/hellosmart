'use client';

import React, { forwardRef, ReactNode } from 'react';

export interface SwitchProps {
  checked?: boolean | undefined;
  defaultChecked?: boolean | undefined;
  onChange?: ((checked: boolean) => void) | undefined;
  disabled?: boolean | undefined;
  label?: ReactNode | undefined;
  description?: ReactNode | undefined;
  id?: string | undefined;
  className?: string | undefined;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked = false,
      onChange,
      disabled = false,
      label,
      description,
      id,
      className = '',
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked);
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    const toggle = () => {
      if (disabled) return;
      const next = !isChecked;
      if (!isControlled) {
        setInternalChecked(next);
      }
      onChange?.(next);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    };

    return (
      <div
        className={`flex items-start gap-3 select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${className}`}
        onClick={toggle}
      >
        <button
          ref={ref}
          type="button"
          id={id}
          role="switch"
          aria-checked={isChecked}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed ${
            isChecked ? 'bg-primary' : 'bg-neutral-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isChecked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
        {(label || description) && (
          <div className="flex flex-col">
            {label && <span className="text-sm font-medium text-neutral-900">{label}</span>}
            {description && <span className="text-xs text-neutral-500 mt-0.5">{description}</span>}
          </div>
        )}
      </div>
    );
  }
);
Switch.displayName = 'Switch';

