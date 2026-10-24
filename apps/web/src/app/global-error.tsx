'use client';

import React, { useEffect } from 'react';
import { ServerError } from '@hs/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  useEffect(() => {
    console.error('GlobalError caught:', error.digest || error.message);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
        <ServerError
          title="System Error"
          description="A critical platform error occurred. Our engineering team has been notified."
          onRetry={reset}
          actionHref="/"
          actionLabel="Return to HelloSmart"
        />
      </body>
    </html>
  );
}
