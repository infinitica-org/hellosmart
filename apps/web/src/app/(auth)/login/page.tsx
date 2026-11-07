'use client';


import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { getSafeRedirectUrl } from '@/lib/safe-redirect';
import {
  describeSignInStep,
  type LoginIdentifyResult,
  type LoginPortal,
} from '@/lib/login-portal-meta';
import { ROUTES, LIMITS, ALERT_MESSAGES, PLACEHOLDERS, BRANDING } from '@/constants';
import {
  BrandMark,
  PasswordField,
  Button,
  TextureButton,
  Card,
  Alert,
  Input,
  Checkbox,
  Label,
  Avatar,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Footer,
  Edit,
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
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [ssoNotice, setSsoNotice] = useState<string | null>(null);

  // Session expired notice with 3s auto-dismiss & close button
  const isSessionExpired = searchParams?.get('reason') === 'session-expired';
  const [showSessionExpired, setShowSessionExpired] = useState(isSessionExpired);
  const [isSessionExpiredDismissing, setIsSessionExpiredDismissing] = useState(false);

  React.useEffect(() => {
    if (isSessionExpired) {
      setShowSessionExpired(true);
      setIsSessionExpiredDismissing(false);
      const timer = setTimeout(() => {
        setIsSessionExpiredDismissing(true);
        const removeTimer = setTimeout(() => {
          setShowSessionExpired(false);
        }, 300);
        return () => clearTimeout(removeTimer);
      }, LIMITS.TIMEOUTS.SESSION_BANNER_DISMISS_MS);
      return () => clearTimeout(timer);
    }
  }, [isSessionExpired]);

  const handleDismissSessionExpired = () => {
    setIsSessionExpiredDismissing(true);
    setTimeout(() => {
      setShowSessionExpired(false);
    }, 300);
  };

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

  const executeRedirect = async (role?: string, portal?: string) => {
    if (role === 'platform_admin' || portal === 'admin') {
      try {
        const mfaRes = await fetch('/api/auth/mfa/status', { credentials: 'same-origin' });
        if (mfaRes.ok) {
          const status = (await mfaRes.json().catch(() => null)) as { enrolled?: boolean } | null;
          if (status?.enrolled === false) {
            window.location.href = '/admin/settings/security';
            return;
          }
        }
      } catch {
        // Fall through to the normal portal redirect.
      }
    }
    const dest = getSafeRedirectUrl(from, role || '', portal);
    window.location.href = dest;
  };

  const resetToEmailStep = () => {
    setStep('email');
    setIdentify(null);
    setPassword('');
    setErrorMessage(null);
    setPasswordError(null);
    setIsShaking(false);
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
      const response = await fetch(ROUTES.API.AUTH_IDENTIFY, {
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
    setPasswordError(null);
    setSsoNotice(null);

    if (!email || !password) {
      setPasswordError('Please enter your password.');
      setErrorMessage('Please enter both your email address and password.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(ROUTES.API.AUTH_LOGIN, {
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
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 500);

        if (response.status === 401) {
          setPasswordError('Incorrect password. Please try again.');
          setErrorMessage(null);
        } else if (response.status === 403) {
          setErrorMessage('Your account or company is suspended. Please contact support.');
          setPasswordError(null);
        } else if (response.status === 429) {
          setPasswordError('Too many failed attempts. Please wait 15 minutes.');
          setErrorMessage(null);
        } else {
          if (response.status >= 500) {
            console.error('[login] BFF error', response.status, data);
            const msg =
              data?.detail ||
              data?.title ||
              'Unable to reach the authentication service. Please check your connection or try again.';
            setErrorMessage(msg);
          } else {
            const msg =
              data?.detail ||
              data?.title ||
              'Invalid credentials. Please verify your email and password.';
            setPasswordError(msg);
            setErrorMessage(msg);
          }
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
    admin: 'border-primary/20 bg-primary/5 text-primary',
    company: 'border-primary/25 bg-primary/5 text-neutral-900',
    candidate: 'border-info-border bg-info-muted text-info-foreground',
  };

  return (
    <main className="min-h-screen w-full bg-white text-neutral-900 font-sans flex flex-col lg:flex-row overflow-x-hidden">
      
      {/* ========================================================================= */}
      {/* LEFT COLUMN: Full Height Image Card (Equal 50% width)                     */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-1/2 w-full h-screen sticky top-0 p-3 sm:p-4 lg:p-4 xl:p-4 items-center justify-center shrink-0 min-w-0">
        <div className="relative w-full h-full rounded-[2rem] overflow-hidden shadow-2xl border border-neutral-800/80 bg-neutral-950">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/login-img.png"
            alt="HelloSmart AI Work Simulation"
            className="w-full h-full object-cover select-none"
          />
          {/* Top-left brand glyph badge matching screenshot */}
          <div className="absolute top-8 left-8 z-10 flex items-center gap-2.5 px-3 py-1.5 select-none">
            
            <span className="text-lg font-semibold tracking-widest uppercase text-white/95">
              HELLOSMART.AI
            </span>
          </div>

         
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT COLUMN: Full Screen Form (Equal 50% width)                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col justify-between min-h-screen w-full lg:w-1/2 shrink-0 min-w-0 p-6 sm:p-8 md:p-10 lg:p-10 xl:p-12 bg-white">
        
        {/* Top bar (mobile logo) */}
        <div className="w-full flex items-center justify-between mb-6">
          <Link href="/" className="lg:hidden inline-block">
            <BrandMark size="md" showSubtitle={false} />
          </Link>
          <div className="hidden lg:block" />
        </div>

        {/* Center Form Container */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto py-2">
          {/* Title & Subtitle */}
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-normal tracking-tight text-neutral-900 leading-[1.08]">
              Let us Connect
            </h1>
            <p className="text-sm text-neutral-500 font-normal mt-3 leading-relaxed">
              {step === 'email'
                ? 'Enter your work email. We will route you to the right portal.'
                : purposeCopy.description}
            </p>
          </div>

          {/* Password Set / Reset Confirmation Notice (BUG-14) */}
          {(searchParams?.get('message') === 'password_set' ||
            searchParams?.get('message') === 'password_changed') && (
            <div className="mb-5">
              <Alert
                variant="success"
                data-testid="password-set-success-alert"
                className="text-xs animate-fadeIn"
              >
                Your password has been set successfully. Please sign in with your new password.
              </Alert>
            </div>
          )}

          {/* Logged Out Notice */}
          {searchParams?.get('message') === 'logged_out' && (
            <div className="mb-5">
              <Alert
                variant="info"
                data-testid="logged-out-alert"
                className="text-xs animate-fadeIn"
              >
                You have been successfully signed out.
              </Alert>
            </div>
          )}

          {/* Session Expired Notice (S0-T16-2) with 3s auto-dismiss & close button */}
          {showSessionExpired && (
            <div
              className={`transition-all duration-300 ease-in-out ${
                isSessionExpiredDismissing
                  ? 'opacity-0 -translate-y-2 max-h-0 mb-0 overflow-hidden'
                  : 'opacity-100 max-h-24 mb-5'
              }`}
            >
              <Alert
                variant="warning"
                data-testid="session-expired-alert"
                onClose={handleDismissSessionExpired}
                className="text-xs"
              >
                Your session expired. Please sign in again.
              </Alert>
            </div>
          )}

          {/* Redirect Notice */}
          {from && (
            <Alert variant="warning" className="text-xs mb-5">
              Authentication required to view <code className="font-mono text-amber-900">{from}</code>. Please sign in below.
            </Alert>
          )}

          {/* Clean Error Alert */}
          {errorMessage && (
            <Alert
              variant="error"
              data-testid="login-error-alert"
              className="text-xs mb-5 animate-fadeIn"
            >
              {errorMessage}
            </Alert>
          )}

          {/* SSO Notice */}
          {ssoNotice && (
            <Alert
              variant="info"
              data-testid="sso-notice"
              className="text-xs mb-5 animate-fadeIn"
            >
              {ssoNotice}
            </Alert>
          )}

          {/* Step 2: Purpose context banner */}
          {step === 'password' && (
            <div className="space-y-3 mb-6">
              <div
                className="group relative rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/80 p-3.5 shadow-xs hover:border-neutral-300 transition-all"
                data-testid="login-purpose-banner"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={email.trim()}
                      size="md"
                      variant="orange"
                      shape="circle"
                      className="shrink-0 ring-2 font-sans ring-white shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-normal tracking-wider text-neutral-400 ">
                          {identify?.recognized ? (identify.portal ? identify.portal.toUpperCase() : 'ACCOUNT') : 'SIGNING IN'}
                        </span>
                        {identify?.mfaRequired && (
                          <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-warning-muted text-warning-foreground border border-warning-border font-medium">
                            2FA Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-normal text-neutral-900 truncate tracking-tight">
                        {email.trim()}
                      </p>
                      <p className="text-[11px] text-neutral-500 font-normal truncate">
                        {purposeCopy.title}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetToEmailStep}
                    className="shrink-0 inline-flex flex-row items-center gap-1.5 flex-nowrap whitespace-nowrap text-xs text-neutral-500 hover:text-neutral-900 font-medium px-2.5 h-8 rounded-lg"
                    data-testid="login-back-to-email"
                  >
                    <span>Change</span>
                    <Edit className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 shrink-0 inline-block" />
                  </Button>
                </div>

                {identify?.accountStatus === 'suspended' && (
                  <div className="mt-2.5 pt-2.5 border-t border-danger-border text-[11px] font-medium text-danger flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                    This account appears suspended. Sign-in may be blocked.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          {step === 'email' ? (
            <form onSubmit={handleEmailContinue} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-neutral-700">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoFocus
                  disabled={isIdentifying}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={PLACEHOLDERS.INPUTS.EMAIL}
                  data-testid="work-email-input"
                  className="h-11 text-sm bg-white border-neutral-200 rounded-lg focus:border-primary focus:ring-primary/20 transition-all"
                />
              </div>

              

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isIdentifying}
                disabled={isIdentifying}
                data-testid="login-continue-button"
                className="mt-2 font-semibold shadow-md shadow-primary/20"
              >
                Sign in
              </Button>

              <div className="space-y-2.5 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  size="lg"
                  disabled={isIdentifying}
                  onClick={() => handleSsoClick('Google')}
                  data-testid="google-sso-button"
                  className="border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  leftIcon={
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
                  }
                >
                  Sign in with Google
                </Button>

                <button
                  type="button"
                  disabled={isIdentifying}
                  onClick={() => handleSsoClick('Microsoft')}
                  data-testid="microsoft-sso-button"
                  className="w-full h-11 border border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50/80 text-neutral-700 text-sm font-medium rounded-lg transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" aria-hidden="true">
                    <path fill="#f35325" d="M1 1h10v10H1z" />
                    <path fill="#81bc06" d="M12 1h10v10H12z" />
                    <path fill="#05a6f0" d="M1 12h10v10H1z" />
                    <path fill="#ffba08" d="M12 12h10v10H12z" />
                  </svg>
                  <span>Sign in with Microsoft</span>
                </button>
              </div>

              <div className="text-center pt-6 text-xs text-neutral-500">
                <span>Haven&apos;t joined yet? </span>
                <a
                  href={BRANDING.CAL_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-900 font-semibold underline underline-offset-2 hover:text-primary"
                >
                  Sign up
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className={`space-y-1.5 ${isShaking ? 'animate-shake' : ''}`}>
                <Label htmlFor="password" className="text-xs font-medium text-neutral-700">
                  Password
                </Label>
                <PasswordField
                  id="password"
                  name="password"
                  required
                  autoFocus
                  disabled={isLoading}
                  value={password}
                  errorMessage={passwordError}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(null);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  data-testid="password-input"
                  className={`h-11 text-sm bg-white rounded-lg transition-all ${
                    passwordError
                      ? '!border-danger !ring-2 !ring-danger/20 shadow-xs shadow-danger/10'
                      : 'border-neutral-200 focus:border-primary focus:ring-primary/20'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className={`text-xs font-medium hover:underline transition-colors ${
                    passwordError
                      ? '!text-danger hover:!text-danger-foreground'
                      : '!text-neutral-600 hover:!text-danger'
                  }`}
                >
                  Forgot password?
                </Button>
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
                data-testid="login-submit-button"
                className="mt-2 font-semibold shadow-md shadow-primary/20"
              >
                Sign in
              </Button>
            </form>
          )}
        </div>

        {/* Bottom Footer Links */}
        <div className="w-full flex items-center justify-between text-xs text-neutral-400 pt-6">
          <div className="flex items-center gap-2">
            <span>© {new Date().getFullYear()} {BRANDING.APP_NAME}</span>
            <span className="hidden sm:inline text-neutral-300">•</span>
            <span className="hidden sm:inline text-neutral-400">All rights reserved</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-sans">
            <Link href={ROUTES.PUBLIC.PRIVACY} className="hover:text-neutral-600 transition-colors">Privacy</Link>
            <Link href={ROUTES.PUBLIC.TERMS} className="hover:text-neutral-600 transition-colors">Terms</Link>
            <Link href="/security" className="hover:text-neutral-600 transition-colors">Security</Link>
          </div>
        </div>
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
              <Lock className="w-5 h-5" strokeWidth={2} />
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
