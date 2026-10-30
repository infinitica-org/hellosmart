'use client';


import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';
import {
  describeSignInStep,
  type LoginIdentifyResult,
  type LoginPortal,
} from '@/lib/login-portal-meta';
import {
  BrandMark,
  PasswordField,
  Button,
  TextureButton,
  Card,
  Alert,
  Input,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Footer,
} from '@hs/ui';

function LoginForm() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [identify, setIdentify] = useState<LoginIdentifyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ssoNotice, setSsoNotice] = useState<string | null>(null);

  // MFA 6-digit TOTP modal state
  const [isMfaOpen, setIsMfaOpen] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);

  // Forgot password modal state (BUG-06)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(
    () => searchParams?.get('help') === 'forgot-password'
  );

  const executeRedirect = (role?: string, portal?: string) => {
    const dest = getSafeRedirectUrl(from, role || '', portal);
    window.location.href = dest;
  };

  const resetToEmailStep = () => {
    setStep('email');
    setIdentify(null);
    setPassword('');
    setErrorMessage(null);
  };

  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSsoNotice(null);

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMessage('Enter a valid work email address.');
      return;
    }

    setIsIdentifying(true);
    try {
      const response = await fetch('/api/auth/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email: trimmed }),
      });

      const data = (await response.json().catch(() => null)) as LoginIdentifyResult | null;

      if (response.status === 429) {
        setErrorMessage(
          data && typeof data === 'object' && 'detail' in data
            ? String((data as { detail?: string }).detail)
            : 'Too many attempts. Please wait and try again.',
        );
        return;
      }

      if (!response.ok && response.status !== 404) {
        setErrorMessage(
          data && typeof data === 'object' && 'detail' in data
            ? String((data as { detail?: string }).detail)
            : 'Unable to look up this email. You can still enter your password below.',
        );
      }

      setIdentify(
        response.ok && data && typeof data === 'object' && 'recognized' in data
          ? data
          : { recognized: false },
      );
      setStep('password');
    } catch {
      setIdentify({ recognized: false });
      setStep('password');
    } finally {
      setIsIdentifying(false);
    }
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
          'X-HS-CSRF': '1',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setIsLoading(false);
        if (response.status === 401) {
          setErrorMessage('Invalid email or password, or account not found.');
        } else if (response.status === 403) {
          setErrorMessage('Your account or company is suspended. Please contact support.');
        } else if (response.status === 429) {
          setErrorMessage('Too many failed attempts. Please wait 15 minutes.');
        } else {
          if (response.status >= 500) {
            console.error('[login] BFF error', response.status, data);
          }
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
        setPreAuthToken(data.preAuthToken || null);
        setIsMfaOpen(true);
        setMfaCode('');
        setMfaError(null);
        return;
      }

      // If password reset required on first login (BR-24)
      const mustReset = Boolean(data?.mustResetPassword || data?.user?.mustResetPassword);
      if (mustReset) {
        window.location.href = '/change-password?required=true';
        return;
      }

      // Successful login redirect based on role
      executeRedirect(data?.role, data?.portal);
    } catch (err) {
      console.error('[login] request failed', err);
      setIsLoading(false);
      setErrorMessage('Unable to connect to the authentication server. Please try again later.');
    }
  };

  const isMfaCodeReady = (value: string): boolean => {
    const trimmed = value.trim();
    return (
      /^\d{6}$/.test(trimmed) ||
      /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed) ||
      trimmed.replace(/[^A-Za-z0-9]/g, '').length === 8
    );
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMfaError(null);

    const trimmed = mfaCode.trim();
    const isTotp = /^\d{6}$/.test(trimmed);
    const isBackup =
      /^[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(trimmed) ||
      trimmed.replace(/[^A-Za-z0-9]/g, '').length === 8;
    if (!isTotp && !isBackup) {
      setMfaError('Enter a 6-digit authenticator code or a backup code (XXXX-XXXX).');
      return;
    }

    setMfaLoading(true);

    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-HS-CSRF': '1',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          preAuthToken,
          ...(isTotp
            ? { totpCode: trimmed }
            : {
                backupCode: (() => {
                  const c = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  return c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : trimmed.toUpperCase();
                })(),
              }),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMfaLoading(false);
        if (response.status === 401) {
          if (data?.code === 'PREAUTH_INVALID') {
            setIsMfaOpen(false);
            setPreAuthToken(null);
            setErrorMessage(
              'Your MFA step expired or was reset (often after 3 wrong tries or an API restart). Sign in again with email and password, then enter a fresh code within 10 minutes.',
            );
            return;
          }
          if (data?.code === 'MFA_INVALID') {
            setMfaError(data?.detail || 'Invalid authenticator or backup code. Please try again.');
            return;
          }
          if (data?.code === 'MFA_NO_BACKUP_CODES') {
            setMfaError(
              data?.detail ||
                'No backup codes are on file. Use your authenticator app, then generate codes under Admin → Security.',
            );
            return;
          }
          setMfaError(data?.detail || 'Authentication failed. Please try again.');
        } else if (response.status === 429) {
          setIsMfaOpen(false);
          setPreAuthToken(null);
          setErrorMessage('Too many failed MFA attempts. Please wait 15 minutes before signing in again.');
        } else {
          setMfaError(data?.detail || 'MFA verification failed.');
        }
        return;
      }

      // Successful MFA completion
      setPreAuthToken(null);
      setIsMfaOpen(false);

      // If password reset required on first login (BR-24)
      const mustReset = Boolean(data?.mustResetPassword || data?.user?.mustResetPassword);
      if (mustReset) {
        window.location.href = '/change-password?required=true';
        return;
      }

      executeRedirect(data?.role, data?.portal);
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

  const purposeCopy = describeSignInStep(identify);

  const portalAccent: Record<LoginPortal, string> = {
    admin: 'border-violet-200 bg-violet-50/80 text-violet-900',
    company: 'border-primary/25 bg-primary/5 text-neutral-900',
    candidate: 'border-sky-200 bg-sky-50/80 text-sky-950',
  };

  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-canvas text-neutral-900 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center flex flex-col items-center">
          <Link href="/" className="inline-block mb-2 transition-transform hover:scale-105">
            <BrandMark size="lg" showSubtitle={false} />
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mt-2">Sign in</h1>
          <p className="text-sm text-neutral-500 font-normal mt-1 max-w-sm">
            {step === 'email'
              ? 'Enter your work email. We will route you to the right portal.'
              : purposeCopy.description}
          </p>
        </div>

        {/* Session Expired Notice (S0-T16-2) */}
        {searchParams?.get('reason') === 'session-expired' && (
          <Alert
            variant="warning"
            data-testid="session-expired-alert"
            className="text-xs animate-fadeIn"
          >
            Your session expired. Please sign in again.
          </Alert>
        )}

        {/* Redirect Notice */}
        {from && (
          <Alert variant="warning" className="text-xs">
            Authentication required to view <code className="font-mono text-amber-900">{from}</code>. Please sign in below.
          </Alert>
        )}

        {/* Clean Error Alert */}
        {errorMessage && (
          <Alert
            variant="error"
            data-testid="login-error-alert"
            className="text-xs animate-fadeIn"
          >
            {errorMessage}
          </Alert>
        )}

        {/* SSO Notice */}
        {ssoNotice && (
          <Alert
            variant="info"
            data-testid="sso-notice"
            className="text-xs animate-fadeIn"
          >
            {ssoNotice}
          </Alert>
        )}

        {/* Login Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-lg shadow-neutral-900/5 bg-white border border-neutral-200/80 rounded-2xl">
          {step === 'password' && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={resetToEmailStep}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
                data-testid="login-back-to-email"
              >
                ← Change email
              </button>

              <div
                className={`rounded-xl border px-4 py-3 ${
                  identify?.portal ? portalAccent[identify.portal] : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                }`}
                data-testid="login-purpose-banner"
              >
                <p className="text-[11px] uppercase tracking-wider font-semibold opacity-70">
                  {identify?.recognized ? 'Signing in to' : 'Next step'}
                </p>
                <p className="text-sm font-semibold mt-0.5">{purposeCopy.title}</p>
                <p className="text-xs mt-2 font-mono text-neutral-600">{email.trim()}</p>
                {identify?.mfaRequired && (
                  <p className="text-[11px] mt-2 font-medium">Two-factor authentication required after password.</p>
                )}
                {identify?.accountStatus === 'suspended' && (
                  <p className="text-[11px] mt-2 font-medium text-red-700">
                    This account appears suspended. Sign-in may be blocked.
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleEmailContinue} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="block text-xs font-medium text-neutral-700">
                  Work email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  disabled={isIdentifying}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  data-testid="work-email-input"
                  className="h-10 text-sm bg-white"
                />
              </div>

              <TextureButton
                type="submit"
                variant="brand"
                size="default"
                disabled={isIdentifying}
                data-testid="login-continue-button"
                className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/25 cursor-pointer rounded-xl"
              >
                {isIdentifying ? 'Checking…' : 'Continue →'}
              </TextureButton>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-medium text-neutral-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsForgotPasswordOpen(true)}
                    className="text-xs text-primary hover:text-primary-hover font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <PasswordField
                  id="password"
                  name="password"
                  required
                  autoFocus
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  data-testid="password-input"
                  className="h-10 text-sm bg-white"
                />
              </div>

              <TextureButton
                type="submit"
                variant="brand"
                size="default"
                disabled={isLoading}
                data-testid="login-submit-button"
                className="w-full h-11 text-sm font-semibold shadow-md shadow-primary/25 cursor-pointer rounded-xl"
              >
                {isLoading ? 'Signing In...' : 'Sign In →'}
              </TextureButton>
            </form>
          )}

          {step === 'email' && (
            <>
              {/* SSO Separator */}
              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-neutral-200/80 w-full" />
                <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-neutral-600 font-medium shrink-0">
                  or continue with
                </span>
                <div className="border-t border-neutral-200/80 w-full" />
              </div>

              {/* SSO Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isIdentifying}
                  onClick={() => handleSsoClick('Google')}
                  data-testid="google-sso-button"
                  className="h-10 flex items-center justify-center gap-2 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50/80 text-xs font-medium text-neutral-700 transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-neutral-200"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                  <span>Google SSO</span>
                </button>

                <button
                  type="button"
                  disabled={isIdentifying}
                  onClick={() => handleSsoClick('Microsoft')}
                  data-testid="microsoft-sso-button"
                  className="h-10 flex items-center justify-center gap-2 px-3 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50/80 text-xs font-medium text-neutral-700 transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-2 focus:ring-neutral-200"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  <span>Microsoft SSO</span>
                </button>
              </div>
            </>
          )}
        </Card>

        
        <Footer
          variant="auth"
          showLogo={false}
          showPoweredBy={false}
          secondaryActionText="Need an account? Contact your company administrator"
        />
      </div>

      {/* MFA TOTP Verification Modal */}
      <Dialog
        open={isMfaOpen}
        onClose={() => {
          if (!mfaLoading) {
            setIsMfaOpen(false);
            setPreAuthToken(null);
            setMfaCode('');
            setMfaError(null);
          }
        }}
        className="!bg-white !border-neutral-200 !text-neutral-900 shadow-xl"
        data-testid="mfa-dialog"
      >
        <form onSubmit={handleMfaSubmit}>
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center mb-2 text-primary">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <DialogTitle className="!text-neutral-900 font-medium">Two-Factor Authentication</DialogTitle>
            <DialogDescription className="text-neutral-500 font-light">
              Enter your authenticator app code or a one-time backup code (XXXX-XXXX).
            </DialogDescription>
          </DialogHeader>

          <DialogContent>
            {mfaError && (
              <Alert variant="error" className="text-xs mb-4">
                {mfaError}
              </Alert>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="mfa-code-input"
                  className="block text-xs font-medium text-neutral-700"
                >
                  Authenticator or backup code
                </label>
              </div>

              <Input
                id="mfa-code-input"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                maxLength={9}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))
                }
                placeholder="000000 or XXXX-XXXX"
                disabled={mfaLoading}
                autoFocus
                data-testid="mfa-totp-input"
                size="lg"
                className="text-center tracking-[0.5em] font-mono text-xl py-3"
              />
              <p className="text-[11px] text-neutral-500 text-center font-light">
                For dev testing, any 6-digit code (e.g. 123456) is accepted.
              </p>
            </div>
          </DialogContent>

          <DialogFooter className="mt-6 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={mfaLoading}
              onClick={() => {
                setIsMfaOpen(false);
                setPreAuthToken(null);
                setMfaCode('');
                setMfaError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                mfaLoading ||
                !isMfaCodeReady(mfaCode)
              }
              isLoading={mfaLoading}
              data-testid="mfa-submit-button"
              className="bg-primary hover:bg-primary-hover text-white border-transparent font-medium"
            >
              Verify Code 
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      {/* Forgot Password Guidance Dialog (BUG-06) */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="max-w-md w-full p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-neutral-900">
              Reset Your Password
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              HelloSmart accounts are provisioned and secured by your organization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm text-neutral-700 bg-neutral-50 p-4 rounded-xl border border-neutral-200/80">
            {email && (
              <p className="text-xs font-semibold text-neutral-900 pb-1 border-b border-neutral-200">
                Account: <span className="font-mono text-primary font-normal">{email}</span>
              </p>
            )}
            <div className="space-y-2 text-xs leading-relaxed">
              <p>
                <strong>For Candidates:</strong> Contact the hiring manager or company administrator who invited you. They can instantly resend your invitation with a fresh password setup link.
              </p>
              <p>
                <strong>For Company Administrators:</strong> Reach out to your primary account owner or contact HelloSmart Support at{' '}
                <a href="mailto:support@hellosmart.ai" className="text-primary underline font-medium">
                  support@hellosmart.ai
                </a>.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 text-xs text-neutral-700 space-y-1">
            <span className="font-semibold block text-primary">Already have an invitation or reset token?</span>
            <Link
              href={email ? `/accept-invite?email=${encodeURIComponent(email)}` : '/accept-invite'}
              onClick={() => setIsForgotPasswordOpen(false)}
              className="inline-flex items-center text-primary font-medium hover:underline pt-0.5"
            >
              Enter invitation token to set new password &rarr;
            </Link>
          </div>

          <DialogFooter className="pt-2 flex justify-end">
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsForgotPasswordOpen(false)}
              className="text-xs"
            >
              Back to Sign In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginForm />
    </Suspense>
  );
}
