import React, { forwardRef, ReactNode } from 'react';
import { HelloSmartLogo, HELLOSMART_LOGO_SRC } from '../hellosmart/logo';

export type EmailFooterVariant =
  | 'minimal'
  | 'social'
  | 'nav'
  | 'app-download'
  | 'comprehensive'
  | 'preferences';

export interface EmailFooterLink {
  label: string;
  href: string;
}

export interface EmailFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmailFooterVariant | undefined;
  brandName?: string | undefined;
  companyAddress?: string | undefined;
  copyrightYear?: (number | string) | undefined;
  unsubscribeHref?: string | undefined;
  preferencesHref?: string | undefined;
  links?: EmailFooterLink[] | undefined;
  appStoreHref?: string | undefined;
  googlePlayHref?: string | undefined;
  showPoweredBy?: boolean | undefined;
  poweredByText?: string | undefined;
  poweredByHref?: string | undefined;
  children?: ReactNode | undefined;
}

const DEFAULT_LEGAL_LINKS: EmailFooterLink[] = [
  { label: 'Privacy Policy', href: 'https://hellosmart.ai/privacy' },
  { label: 'Terms of Service', href: 'https://hellosmart.ai/terms' },
  { label: 'Security', href: 'https://hellosmart.ai/security' },
  { label: 'Support', href: 'https://hellosmart.ai/support' },
];

export const EmailFooter = forwardRef<HTMLDivElement, EmailFooterProps>(
  (
    {
      variant = 'social',
      brandName = 'HelloSmart.ai',
      companyAddress = '100 Main Street, Suite 500, San Francisco, CA 94105',
      copyrightYear = new Date().getFullYear(),
      unsubscribeHref = 'https://hellosmart.ai/unsubscribe',
      preferencesHref = 'https://hellosmart.ai/email-preferences',
      links = DEFAULT_LEGAL_LINKS,
      appStoreHref = 'https://apps.apple.com',
      googlePlayHref = 'https://play.google.com',
      showPoweredBy = true,
      poweredByText = 'Powered by HelloSmart.ai',
      poweredByHref = 'https://hellosmart.ai',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const finalCopyright = `© ${copyrightYear} ${brandName} Inc. All rights reserved.`;

    const SocialIconsRow = () => (
      <div className="flex items-center justify-center gap-3 text-neutral-400">
        <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="p-1 hover:text-neutral-700 transition-colors" aria-label="X (Twitter)">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="p-1 hover:text-neutral-700 transition-colors" aria-label="LinkedIn">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
        </a>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-1 hover:text-neutral-700 transition-colors" aria-label="GitHub">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
        </a>
      </div>
    );

    const AppDownloadBadges = () => (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <a
          href={appStoreHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white transition-colors"
          aria-label="Download on the App Store"
        >
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.76 1.05-1.82.93-2.88-.91.04-2.02.61-2.67 1.37-.58.67-1.08 1.76-.94 2.79 1.02.08 2.06-.52 2.68-1.28z"/></svg>
          <div className="text-left leading-none">
            <span className="text-[9px] block text-neutral-300">Download on the</span>
            <span className="text-xs font-semibold block mt-0.5 tracking-tight">App Store</span>
          </div>
        </a>

        <a
          href={googlePlayHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white transition-colors"
          aria-label="Get it on Google Play"
        >
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M3.609 1.814L13.792 12 3.61 22.186a2.016 2.016 0 01-.22-.916V2.73c0-.334.08-.65.219-.916zm11.238 11.241l2.368-2.369-10.97-6.333 8.602 8.702zm2.368-2.369l3.056 1.765a1.5 1.5 0 010 2.598l-3.056 1.765-2.05-2.064 2.05-2.064zm-3.423 3.424l-8.602 8.702 10.97-6.333-2.368-2.369z"/></svg>
          <div className="text-left leading-none">
            <span className="text-[9px] block text-neutral-300">GET IT ON</span>
            <span className="text-xs font-semibold block mt-0.5 tracking-tight">Google Play</span>
          </div>
        </a>
      </div>
    );

    // 1. Minimal Variant
    if (variant === 'minimal') {
      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full py-6 px-6 text-center text-xs text-neutral-400 space-y-2 border-t border-neutral-100 ${className}`}
          {...props}
        >
          <p className="leading-relaxed">
            This email was sent to you as an account notification from {brandName}.
            {unsubscribeHref && (
              <>
                {' '}
                <a href={unsubscribeHref} className="text-neutral-500 underline hover:text-neutral-800">
                  Unsubscribe
                </a>
              </>
            )}
          </p>
          <p className="text-[11px] text-neutral-400">{companyAddress}</p>
          {children}
        </footer>
      );
    }

    // 2. Preferences Center Variant
    if (variant === 'preferences') {
      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full py-8 px-6 text-center text-xs text-neutral-500 space-y-3.5 border-t border-neutral-100 bg-neutral-50/50 ${className}`}
          {...props}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-neutral-600">
            <a href={preferencesHref} className="hover:text-neutral-900 underline">
              Manage Preferences
            </a>
            <span className="text-neutral-300">•</span>
            <a href={unsubscribeHref} className="hover:text-neutral-900 underline">
              Unsubscribe from all
            </a>
            <span className="text-neutral-300">•</span>
            <a href="https://hellosmart.ai/privacy" className="hover:text-neutral-900 underline">
              Privacy Policy
            </a>
          </div>

          <p className="text-[11px] text-neutral-400 leading-relaxed max-w-md mx-auto">
            HelloSmart.ai &bull; {companyAddress}
          </p>

          <p className="text-[11px] text-neutral-400">
            {finalCopyright}
          </p>
          {children}
        </footer>
      );
    }

    // 3. App Download Variant
    if (variant === 'app-download') {
      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full py-8 px-6 text-center text-xs text-neutral-500 space-y-5 border-t border-neutral-100 ${className}`}
          {...props}
        >
          <div>
            <span className="text-xs font-semibold text-neutral-700 uppercase tracking-wider block mb-3">
              Download the app
            </span>
            <AppDownloadBadges />
          </div>

          <div className="pt-2">
            <SocialIconsRow />
          </div>

          <div className="space-y-1 text-[11px] text-neutral-400 pt-2 border-t border-neutral-100">
            <p>{companyAddress}</p>
            <p>{finalCopyright}</p>
          </div>
          {children}
        </footer>
      );
    }

    // 4. Comprehensive Variant (Badges + Links + Social + PoweredBy)
    if (variant === 'comprehensive') {
      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full py-8 px-6 text-center text-xs text-neutral-500 space-y-5 border-t border-neutral-100 ${className}`}
          {...props}
        >
          <AppDownloadBadges />

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500">
            {links.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-neutral-800 transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <SocialIconsRow />

          <div className="space-y-1.5 text-[11px] text-neutral-400 pt-2 border-t border-neutral-100">
            <p>{companyAddress}</p>
            <div className="flex items-center justify-center gap-2">
              <span>{finalCopyright}</span>
              {showPoweredBy && (
                <>
                  <span>•</span>
                  <a href={poweredByHref} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-700 underline font-medium">
                    {poweredByText}
                  </a>
                </>
              )}
            </div>
          </div>
          {children}
        </footer>
      );
    }

    // 5. Navigation Links Variant
    if (variant === 'nav') {
      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full py-6 px-6 text-center text-xs text-neutral-500 space-y-3.5 border-t border-neutral-100 ${className}`}
          {...props}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-neutral-600">
            {links.map((link) => (
              <a key={link.label} href={link.href} className="hover:text-neutral-900 transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <p className="text-[11px] text-neutral-400">
            {companyAddress} &bull; {finalCopyright}
          </p>
          {children}
        </footer>
      );
    }

    // Default: Social Variant
    return (
      <footer
        ref={ref}
        role="contentinfo"
        className={`w-full py-6 px-6 text-center text-xs text-neutral-500 space-y-3.5 border-t border-neutral-100 ${className}`}
        {...props}
      >
        <SocialIconsRow />

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
          <a href={unsubscribeHref} className="hover:text-neutral-700 underline">
            Unsubscribe
          </a>
          <span>•</span>
          <a href="https://hellosmart.ai/privacy" className="hover:text-neutral-700">
            Privacy Policy
          </a>
          <span>•</span>
          <a href="https://hellosmart.ai/terms" className="hover:text-neutral-700">
            Terms of Service
          </a>
        </div>

        <p className="text-[11px] text-neutral-400">
          {finalCopyright} &bull; {companyAddress}
        </p>
        {children}
      </footer>
    );
  }
);

EmailFooter.displayName = 'EmailFooter';

