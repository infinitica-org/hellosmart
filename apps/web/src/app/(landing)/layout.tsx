import React from 'react';

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas-alt text-neutral-900 font-sans antialiased selection:bg-primary/20 selection:text-neutral-900">
      {children}
    </div>
  );
}

