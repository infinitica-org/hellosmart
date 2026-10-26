import type { Metadata, Viewport } from 'next';
import '@hs/ui/styles/fonts.css';
import '@hs/ui/styles/tokens.css';
import './globals.css';



export const metadata: Metadata = {
  title: 'HelloSmart.ai — Hire by Doing',
  description:
    'AI-native work simulation for hiring. Real work, real AI tools, controlled cloud workspaces.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-canvas text-neutral-900 font-sans font-normal antialiased selection:bg-primary/20 selection:text-primary"
      >
        {children}
      </body>
    </html>
  );
}

