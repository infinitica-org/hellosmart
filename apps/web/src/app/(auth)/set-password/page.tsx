'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Resolves the target destination for /set-password based on token presence and forced-reset flags.
 * - Legacy token invitations redirect to /accept-invite?token=...
 * - Authenticated or tokenless requests redirect to /change-password(?required=true) instead of dead-ending.
 */
export function resolveSetPasswordRedirect(
  searchParams: URLSearchParams,
  hasMustResetCookie = false,
): string {
  const token = searchParams.get('token');
  if (token) {
    return `/accept-invite?${searchParams.toString()}`;
  }

  const isRequired = hasMustResetCookie || searchParams.get('required') === 'true';
  return isRequired ? '/change-password?required=true' : '/change-password';
}

function SetPasswordRedirectContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hasMustReset =
      typeof document !== 'undefined' &&
      document.cookie.split(';').some((c) => c.trim().startsWith('hs_must_reset=true'));

    const target = resolveSetPasswordRedirect(searchParams, hasMustReset);
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="flex justify-center items-center py-12">
      <div
        role="status"
        aria-label="Redirecting..."
        className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
      />
    </div>
  );
}

export default function SetPasswordRedirectPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <SetPasswordRedirectContent />
    </Suspense>
  );
}
