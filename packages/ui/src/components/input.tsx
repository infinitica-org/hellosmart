'use client';

import React, {
  InputHTMLAttributes,
  forwardRef,
  ReactNode,
  useRef,
  useEffect,
  useImperativeHandle,
} from 'react';
import { Loader2, X, Search } from 'lucide-react';

// ============================================================================
// Basic Input Component
// ============================================================================

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize | undefined;
  hasError?: boolean | undefined;
  isLoading?: boolean | undefined;
  leftIcon?: ReactNode | undefined;
  rightIcon?: ReactNode | undefined;
  onClear?: (() => void) | undefined;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'text-xs py-1 px-2.5 rounded-sm',
  md: 'text-[13px] py-1.5 px-3 rounded-sm',
  lg: 'text-sm py-2 px-3.5 rounded-sm',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      hasError = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      onClear,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-neutral-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          disabled={disabled || isLoading}
          aria-invalid={hasError ? 'true' : undefined}
          className={`w-full bg-white border text-foreground placeholder-[#8a95a3] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed ${
            sizeStyles[size]
          } ${
            hasError
              ? 'border-[#d64545] focus:border-[#d64545] focus:ring-[#d64545]/15'
              : 'border-[#d8dee6] hover:border-[#c3ccd6] focus:border-nav-accent focus:ring-nav-accent/20'
          } ${leftIcon ? 'pl-9' : ''} ${rightIcon || onClear || isLoading ? 'pr-9' : ''} ${className}`}
          {...props}
        />
        {isLoading ? (
          <div className="absolute right-3 flex items-center pointer-events-none">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : onClear && props.value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear input"
            className="absolute right-2.5 flex items-center justify-center w-5 h-5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : rightIcon ? (
          <div className="absolute right-3 flex items-center text-neutral-400">
            {rightIcon}
          </div>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

// ============================================================================
// SearchInput / SearchBar Component
// ============================================================================

export type SearchInputSize = 'sm' | 'md' | 'lg';
export type SearchInputRounded = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Size variant: 'sm' (h-8), 'md' (h-10, default), 'lg' (h-12) */
  size?: SearchInputSize | undefined;
  /** Border radius: 'sm', 'md' (default), 'lg', 'xl', 'full', 'none' */
  rounded?: SearchInputRounded | undefined;
  /** Custom left search icon (defaults to Lucide Search) */
  searchIcon?: ReactNode | undefined;
  /** Keyboard shortcut hint, e.g. "⌘K" or true for "⌘K" (default: true). Set false to hide. */
  shortcutKey?: string | boolean | undefined;
  /** Automatically bind Cmd+K / Ctrl+K to focus this search input (default: true) */
  autoShortcut?: boolean | undefined;
  /** Callback fired when the clear button is clicked */
  onClear?: (() => void) | undefined;
  /** Show loading spinner on the right */
  isLoading?: boolean | undefined;
  /** Highlight as error state */
  hasError?: boolean | undefined;
  /** Additional class name for the wrapper div */
  containerClassName?: string | undefined;
}

const searchSizeStyles: Record<
  SearchInputSize,
  { container: string; input: string; icon: string; iconPos: string; badge: string; clearPos: string }
> = {
  sm: {
    container: 'h-8',
    input: 'h-8 text-xs pl-8 pr-9',
    icon: 'w-3.5 h-3.5',
    iconPos: 'left-2.5',
    badge: 'text-[10px] right-2 px-1 py-0.5',
    clearPos: 'right-1.5',
  },
  md: {
    container: 'h-10',
    input: 'h-10 text-sm pl-9 pr-12',
    icon: 'w-4 h-4',
    iconPos: 'left-3',
    badge: 'text-[11px] right-2.5 px-1.5 py-0.5',
    clearPos: 'right-2',
  },
  lg: {
    container: 'h-12',
    input: 'h-12 text-base pl-10 pr-14',
    icon: 'w-5 h-5',
    iconPos: 'left-3.5',
    badge: 'text-xs right-3 px-2 py-0.5',
    clearPos: 'right-2.5',
  },
};

const roundedClasses: Record<SearchInputRounded, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      size = 'md',
      rounded = 'md',
      searchIcon,
      shortcutKey = true,
      autoShortcut = true,
      onClear,
      isLoading = false,
      hasError = false,
      containerClassName = '',
      className = '',
      disabled = false,
      placeholder = 'Search...',
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const internalInputRef = useRef<HTMLInputElement>(null);

    // Merge external ref with internal ref so both work
    useImperativeHandle(ref, () => internalInputRef.current as HTMLInputElement);

    // Cmd+K / Ctrl+K shortcut listener to focus input
    useEffect(() => {
      if (!autoShortcut || disabled) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          // If already focused, don't re-trigger
          if (document.activeElement === internalInputRef.current) return;
          e.preventDefault();
          internalInputRef.current?.focus();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [autoShortcut, disabled]);

    const sizeConfig = searchSizeStyles[size];
    const roundedClass = roundedClasses[rounded];
    const hasValue = value !== undefined && value !== null && String(value).length > 0;
    const resolvedShortcut = shortcutKey === true ? '⌘K' : shortcutKey;

    const handleClear = () => {
      onClear?.();
      // If controlled through onChange without explicit onClear, simulate empty change
      if (!onClear && onChange) {
        const syntheticEvent = {
          target: { value: '' },
          currentTarget: { value: '' },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
      internalInputRef.current?.focus();
    };

    return (
      <div className={`relative flex items-center w-full ${containerClassName}`}>
        {/* Left search icon */}
        <div
          className={`absolute ${sizeConfig.iconPos} flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500 z-10`}
          aria-hidden="true"
        >
          {searchIcon ?? <Search className={`${sizeConfig.icon} shrink-0`} />}
        </div>

        {/* Search input field */}
        <input
          ref={internalInputRef}
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          aria-invalid={hasError ? 'true' : undefined}
          className={`w-full bg-white dark:bg-neutral-900 border text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${
            sizeConfig.input
          } ${roundedClass} ${
            hasError
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
              : 'border-neutral-200/90 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-neutral-900 dark:focus:border-neutral-100 focus:ring-neutral-900/10 dark:focus:ring-white/10'
          } ${className}`}
          {...props}
        />

        {/* Right side: Loading Spinner, Clear Button, or Cmd+K Badge */}
        {isLoading ? (
          <div
            className={`absolute ${sizeConfig.clearPos} flex items-center justify-center p-1 pointer-events-none z-10 text-neutral-400`}
          >
            <Loader2 className={`${sizeConfig.icon} animate-spin`} />
          </div>
        ) : hasValue && (onClear || onChange) ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear search"
            title="Clear search"
            className={`absolute ${sizeConfig.clearPos} flex items-center justify-center p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors z-10 cursor-pointer focus:outline-none`}
          >
            <X className={sizeConfig.icon} />
          </button>
        ) : resolvedShortcut ? (
          <div className={`absolute ${sizeConfig.badge} flex items-center pointer-events-none z-10`}>
            <kbd className="hidden sm:inline-flex items-center font-sans font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100/90 dark:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-700 rounded select-none px-1.5 py-0.5">
              {resolvedShortcut}
            </kbd>
          </div>
        ) : null}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

// Alias for convenience
export const SearchBar = SearchInput;
export type SearchBarProps = SearchInputProps;
