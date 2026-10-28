'use client';

import React, { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PasswordField,
  PasswordStrengthMeter,
  mapServerError,
  Button,
  Card,
  Alert,
} from '@hs/ui';

export interface SetPasswordFormProps {
  /** Optional invitation or password reset token */
  token?: string;
  /** Pre-filled user email */
  email?: string;
  /** Candidate or user name for context-aware dictionary evaluation */
  userName?: string;
  /** Company name for context-aware dictionary evaluation */
  companyName?: string;
  /** Whether the current password is required (e.g. on change-password screen) */
  requireCurrentPassword?: boolean;
  /** Form title */
  title?: string;
  /** Form subtitle */
  subtitle?: string;
  /** Custom submit button label */
  submitLabel?: string;
  /** Where to redirect upon success */
  redirectTo?: string;
  /** Custom submit handler. If omitted, default POST to /api/auth/set-password */
  onSubmitPassword?: (data: {
    currentPassword?: string | undefined;
    newPassword: string;
    token?: string | undefined;
  }) => Promise<{ success: boolean; errorCode?: string; errorMessage?: string } | void>;

import { PasswordPolicySchema } from '@hs/contracts';
import {
  acceptInvitation,
  InvitationInvalidError,
  RateLimitedError,
  WeakPasswordError,
} from '@/lib/api-client';
import { evaluatePassword, PasswordStrengthMeter } from './password-strength-meter';

export interface SetPasswordFormProps {
  token: string;
  onSuccess: () => void;
  onError?: (error: Error) => void;

}

export function SetPasswordForm({
  token,

  email,
  userName = '',
  companyName = '',
  requireCurrentPassword = false,
  title = 'Set Your Password',
  subtitle = 'Choose a strong password to secure your HelloSmart account.',
  submitLabel = 'Save Password',
  redirectTo = '/login',
  onSubmitPassword,
}: SetPasswordFormProps): React.JSX.Element {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [serverErrorCode, setServerErrorCode] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Contextual inputs for password strength evaluation (name, email, company)
  const userContextInputs = React.useMemo(() => {
    return [userName, email, companyName].filter(Boolean) as string[];
  }, [userName, email, companyName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerErrorCode(null);
    setGeneralError(null);
    setSuccessMessage(null);

    // Client-side validations
    if (requireCurrentPassword && !currentPassword) {
      setGeneralError('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setGeneralError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setGeneralError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setGeneralError('New password and confirmation password do not match.');
      return;
    }

    setIsLoading(true);

    try {
      if (onSubmitPassword) {
        const result = await onSubmitPassword({
          currentPassword: requireCurrentPassword ? currentPassword : undefined,
          newPassword,
          token,
        });

        if (result && !result.success) {
          setIsLoading(false);
          if (result.errorCode) {
            setServerErrorCode(result.errorCode);
          } else {
            setGeneralError(result.errorMessage || 'Failed to update password.');
          }
          return;
        }
      } else {
        // Default API request
        const response = await fetch('/api/auth/set-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            currentPassword: requireCurrentPassword ? currentPassword : undefined,
            newPassword,
          }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setIsLoading(false);
          // Check for structured server rejection error codes
          if (data?.code) {
            setServerErrorCode(data.code);
          } else if (data?.detail) {
            setGeneralError(data.detail);
          } else {
            setGeneralError('Failed to set password. Please try again.');
          }
          return;
        }
      }

      setIsLoading(false);
      setSuccessMessage('Your password has been successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (redirectTo) {
        setTimeout(() => {
          router.push(redirectTo);
        }, 1500);
      }
    } catch {
      setIsLoading(false);
      setGeneralError('Network error. Unable to reach server. Please try again.');

  onSuccess,
  onError,
}: SetPasswordFormProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const evaluation = evaluatePassword(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = evaluation.isStrong && passwordsMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Client-side validation using shared PasswordPolicySchema
    const policyResult = PasswordPolicySchema.safeParse(password);
    if (!policyResult.success) {
      const msg = policyResult.error.issues[0]?.message ?? 'Password does not meet complexity requirements.';
      setErrorMessage(msg);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      await acceptInvitation({
        token,
        password,
      });

      // Clear sensitive form state immediately on success
      setPassword('');
      setConfirmPassword('');
      setErrorMessage(null);

      onSuccess();
    } catch (err: unknown) {
      setIsSubmitting(false);

      if (err instanceof InvitationInvalidError) {
        setErrorMessage('This link is no longer valid. Please ask your admin to resend the invite.');
      } else if (err instanceof WeakPasswordError) {
        setErrorMessage(err.message);
      } else if (err instanceof RateLimitedError) {
        setErrorMessage('Too many attempts. Please wait a few minutes before trying again.');
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }

      if (onError && err instanceof Error) {
        onError(err);
      }

    }
  };

  return (

    <Card className="p-6 sm:p-8 space-y-6 shadow-lg shadow-neutral-900/5 max-w-md w-full">
      {(title || subtitle) && (
        <div className="text-center flex flex-col items-center space-y-1">
          {title && (
            <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h2>
          )}
          {subtitle && (
            <p className="text-sm text-neutral-500 font-normal max-w-xs sm:max-w-sm">{subtitle}</p>
          )}
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <Alert variant="success" className="text-xs">
          <div>
            <p className="font-medium">{successMessage}</p>
            {redirectTo && (
              <p className="mt-1 text-neutral-600">Redirecting you to sign in...</p>
            )}
          </div>
        </Alert>
      )}

      {/* General error alert */}
      {generalError && (
        <Alert variant="error" className="text-xs">
          {generalError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Optional Current Password field */}
        {requireCurrentPassword && (
          <PasswordField
            id="current-password"
            name="currentPassword"
            label="Current Password"
            required
            autoComplete="current-password"
            disabled={isLoading}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="••••••••••••"
          />
        )}

        {/* New Password Field */}
        <div>
          <PasswordField
            id="new-password"
            name="newPassword"
            label="New Password"
            required
            autoComplete="new-password"
            disabled={isLoading}
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (serverErrorCode) setServerErrorCode(null);
            }}
            placeholder="••••••••••••"
            showCapsLockWarning
          />

          {/* Password Strength Meter & Live Checklist */}
          <PasswordStrengthMeter
            password={newPassword}
            userInputs={userContextInputs}
            serverError={serverErrorCode}
            showRequirements
          />
        </div>

        {/* Confirm Password Field */}
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label="Confirm Password"
          required
          autoComplete="new-password"
          disabled={isLoading}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••••••"
          errorMessage={
            confirmPassword && newPassword !== confirmPassword
              ? 'Passwords do not match.'
              : undefined
          }
        />

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isLoading}
          disabled={isLoading || !newPassword || newPassword !== confirmPassword}
          className="bg-primary hover:bg-primary-hover text-white border-transparent font-medium mt-2"
        >
          {submitLabel} →
        </Button>
      </form>

      <div className="text-center pt-1">
        <Link
          href="/login"
          className="text-xs text-neutral-500 hover:text-neutral-800 transition font-light"
        >
          ← Back to Sign In
        </Link>
      </div>
    </Card>

    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200"
        >
          <div className="flex items-start gap-2">
            <span aria-hidden="true" className="font-bold">!</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* New Password Field */}
      <div>
        <label
          htmlFor="new-password"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          New Password
        </label>
        <div className="relative">
          <input
            id="new-password"
            name="newPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
            placeholder="••••••••••••"
            aria-describedby="password-requirements"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-slate-500 hover:text-slate-700 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {/* Password Strength Meter & Guidelines */}
      <div id="password-requirements">
        <PasswordStrengthMeter password={password} />
      </div>

      {/* Confirm Password Field */}
      <div>
        <label
          htmlFor="confirm-password"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Confirm Password
        </label>
        <input
          id="confirm-password"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
          placeholder="••••••••••••"
        />
        {confirmPassword.length > 0 && !passwordsMatch && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            Passwords do not match.
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"
              role="status"
              aria-label="Setting password"
            />
            <span>Setting password...</span>
          </span>
        ) : (
          'Set Password & Continue'
        )}
      </button>
    </form>

  );
}
