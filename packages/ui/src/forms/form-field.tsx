'use client';

import React, {
  forwardRef,
  useState,
  ReactNode,
  HTMLAttributes,
  FormHTMLAttributes,
} from 'react';
import { Label, LabelProps } from '../components/label';
import { Input, InputProps } from '../components/input';
import { Textarea, TextareaProps } from '../components/textarea';
import { Select, SelectProps } from '../components/select';
import { Checkbox, CheckboxProps } from '../components/checkbox';

export interface FormFieldProps {
  id?: string | undefined;
  label?: ReactNode | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  helperText?: ReactNode | undefined;
  errorMessage?: ReactNode | undefined;
  className?: string | undefined;
  children: ReactNode;
}

export function FormField({
  id,
  label,
  required = false,
  optional = false,
  helperText,
  errorMessage,
  className = '',
  children,
}: FormFieldProps): React.JSX.Element {
  const generatedId = React.useId();
  const fieldId = id || generatedId;
  const helperId = `${fieldId}-helper`;
  const errorId = `${fieldId}-error`;

  return (
    <div className={`flex flex-col space-y-1.5 w-full ${className}`}>
      {label && (
        <Label htmlFor={fieldId} required={required} optional={optional}>
          {label}
        </Label>
      )}

      <div>{children}</div>

      {errorMessage && (
        <p id={errorId} className="text-xs text-rose-400 flex items-center gap-1 mt-1 font-medium">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{errorMessage}</span>
        </p>
      )}

      {!errorMessage && helperText && (
        <p id={helperId} className="text-xs text-slate-400 mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}

export const FormLabel = Label;
export type FormLabelProps = LabelProps;

export interface FormDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const FormDescription = forwardRef<HTMLParagraphElement, FormDescriptionProps>(
  ({ className = '', children, ...props }, ref) => (
    <p ref={ref} className={`text-xs text-slate-400 mt-1 ${className}`} {...props}>
      {children}
    </p>
  )
);
FormDescription.displayName = 'FormDescription';

export interface FormErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  children?: ReactNode | undefined;
}

export const FormError = forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ className = '', children, ...props }, ref) => {
    if (!children) return null;
    return (
      <p
        ref={ref}
        role="alert"
        className={`text-xs text-rose-400 flex items-center gap-1 mt-1 font-medium ${className}`}
        {...props}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span>{children}</span>
      </p>
    );
  }
);
FormError.displayName = 'FormError';

export interface TextFieldProps extends Omit<InputProps, 'id'> {
  id?: string | undefined;
  label?: ReactNode | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  helperText?: ReactNode | undefined;
  errorMessage?: ReactNode | undefined;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ id, label, required, optional, helperText, errorMessage, className = '', ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;

    return (
      <FormField
        id={fieldId}
        label={label}
        required={required}
        optional={optional}
        helperText={helperText}
        errorMessage={errorMessage}
        className={className}
      >
        <Input
          ref={ref}
          id={fieldId}
          hasError={Boolean(errorMessage)}
          required={required}
          {...props}
        />
      </FormField>
    );
  }
);
TextField.displayName = 'TextField';

export interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'rightIcon'> {}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleButton = (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShowPassword(!showPassword)}
        className="text-slate-400 hover:text-slate-200 transition-colors focus:outline-none p-0.5"
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    );

    return (
      <TextField
        ref={ref}
        type={showPassword ? 'text' : 'password'}
        rightIcon={toggleButton}
        {...props}
      />
    );
  }
);
PasswordField.displayName = 'PasswordField';

export interface TextAreaFieldProps extends Omit<TextareaProps, 'id'> {
  id?: string | undefined;
  label?: ReactNode | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  helperText?: ReactNode | undefined;
  errorMessage?: ReactNode | undefined;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ id, label, required, optional, helperText, errorMessage, className = '', ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;

    return (
      <FormField
        id={fieldId}
        label={label}
        required={required}
        optional={optional}
        helperText={helperText}
        errorMessage={errorMessage}
        className={className}
      >
        <Textarea
          ref={ref}
          id={fieldId}
          hasError={Boolean(errorMessage)}
          required={required}
          {...props}
        />
      </FormField>
    );
  }
);
TextAreaField.displayName = 'TextAreaField';

export interface SelectFieldProps extends Omit<SelectProps, 'id'> {
  id?: string | undefined;
  label?: ReactNode | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  helperText?: ReactNode | undefined;
  errorMessage?: ReactNode | undefined;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ id, label, required, optional, helperText, errorMessage, className = '', ...props }, ref) => {
    const generatedId = React.useId();
    const fieldId = id || generatedId;

    return (
      <FormField
        id={fieldId}
        label={label}
        required={required}
        optional={optional}
        helperText={helperText}
        errorMessage={errorMessage}
        className={className}
      >
        <Select
          ref={ref}
          id={fieldId}
          hasError={Boolean(errorMessage)}
          required={required}
          {...props}
        />
      </FormField>
    );
  }
);
SelectField.displayName = 'SelectField';

export interface CheckboxFieldProps extends CheckboxProps {
  errorMessage?: ReactNode | undefined;
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ errorMessage, className = '', ...props }, ref) => (
    <div className={`space-y-1 ${className}`}>
      <Checkbox ref={ref} {...props} />
      {errorMessage && <FormError>{errorMessage}</FormError>}
    </div>
  )
);
CheckboxField.displayName = 'CheckboxField';

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(
  ({ className = '', children, ...props }, ref) => (
    <form ref={ref} className={`space-y-4 ${className}`} {...props}>
      {children}
    </form>
  )
);
Form.displayName = 'Form';
