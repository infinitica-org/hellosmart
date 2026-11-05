import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white">
      {children}
    </div>
  );
}
