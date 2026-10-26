import React from 'react';
import { NotFound } from '@hs/ui';

export default function RootNotFound(): React.JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas text-neutral-900 p-4">
      <NotFound
        title="Page Not Found"
        description="The requested route does not exist, has been moved, or belongs to another organization."
        actionHref="/"
        actionLabel="Back to Home"
      />
    </div>
  );
}
