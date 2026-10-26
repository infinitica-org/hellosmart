'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login, type UserMe } from '@/lib/api-client';

export interface LoginFormProps {
  onSuccess?: (user: UserMe) => void;
}

export function LoginForm({ onSuccess }: LoginFormProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bannerParam = searchParams.get('message');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forcedResetNotice, setForcedResetNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setForcedResetNotice(null);

    if (!email || !password) {
      setErrorMessage('Please enter both your email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await login({ email, password });
      setIsSubmitting(false);

      if (onSuccess) {
        onSuccess(user);
      }

      // Step 4: Forced password reset handling
      // If mustResetPassword === true, DO NOT route into normal portal!
      if (user.mustResetPassword) {
        setForcedResetNotice(
          'Password reset is required for your account before accessing your portal. ' +
          'Please use the secure link in your invitation email, or contact your administrator to receive a fresh invite.',
        );
        return;
      }

      // Normal portal routing based on role / portal
      const targetPortal = user.portal || (user.role === 'platform_admin' ? 'admin' : user.role === 'company_admin' ? 'company' : 'candidate');
      router.push(`/${targetPortal}`);
    } catch (err: unknown) {
      setIsSubmitting(false);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Banner (e.g. redirected from successful invitation acceptance) */}
      {bannerParam === 'password_set' && (
        <div
          role="status"
          className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="font-bold">✓</span>
            <span>Password set, please sign in</span>
          </div>
        </div>
      )}

      {/* Reset Required Banner */}
      {bannerParam === 'reset_required' && (
        <div
          role="alert"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true">⚠️</span>
              <span>Password Reset Required</span>
            </div>
            <p>
              Your account requires a password reset before accessing the portal. Please use the
              secure link provided in your invitation email.
            </p>
          </div>
        </div>
      )}

      {/* Forced Reset Notice (Step 4) */}
      {forcedResetNotice && (
        <div
          role="alert"
          className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 border border-amber-200"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true">⚠️</span>
              <span>Password Reset Required</span>
            </div>
            <p>{forcedResetNotice}</p>
          </div>
        </div>
      )}

      {/* Generic Error Message */}
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

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Email Address */}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">
            Email address
          </label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm disabled:bg-slate-50"
            placeholder="you@company.com"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
          </div>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 sm:text-sm disabled:bg-slate-50"
              placeholder="••••••••••••"
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

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || !email || !password}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
