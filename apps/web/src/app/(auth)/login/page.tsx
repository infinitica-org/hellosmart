'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BrandMark,
  TextField,
  PasswordField,
  Button,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@hs/ui';

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ssoNotice, setSsoNotice] = useState<string | null>(null);

  // MFA 6-digit TOTP modal state
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  const getTargetPortal = (role?: string, portal?: string) => {
    if (portal) return `/${portal}`;
    if (role === 'platform_admin') return '/admin';
    if (role === 'candidate') return '/candidate';
    return '/company';
  };

  const executeRedirect = (targetPortal: string) => {
    const dest = from && from.startsWith(targetPortal) ? from : targetPortal;
    window.location.href = dest;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSsoNotice(null);

    if (!email || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setIsLoading(false);
        // Explicit status code mapping for clean error text
        if (response.status === 401) {
          setErrorMessage('Invalid email or password, or account not found.');
        } else if (response.status === 403) {
          setErrorMessage('Your account or company is suspended. Please contact support.');
        } else if (response.status === 429) {
          setErrorMessage('Too many failed attempts. Please wait 15 minutes.');
        } else {
          setErrorMessage(
            data?.detail ||
              data?.title ||
              'Invalid credentials. Please verify your email and password.'
          );
        }
        return;
      }

      // If MFA required: prompt for 6-digit TOTP code
      if (data?.mfaRequired) {
        setIsLoading(false);
        setIsMfaOpen(true);
        setMfaCode('');
        setMfaError(null);
        return;
      }

      // Successful login redirect based on role
      const target = getTargetPortal(data?.role, data?.portal);
      executeRedirect(target);
    } catch {
      setIsLoading(false);
      setErrorMessage('Unable to connect to the authentication server. Please try again later.');
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError(null);

    if (!mfaCode || mfaCode.trim().length !== 6) {
      setMfaError('Please enter a valid 6-digit code.');
      return;
    }

    setMfaLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          mfaCode: mfaCode.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMfaLoading(false);
        if (response.status === 401) {
          setMfaError('Invalid 6-digit authentication code. Please try again.');
        } else if (response.status === 429) {
          setMfaError('Too many failed attempts. Please wait 15 minutes.');
        } else {
          setMfaError(data?.detail || 'MFA verification failed.');
        }
        return;
      }

      // Successful MFA completion
      setIsMfaOpen(false);
      const target = getTargetPortal(data?.role, data?.portal);
      executeRedirect(target);
    } catch {
      setMfaLoading(false);
      setMfaError('Unable to verify MFA code. Please try again.');
    }
  };

  const handleSsoClick = (provider: 'Google' | 'Microsoft') => {
    setErrorMessage(null);
    setSsoNotice(
      `${provider} SSO is not configured for this environment. Please sign in with your email and password.`
    );
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-[#090d16] text-slate-100 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center flex flex-col items-center">
          <Link href="/" className="inline-block mb-3">
            <BrandMark size="lg" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Master Sign In</h1>
          <p className="text-sm text-slate-400 mt-1">
            Access your company portal, candidate workspace, or admin console.
          </p>
        </div>

        {/* Redirect Notice */}
        {from && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center gap-2.5">
            <svg
              className="w-4 h-4 text-amber-400 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              Authentication required to view <code className="font-mono text-amber-200">{from}</code>. Please sign in below.
            </span>
          </div>
        )}

        {/* Clean Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            data-testid="login-error-alert"
            className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/70 text-xs text-rose-300 flex items-start gap-2.5 animate-fadeIn"
          >
            <svg
              className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* SSO Notice */}
        {ssoNotice && (
          <div
            role="status"
            data-testid="sso-notice"
            className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 text-xs text-sky-300 flex items-start gap-2.5 animate-fadeIn"
          >
            <svg
              className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{ssoNotice}</span>
          </div>
        )}

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 border border-slate-800 space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <TextField
              id="email"
              name="email"
              type="email"
              label="Work Email"
              required
              disabled={isLoading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              data-testid="work-email-input"
            />

            <PasswordField
              id="password"
              name="password"
              label="Password"
              required
              disabled={isLoading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              data-testid="password-input"
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              data-testid="login-submit-button"
            >
              Sign In →
            </Button>
          </form>

          {/* SSO Separator */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-800" />
            <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-slate-500">
              or continue with SSO
            </span>
            <div className="flex-grow border-t border-slate-800" />
          </div>

          {/* SSO Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => handleSsoClick('Google')}
              data-testid="google-sso-button"
              className="w-full flex items-center justify-center gap-2"
              leftIcon={
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              }
            >
              Google SSO
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isLoading}
              onClick={() => handleSsoClick('Microsoft')}
              data-testid="microsoft-sso-button"
              className="w-full flex items-center justify-center gap-2"
              leftIcon={
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 23 23" aria-hidden="true">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
              }
            >
              Microsoft SSO
            </Button>
          </div>
        </div>
      </div>

      {/* MFA TOTP Verification Modal */}
      <Dialog
        open={isMfaOpen}
        onClose={() => {
          if (!mfaLoading) setIsMfaOpen(false);
        }}
        data-testid="mfa-dialog"
      >
        <form onSubmit={handleMfaSubmit}>
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-2 text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter the 6-digit TOTP code from your authenticator app to complete sign in.
            </DialogDescription>
          </DialogHeader>

          <DialogContent>
            {mfaError && (
              <div
                role="alert"
                className="p-3 mb-4 rounded-xl bg-rose-950/50 border border-rose-800/70 text-xs text-rose-300 flex items-start gap-2"
              >
                <svg
                  className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{mfaError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="mfa-code-input"
                className="block text-xs font-medium text-slate-300"
              >
                6-Digit Security Code
              </label>
              <input
                id="mfa-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                disabled={mfaLoading}
                autoFocus
                data-testid="mfa-totp-input"
                className="w-full text-center tracking-[0.5em] font-mono text-xl py-3 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all placeholder:text-slate-600 placeholder:tracking-widest"
              />
              <p className="text-[11px] text-slate-400 text-center">
                Check Google Authenticator, Microsoft Authenticator, or 1Password.
              </p>
            </div>
          </DialogContent>

          <DialogFooter className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={mfaLoading}
              onClick={() => setIsMfaOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={mfaLoading || mfaCode.trim().length !== 6}
              isLoading={mfaLoading}
              data-testid="mfa-submit-button"
            >
              Verify Code →
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#090d16]" />}>
      <LoginForm />
    </Suspense>
  );
}
