'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PasswordPolicySchema } from '@hs/contracts';
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
  onSuccess?: () => void;
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
  onSuccess,
  onError,
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

    const policyResult = PasswordPolicySchema.safeParse(newPassword);
    if (!policyResult.success) {
      setGeneralError(policyResult.error.errors[0]?.message || 'Password does not satisfy policy requirements.');
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
          onError?.(new Error(result.errorMessage || 'Failed to update password.'));
          return;
        }
      } else {
        // Default API request
        const targetUrl = token
          ? '/api/auth/invitations/accept'
          : '/api/auth/password/change';

        const payload = token
          ? { token, password: newPassword }
          : {
              currentPassword: requireCurrentPassword ? currentPassword : undefined,
              newPassword,
            };

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-HS-CSRF': '1',
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          setIsLoading(false);
          if (data?.code) {
            setServerErrorCode(data.code);
          } else if (data?.detail) {
            setGeneralError(data.detail);
          } else {
            setGeneralError('Failed to set password. Please try again.');
          }
          onError?.(new Error(data?.detail || 'Failed to set password.'));
          return;
        }
      }

      setIsLoading(false);
      setSuccessMessage('Your password has been successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();

      if (redirectTo) {
        setTimeout(() => {
          router.push(redirectTo);
        }, 1200);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setGeneralError(msg);
      onError?.(err instanceof Error ? err : new Error(msg));
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
  );
}
