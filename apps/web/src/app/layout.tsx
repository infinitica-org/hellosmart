import React from 'react';
import './globals.css';
import { BrandMark } from '@hs/ui';

export const metadata = {
  title: 'HelloSmart.ai - Work Simulation for Hiring',
  description: 'AI-native hiring platform. Hire by doing.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col justify-between">
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <footer className="py-4 text-center text-xs text-slate-400">
          <BrandMark />
        </footer>
      </body>
    </html>
  );
}
