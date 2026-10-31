'use client';

import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean | undefined;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[] | undefined;
  hasError?: boolean | undefined;
  placeholder?: string | undefined;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, hasError = false, placeholder, className = '', disabled, children, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          className={`w-full appearance-none bg-white border text-foreground text-[13px] rounded-sm pl-3 pr-9 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white disabled:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed ${
 hasError
 ? 'border-[#d64545] focus:border-[#d64545] focus:ring-[#d64545]/15'
              : 'border-[#d8dee6] hover:border-[#c3ccd6] focus:border-nav-accent focus:ring-nav-accent/20'
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled className="bg-white text-neutral-400">
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className="bg-white text-neutral-900"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    );
  }
);
Select.displayName = 'Select';

export interface MultiSelectProps {
  options: SelectOption[];
  values?: string[] | undefined;
  defaultValue?: string[] | undefined;
  onChange?: ((values: string[]) => void) | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  hasError?: boolean | undefined;
  className?: string | undefined;
  id?: string | undefined;
}

export function MultiSelect({
  options,
  values: controlledValues,
  defaultValue = [],
  onChange,
  placeholder = 'Select options...',
  disabled = false,
  hasError = false,
  className = '',
  id,
}: MultiSelectProps): React.JSX.Element {
  const [internalValues, setInternalValues] = React.useState<string[]>(defaultValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isControlled = controlledValues !== undefined;
  const currentValues = isControlled ? controlledValues : internalValues;

  const updateValues = (newVals: string[]) => {
    if (!isControlled) {
      setInternalValues(newVals);
    }
    onChange?.(newVals);
  };

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const toggleOption = (val: string) => {
    if (disabled) return;
    if (currentValues.includes(val)) {
      updateValues(currentValues.filter((v) => v !== val));
    } else {
      updateValues([...currentValues, val]);
    }
  };

  const removeValue = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    updateValues(currentValues.filter((v) => v !== val));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    updateValues([]);
  };

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOptions = options.filter((opt) => currentValues.includes(opt.value));

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} id={id}>
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className={`w-full min-h-[42px] bg-white border text-neutral-900 text-sm rounded-md px-3 py-1.5 transition-colors cursor-pointer flex items-center justify-between gap-2 shadow-xs ${
 hasError
 ? 'border-danger ring-1 ring-danger/15'
            : isOpen
              ? 'border-primary ring-2 ring-primary/20'
              : 'border-neutral-300 hover:border-neutral-400'
        } ${disabled ? 'bg-neutral-100 opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedOptions.length === 0 ? (
            <span className="text-neutral-400 select-none text-xs">{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 text-xs font-medium px-2 py-0.5 rounded-sm select-none"
              >
                <span>{opt.label}</span>
                <button
                  type="button"
                  onClick={(e) => removeValue(opt.value, e)}
                  aria-label={`Remove ${opt.label}`}
                  className="hover:text-primary-hover focus:outline-none p-0.5 rounded-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        <div className="flex items-center gap-1 text-neutral-400 shrink-0">
          {selectedOptions.length > 0 && !disabled && (
            <button
              type="button"
              onClick={clearAll}
              aria-label="Clear all selected"
              className="p-1 hover:text-neutral-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-neutral-200 rounded-md shadow-xl z-50 overflow-hidden animate-fade-in">
          {options.length > 5 && (
            <div className="p-2 border-b border-neutral-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search options..."
                className="w-full bg-neutral-50 border border-neutral-200 rounded-sm px-2.5 py-1.5 text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-primary"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <ul role="listbox" aria-multiselectable="true" className="max-h-60 overflow-y-auto py-1 text-xs">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-neutral-400 text-center">No options found</li>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = currentValues.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => !opt.disabled && toggleOption(opt.value)}
                    className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
 opt.disabled
 ? 'opacity-40 cursor-not-allowed bg-neutral-50'
                        : isSelected
                          ? 'bg-primary/5 text-primary font-medium'
                          : 'text-neutral-800 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
 isSelected
 ? 'bg-primary border-primary text-white'
                            : 'border-neutral-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{opt.label}</span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

