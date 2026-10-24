'use client';

import React, { useEffect } from 'react';
import { ErrorState } from '@hs/ui';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    // Log safe error telemetry without exposing internal details to UI
    console.error('RouteSegmentError caught:', error.digest || error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] p-4">
      <ErrorState
        title="Something went wrong"
        description="An unexpected error occurred while loading this view. You can retry the request or return to your dashboard."
        onRetry={reset}
        actionHref="/"
        actionLabel="Go to Dashboard"
      />
    </div>
  );
}
