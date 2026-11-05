'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { InvitationDetailsResponse } from '@hs/contracts';
import { RateLimitedError, validateInvitation, acceptInvitation } from '@/lib/api-client';
import { SetPasswordForm } from '@/components/auth/set-password-form';

// In-memory token storage fallback
let inMemoryToken: string | null = null;
const INVITE_TOKEN_STORAGE_KEY = 'hs_invite_token';

export function getStoredInviteToken(): string | null {
  if (typeof window === 'undefined') return inMemoryToken;
  try {
    return sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY) || inMemoryToken;
  } catch {
    return inMemoryToken;
  }
}

export function setStoredInviteToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
    }
  } catch {
    // sessionStorage unavailable or restricted
  }
}

function AcceptInviteContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(() => getStoredInviteToken());
  const [invitation, setInvitation] = useState<InvitationDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInvalid, setIsInvalid] = useState<boolean>(false);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    // If validation finished, do not re-run
    if (invitation || isInvalid || isRateLimited) {
      return;
    }

    // Step 2: Read token from query parameter or sessionStorage / in-memory fallback
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setStoredInviteToken(queryToken);
    }
    const rawToken = queryToken || getStoredInviteToken() || token;

    if (!rawToken) {
      setIsInvalid(true);
      setIsLoading(false);
      return;
    }

    setToken(rawToken);

    // Fetch invitation details from backend API
    validateInvitation(rawToken)
      .then((data) => {
        setInvitation(data);
        setIsLoading(false);

        // Strip token from address bar via history.replaceState (Step 2 & Step 5)
        // after successful validation so token is safely preserved in sessionStorage
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      })
      .catch((err: unknown) => {
        console.error('[AcceptInvite] Invitation validation failed:', err);
        if (err instanceof RateLimitedError) {
          setIsRateLimited(true);
        } else {
          // Token is invalid/expired: clear stored token so stale token is not re-attempted
          setStoredInviteToken(null);
          setIsInvalid(true);
        }
        setIsLoading(false);
      });
  }, [searchParams, invitation, isInvalid, isRateLimited, token]);

  const handleSuccess = () => {
    setStoredInviteToken(null);
    setIsSuccess(true);
    // On successful acceptance, redirect to /login with banner parameter
    router.push('/login?message=password_set');
  };

  const roleLabel =
    invitation?.role === 'company_admin'
      ? 'Company Administrator'
      : invitation?.role === 'candidate'
        ? 'Candidate'
        : invitation?.role;

  return (
    <>
      {/* Strict browser referrer policy for the invitation page */}
      <meta name="referrer" content="no-referrer" />

      <div className="w-full max-w-md mx-auto">
        <div className="bg-white px-6 py-8 shadow-xl ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10">
          {/* State 1: Loading verification */}
          {isLoading && (
            <div className="text-center py-8 space-y-4" aria-live="polite">
              <div
                className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent align-[-0.125em]"
                role="status"
                aria-label="Verifying invitation"
              />
              <p className="text-sm font-medium text-slate-600">
                Verifying your invitation link...
              </p>
            </div>
          )}

          {/* State 2: Invalid, expired, or used invitation */}
          {!isLoading && isInvalid && !isRateLimited && (
            <div className="text-center py-6 space-y-5" role="alert">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xl font-bold"
                aria-hidden="true"
              >
                !
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold text-slate-900">
                  Invitation Unavailable
                </h1>
                {/* Exact required copy from specification */}
                <p className="text-sm text-slate-600">
                  This link is no longer valid. Please ask your admin to resend the invite.
                </p>
              </div>
              <div className="pt-2">
                <a
                  href="/login"
                  className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Return to Sign In &rarr;
                </a>
              </div>
            </div>
          )}

          {/* State 2b: Rate limited */}
          {!isLoading && isRateLimited && (
            <div className="text-center py-6 space-y-5" role="alert">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xl font-bold"
                aria-hidden="true"
              >
                !
              </div>
              <div className="space-y-2">
                <h1 className="text-lg font-semibold text-slate-900">
                  Too Many Attempts
                </h1>
                <p className="text-sm text-slate-600">
                  Too many attempts have been made. Please wait a moment and try again.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Retry &rarr;
                </button>
              </div>
            </div>
          )}

          {/* State 3: Valid invitation -> Display context & Set Password form */}
          {!isLoading && !isInvalid && !isRateLimited && invitation && token && !isSuccess && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Set Your Password
                </h1>
                <p className="text-sm text-slate-500">
                  Welcome to{' '}
                  <span className="font-semibold text-slate-800">
                    {invitation.orgName}
                  </span>
                </p>
              </div>

              {/* Invited user context badge */}
              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200/80 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-500">Email:</span>
                  <span className="font-semibold text-slate-900">
                    {invitation.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-500">Role:</span>
                  <span className="capitalize font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                    {roleLabel}
                  </span>
                </div>
              </div>

              {/* The password creation form */}
              <SetPasswordForm
                token={token}
                email={invitation.email}
                companyName={invitation.orgName}
                onSubmitPassword={async ({ newPassword }) => {
                  try {
                    await acceptInvitation({ token, password: newPassword });
                    return { success: true };
                  } catch (err: unknown) {
                    const message =
                      err instanceof Error ? err.message : 'Failed to accept invitation';
                    return {
                      success: false,
                      errorMessage: message,
                    };
                  }
                }}
                onSuccess={handleSuccess}
              />
            </div>
          )}

          {/* State 4: Success confirmation */}
          {isSuccess && (
            <div className="text-center py-6 space-y-4" role="status">
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl font-bold"
                aria-hidden="true"
              >
                ✓
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-slate-900">
                  Password Set Successfully
                </h2>
                <p className="text-sm text-slate-600">
                  Redirecting to sign in...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function AcceptInvitePage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md mx-auto text-center py-12">
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
