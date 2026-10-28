import React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="mb-6 text-center">
        <span className="text-xl font-black tracking-tight text-slate-900">
          HelloSmart<span className="text-indigo-600">.ai</span>
        </span>
      </div>
      {children}
    </div>
  );
}
