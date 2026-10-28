'use client';

import React, { useState } from 'react';
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
