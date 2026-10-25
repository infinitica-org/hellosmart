import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
import { Inter, Instrument_Serif } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500'],
});

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-display',
  weight: '400',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.hellosmart.ai'),
  title: 'HelloSmart.ai Documentation',
  description: 'Role-protected internal developer and product knowledge base.',
};

import { Toaster } from '@/components/ui/sonner';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} dark`}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen bg-fd-background text-fd-foreground antialiased">
        <RootProvider>{children}</RootProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
