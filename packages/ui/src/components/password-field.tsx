'use client';

import React, {
  forwardRef,
  useState,
  useId,
  ReactNode,
  InputHTMLAttributes,
  KeyboardEvent,
  FocusEvent,
} from 'react';
import { Eye, EyeOff, AlertTriangle, AlertCircle } from 'lucide-react';
import { Label } from './label';

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id?: string | undefined;
  label?: ReactNode | undefined;
  helperText?: ReactNode | undefined;
  errorMessage?: ReactNode | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  showCapsLockWarning?: boolean | undefined;
  showToggle?: boolean | undefined;
  allowPaste?: boolean | undefined;
  containerClassName?: string | undefined;
  inputClassName?: string | undefined;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      id,
      label,
      helperText,
      errorMessage,
      required = false,
      optional = false,
      showCapsLockWarning = true,
      showToggle = true,
      allowPaste = true,
      autoComplete = 'new-password',
      disabled = false,
      className = '',
      containerClassName = '',
      inputClassName = '',
      onKeyDown,
      onKeyUp,
      onBlur,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const fieldId = id || generatedId;
    const errorId = `${fieldId}-error`;
    const helperId = `${fieldId}-helper`;
    const capsLockId = `${fieldId}-capslock`;

    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (showCapsLockWarning && typeof e.getModifierState === 'function') {
        setCapsLockOn(e.getModifierState('CapsLock'));
      }
      onKeyDown?.(e);
    };

    const handleKeyUp = (e: KeyboardEvent<HTMLInputElement>) => {
      if (showCapsLockWarning && typeof e.getModifierState === 'function') {
        setCapsLockOn(e.getModifierState('CapsLock'));
      }
      onKeyUp?.(e);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
      setCapsLockOn(false);
      onBlur?.(e);
    };

    // Calculate aria-describedby references
    const describedBy = [
      errorMessage ? errorId : null,
      helperText ? helperId : null,
      capsLockOn && showCapsLockWarning ? capsLockId : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={`flex flex-col space-y-1.5 w-full ${containerClassName}`}>
        {label && (
          <Label htmlFor={fieldId} required={required} optional={optional}>
            {label}
          </Label>
        )}

        <div className="relative flex items-center w-full">
          <input
            ref={ref}
            id={fieldId}
            type={showPassword ? 'text' : 'password'}
            disabled={disabled}
            required={required}
            autoComplete={autoComplete}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={describedBy}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onBlur={handleBlur}
            onPaste={allowPaste ? props.onPaste : (e) => e.preventDefault()}
            className={`
 w-full h-10 px-3 py-2 text-sm text-neutral-900 bg-white
 border rounded-md shadow-xs transition-colors duration-150
              placeholder:text-neutral-400
              hover:border-neutral-400
              focus:outline-hidden focus:ring-2 focus:ring-nav-accent/20 focus:border-primary
              disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 disabled:border-neutral-200
              ${showToggle ? 'pr-10' : ''}
              ${errorMessage ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-neutral-300'}
              ${inputClassName}
              ${className}
            `}
            {...props}
          />

          {showToggle && (
            <button
              type="button"
              tabIndex={0}
              disabled={disabled}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-0 top-0 bottom-0 px-3 flex items-center justify-center text-neutral-400 hover:text-neutral-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer focus:outline-hidden focus:text-neutral-900"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              data-testid="password-toggle-button"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4 text-neutral-600 hover:text-neutral-900" aria-hidden="true" />
              ) : (
                <Eye className="w-4 h-4 text-neutral-400 hover:text-neutral-700" aria-hidden="true" />
              )}
            </button>
          )}
        </div>

        {/* Caps Lock Warning */}
        {capsLockOn && showCapsLockWarning && (
          <p
            id={capsLockId}
            role="status"
            aria-live="polite"
            data-testid="caps-lock-warning"
            className="text-xs text-warning-foreground flex items-center gap-1 mt-1 font-medium bg-warning-muted border border-warning-border/80 rounded px-2 py-1"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span>Caps Lock is on</span>
          </p>
        )}

        {/* Error message */}
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            data-testid="password-error-message"
            className="text-xs text-danger flex items-center gap-1 mt-1 font-medium"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </p>
        )}

        {/* Helper text */}
        {!errorMessage && helperText && (
          <p id={helperId} className="text-xs text-neutral-500 mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

PasswordField.displayName = 'PasswordField';

