'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SetPasswordRedirectContent(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    const target = params ? `/accept-invite?${params}` : '/accept-invite';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="flex justify-center items-center py-12">
      <div
        role="status"
        aria-label="Redirecting to invitation acceptance"
        className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"
      />
    </div>
  );
}

export default function SetPasswordRedirectPage(): React.JSX.Element {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <SetPasswordRedirectContent />
    </Suspense>
  );
}
