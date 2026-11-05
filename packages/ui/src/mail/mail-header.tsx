import React, { forwardRef, ReactNode } from 'react';
import { HelloSmartLogo, HELLOSMART_LOGO_SRC } from '../hellosmart/logo';

export type EmailHeaderVariant = 'simple' | 'with-nav' | 'with-social' | 'centered' | 'with-action';

export interface EmailHeaderNavLink {
  label: string;
  href: string;
}

export interface EmailHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmailHeaderVariant | undefined;
  brandName?: string | undefined;
  logoSrc?: string | undefined;
  logoSize?: number | undefined;
  tagline?: string | undefined;
  links?: EmailHeaderNavLink[] | undefined;
  actionText?: string | undefined;
  actionHref?: string | undefined;
  children?: ReactNode | undefined;
}

const DEFAULT_NAV_LINKS: EmailHeaderNavLink[] = [
  { label: 'Home', href: 'https://hellosmart.ai' },
  { label: 'Blog', href: 'https://hellosmart.ai/blog' },
  { label: 'Account', href: 'https://hellosmart.ai/login' },
  { label: 'Support', href: 'https://hellosmart.ai/support' },
];

export const EmailHeader = forwardRef<HTMLDivElement, EmailHeaderProps>(
  (
    {
      variant = 'simple',
      brandName = 'HelloSmart.ai',
      logoSrc = HELLOSMART_LOGO_SRC,
      logoSize = 36,
      tagline,
      links = DEFAULT_NAV_LINKS,
      actionText = 'Sign in',
      actionHref = 'https://hellosmart.ai/login',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // 1. Centered Header Variant
    if (variant === 'centered') {
      return (
        <header
          ref={ref}
          role="banner"
          className={`w-full py-6 px-6 text-center border-b border-neutral-100 ${className}`}
          {...props}
        >
          <div className="inline-flex flex-col items-center justify-center gap-2">
            <HelloSmartLogo
              size={logoSize ?? 40}
              src={logoSrc}
              rounded="xl"
              className="shrink-0"
              alt={brandName}
            />
            <div>
              <span className="text-xl font-bold tracking-tight text-neutral-900">
                {brandName}
              </span>
              {tagline && (
                <p className="text-xs text-neutral-400 font-medium tracking-wide uppercase mt-0.5">
                  {tagline}
                </p>
              )}
            </div>
          </div>
          {children}
        </header>
      );
    }

    // 2. Header with Navigation Links
    if (variant === 'with-nav') {
      return (
        <header
          ref={ref}
          role="banner"
          className={`w-full py-5 px-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-100 ${className}`}
          {...props}
        >
          <div className="flex items-center gap-2.5">
            <HelloSmartLogo
              size={logoSize ?? 32}
              src={logoSrc}
              rounded="xl"
              className="shrink-0"
              alt={brandName}
            />
            <span className="text-base font-bold tracking-tight text-neutral-900">
              {brandName}
            </span>
          </div>

          <nav aria-label="Email header navigation" className="flex items-center gap-4 text-xs font-medium text-neutral-600">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-900 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
          {children}
        </header>
      );
    }

    // 3. Header with Action CTA
    if (variant === 'with-action') {
      return (
        <header
          ref={ref}
          role="banner"
          className={`w-full py-5 px-6 flex items-center justify-between gap-4 border-b border-neutral-100 ${className}`}
          {...props}
        >
          <div className="flex items-center gap-2.5">
            <HelloSmartLogo
              size={logoSize ?? 32}
              src={logoSrc}
              rounded="xl"
              className="shrink-0"
              alt={brandName}
            />
            <span className="text-base font-bold tracking-tight text-neutral-900">
              {brandName}
            </span>
          </div>

          {actionText && (
            <a
              href={actionHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-md transition-colors"
            >
              {actionText} &rarr;
            </a>
          )}
          {children}
        </header>
      );
    }

    // 4. Header with Social Icons
    if (variant === 'with-social') {
      return (
        <header
          ref={ref}
          role="banner"
          className={`w-full py-5 px-6 flex items-center justify-between gap-4 border-b border-neutral-100 ${className}`}
          {...props}
        >
          <div className="flex items-center gap-2.5">
            <HelloSmartLogo
              size={logoSize ?? 32}
              src={logoSrc}
              rounded="xl"
              className="shrink-0"
              alt={brandName}
            />
            <span className="text-base font-bold tracking-tight text-neutral-900">
              {brandName}
            </span>
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            {/* Social Icons representation */}
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
          {children}
        </header>
      );
    }

    // Default: Simple Header (Logo + Brand Title + optional Tagline)
    return (
      <header
        ref={ref}
        role="banner"
        className={`w-full py-5 px-6 flex items-center justify-between border-b border-neutral-100 ${className}`}
        {...props}
      >
        <div className="flex items-center gap-2.5">
          <HelloSmartLogo
            size={logoSize ?? 32}
            src={logoSrc}
            rounded="xl"
            className="shrink-0"
            alt={brandName}
          />
          <div>
            <span className="text-base font-bold tracking-tight text-neutral-900">
              {brandName}
            </span>
            {tagline && (
              <p className="text-[11px] text-neutral-400 font-medium tracking-wide uppercase">
                {tagline}
              </p>
            )}
          </div>
        </div>
        {children}
      </header>
    );
  }
);

EmailHeader.displayName = 'EmailHeader';

