import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import '@hs/ui/styles/fonts.css';
import '@hs/ui/styles/tokens.css';
import './globals.css';
import { AppToastProvider } from '@/providers/toast-provider';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'HelloSmart.ai — Hire by Doing',
  description:
    'AI-native hiring platform. Real work, real AI tools, controlled cloud workspaces.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? undefined;

  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-canvas text-neutral-900 font-sans font-normal antialiased selection:bg-primary/20 selection:text-primary m-0 p-0"
      >
        <AppToastProvider>{children}</AppToastProvider>
      </body>
    </html>
  );
}
