'use client';

import React, { forwardRef, ReactNode } from 'react';
import { HelloSmartLogo, HELLOSMART_LOGO_SRC } from '../hellosmart/logo';

export type FooterVariant = 'auth' | 'simple' | 'marketing';

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Layout & visual variant:
   * - 'auth': Compact, centered footer optimized for Login, Password Change, and Auth flows
   * - 'simple': Minimal single-line bottom footer
   * - 'marketing': Multi-column rich footer with brand description and category columns
   */
  variant?: FooterVariant | undefined;

  /** Brand display name (Default: 'HelloSmart.ai') */
  brandName?: string | undefined;

  /** Custom brand title override */
  brandTitle?: ReactNode | undefined;

  /** Brand logo image source override (Default: '/hellosmart.png') */
  logoSrc?: string | undefined;

  /** Logo render style (Default: 'image') */
  logoVariant?: ('image' | 'vector') | undefined;

  /** Whether to show the brand logo on the footer (Default: true) */
  showLogo?: boolean | undefined;

  /** Custom logo size override */
  logoSize?: ('xs' | 'sm' | 'md' | 'lg' | number) | undefined;

  /** Custom logo rounded style */
  logoRounded?: ('none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full') | undefined;

  /** Copyright year override (Default: current year) */
  copyrightYear?: (number | string) | undefined;

  /** Full copyright text override */
  copyrightText?: string | undefined;

  /** Whether to show the copyright notice. Defaults to true for marketing/simple, false for auth */
  showCopyright?: boolean | undefined;

  /**
   * Whether to display the "Powered by HelloSmart.ai" attribution badge.
   * Per BR-28, shown by default; can be disabled when white-label entitlement is active.
   */
  showPoweredBy?: boolean | undefined;

  /** Custom text for Powered By attribution (Default: 'Powered by HelloSmart.ai') */
  poweredByText?: string | undefined;

  /** Custom URL for Powered By attribution */
  poweredByHref?: string | undefined;

  /** Legal / navigation links for auth and simple variants */
  links?: FooterLink[] | undefined;

  /** Multi-column navigation links for marketing variant */
  columns?: FooterColumn[] | undefined;

  /**
   * Optional contextual prompt / action for auth pages
   * (e.g. prompt="Forgot your password?" actionText="Reset Password" actionHref="/change-password")
   */
  authPrompt?: string | undefined;
  authActionText?: string | undefined;
  authActionHref?: string | undefined;
  onAuthActionClick?: (() => void) | undefined;

  /** Optional secondary auth action (e.g. "Need an account? Contact Admin") */
  secondaryActionText?: string | undefined;
  secondaryActionHref?: string | undefined;

  /** Marketing brand tagline / bio */
  tagline?: string | undefined;

  /** Custom slot for additional controls (e.g. theme toggle, language switcher) */
  children?: ReactNode | undefined;
}

const DEFAULT_AUTH_LINKS: FooterLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Security', href: '/security' },
  { label: 'Support', href: 'mailto:support@hellosmart.ai' },
];

const DEFAULT_MARKETING_COLUMNS: FooterColumn[] = [
  {
    title: 'Product',
    links: [
      { label: 'Workspaces', href: '/#workspaces' },
      { label: 'Reviewers', href: '/#agents' },
      { label: 'Templates', href: '/#templates' },
      { label: 'AI Proxy', href: '/#proxy' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { label: 'Engineering', href: '/#engineering' },
      { label: 'Hiring', href: '/#ai-hiring' },
      { label: 'Security', href: '/security' },
      { label: 'White Label', href: '/#white-label' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Docs', href: '/docs' },
      { label: 'API', href: '/api-docs' },
      { label: 'Architecture', href: '/docs/architecture' },
      { label: 'Book Demo', href: 'https://cal.com' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Consent', href: '/privacy#consent' },
      { label: 'Contact', href: 'mailto:contact@hellosmart.ai' },
    ],
  },
];

export const Footer = forwardRef<HTMLElement, FooterProps>(
  (
    {
      variant = 'auth',
      brandName = 'HelloSmart.ai',
      brandTitle,
      logoSrc = HELLOSMART_LOGO_SRC,
      logoVariant = 'image',
      showLogo,
      logoSize,
      logoRounded = 'xl',
      copyrightYear = new Date().getFullYear(),
      copyrightText,
      showCopyright,
      showPoweredBy = true,
      poweredByText = 'Powered by HelloSmart.ai',
      poweredByHref = 'https://hellosmart.ai',
      links = DEFAULT_AUTH_LINKS,
      columns = DEFAULT_MARKETING_COLUMNS,
      authPrompt,
      authActionText,
      authActionHref,
      onAuthActionClick,
      secondaryActionText,
      secondaryActionHref,
      tagline = 'Real work simulation for hiring. AI-governed workspaces with independent reviewer agents.',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const finalCopyright =
      copyrightText ?? `© ${copyrightYear} ${brandName} Inc. All rights reserved.`;

    // --------------------------------------------------------------------------
    // 1. Auth Variant (Optimized for Login & Password Change Pages)
    // --------------------------------------------------------------------------
    if (variant === 'auth') {
      const shouldShowLogo = showLogo ?? false;
      const shouldShowPoweredBy = showPoweredBy !== undefined ? showPoweredBy : false;
      const shouldShowCopyright = showCopyright !== undefined ? showCopyright : false;

      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full max-w-md mx-auto pt-2 pb-6 px-4 text-center space-y-3 select-none ${className}`}
          {...props}
        >
          {/* Optional Brand Logo & Title on Footer */}
          {shouldShowLogo && (
            <div className="flex items-center justify-center gap-2 mb-2">
              <HelloSmartLogo
                size={logoSize ?? 24}
                src={logoSrc}
                variant={logoVariant}
                rounded={logoRounded ?? 'xl'}
                className="shrink-0"
                alt={brandName}
              />
              <span className="font-semibold text-sm tracking-tight text-neutral-900">
                {brandTitle ?? brandName}
              </span>
            </div>
          )}

          {/* Optional Auth Contextual Help Prompt */}
          {(authPrompt || authActionText) && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-600 font-normal">
              {authPrompt && <span>{authPrompt}</span>}
              {authActionText && (
                authActionHref ? (
                  <a
                    href={authActionHref}
                    onClick={onAuthActionClick}
                    className="text-primary hover:text-primary-hover font-medium hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-accent rounded-xs"
                  >
                    {authActionText}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onAuthActionClick}
                    className="text-primary hover:text-primary-hover font-medium hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-accent rounded-xs cursor-pointer"
                  >
                    {authActionText}
                  </button>
                )
              )}
            </div>
          )}

          {/* Secondary Action Text */}
          {secondaryActionText && (
            <p className="text-xs text-neutral-500 font-light">
              {secondaryActionHref ? (
                <a
                  href={secondaryActionHref}
                  className="hover:text-neutral-800 hover:underline transition-colors font-normal text-neutral-700"
                >
                  {secondaryActionText}
                </a>
              ) : (
                secondaryActionText
              )}
            </p>
          )}

          {/* Legal / Policy Navigation Links */}
          {links && links.length > 0 && (
            <nav
              aria-label="Legal links"
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-neutral-400 font-light"
            >
              {links.map((link, idx) => (
                <React.Fragment key={link.href + idx}>
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    className="hover:text-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-accent rounded-xs"
                  >
                    {link.label}
                  </a>
                  {idx < links.length - 1 && (
                    <span className="text-neutral-300 select-none" aria-hidden="true">
                      &bull;
                    </span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Optional Copyright & Powered By */}
          {(shouldShowCopyright || shouldShowPoweredBy) && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1 text-[11px] text-neutral-400 font-light">
              {shouldShowCopyright && <span>{finalCopyright}</span>}
              {shouldShowPoweredBy && (
                <>
                  {shouldShowCopyright && <span className="hidden sm:inline text-neutral-300">&bull;</span>}
                  <a
                    href={poweredByHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100/90 hover:bg-neutral-200/90 border border-neutral-200 text-neutral-600 hover:text-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nav-accent shadow-2xs"
                    title="Powered by HelloSmart.ai hiring platform"
                  >
                    <HelloSmartLogo
                      size={16}
                      src={logoSrc}
                      variant={logoVariant}
                      rounded="full"
                      className="shrink-0"
                      alt="HelloSmart"
                    />
                    <span className="text-[11px] font-medium tracking-tight">
                      {poweredByText}
                    </span>
                  </a>
                </>
              )}
            </div>
          )}

          {children && <div className="pt-2">{children}</div>}
        </footer>
      );
    }

    // --------------------------------------------------------------------------
    // 2. Simple Variant (Clean Single-Line)
    // --------------------------------------------------------------------------
    if (variant === 'simple') {
      const shouldShowLogo = showLogo ?? true;
      return (
        <footer
          ref={ref}
          role="contentinfo"
          className={`w-full py-4 px-6 border-t border-neutral-200/80 bg-white/50 text-xs text-neutral-500 flex flex-wrap items-center justify-between gap-4 ${className}`}
          {...props}
        >
          <div className="flex items-center gap-2.5">
            {shouldShowLogo && (
              <HelloSmartLogo
                size={logoSize ?? 20}
                src={logoSrc}
                variant={logoVariant}
                rounded={logoRounded ?? 'md'}
                className="shrink-0"
                alt={brandName}
              />
            )}
            <span className="font-semibold text-neutral-800">{brandTitle ?? brandName}</span>
            <span className="text-neutral-300">•</span>
            <span>{finalCopyright}</span>
          </div>

          <div className="flex items-center gap-4">
            {links?.map((link, idx) => (
              <a
                key={`${link.href}-${idx}`}
                href={link.href}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className="hover:text-neutral-800 transition-colors"
              >
                {link.label}
              </a>
            ))}

            {showPoweredBy && (
              <a
                href={poweredByHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 text-[11px] text-neutral-600 hover:text-neutral-900 transition-colors shadow-2xs"
              >
                <HelloSmartLogo
                  size={14}
                  src={logoSrc}
                  variant={logoVariant}
                  rounded="full"
                  className="shrink-0"
                  alt="HelloSmart Logo"
                />
                <span className="font-medium">{poweredByText}</span>
              </a>
            )}
          </div>
        </footer>
      );
    }

    // --------------------------------------------------------------------------
    // 3. Marketing Variant (Multi-Column Layout)
    // --------------------------------------------------------------------------
    const shouldShowLogo = showLogo ?? true;

    return (
      <footer
        ref={ref}
        role="contentinfo"
        className={`w-full border-t border-neutral-200/80 bg-neutral-50/60 text-neutral-600 pt-12 pb-8 px-6 lg:px-8 ${className}`}
        {...props}
      >
        <div className="max-w-7xl mx-auto space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Brand column with Image Logo */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                {shouldShowLogo && (
                  <HelloSmartLogo
                    size={logoSize ?? 36}
                    src={logoSrc}
                    variant={logoVariant}
                    rounded={logoRounded ?? 'xl'}
                    className="shrink-0"
                    alt={brandName}
                  />
                )}
                <span className="text-lg font-bold tracking-tight text-neutral-900">
                  {brandTitle ?? brandName}
                </span>
              </div>
              <p className="text-sm text-neutral-500 max-w-sm leading-relaxed font-light">
                {tagline}
              </p>
              {showPoweredBy && (
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-white border border-neutral-200 text-xs text-neutral-600 shadow-2xs">
                  <HelloSmartLogo
                    size={16}
                    src={logoSrc}
                    variant={logoVariant}
                    rounded="full"
                    className="shrink-0"
                    alt="Verified Platform"
                  />
                  <span>Verified Platform Infrastructure</span>
                </div>
              )}
            </div>

            {/* Links Columns */}
            <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-6">
              {columns?.map((col) => (
                <div key={col.title} className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
                    {col.title}
                  </h4>
                  <ul className="space-y-2 text-sm">
                    {col.links.map((link, linkIdx) => (
                      <li key={`${col.title}-${link.href}-${link.label || linkIdx}`}>
                        <a
                          href={link.href}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          className="hover:text-primary transition-colors font-normal text-neutral-500 hover:text-neutral-900"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
            <span>{finalCopyright}</span>
            <div className="flex items-center gap-4">
              {links?.slice(0, 3).map((link, idx) => (
                <a
                  key={`${link.href}-${idx}`}
                  href={link.href}
                  className="hover:text-neutral-700 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        {children && <div className="mt-4">{children}</div>}
      </footer>
    );
  }
);

Footer.displayName = 'Footer';
