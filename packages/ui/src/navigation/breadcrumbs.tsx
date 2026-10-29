'use client';

import React, { forwardRef, ReactNode, HTMLAttributes } from 'react';

export type BreadcrumbSeparatorVariant = 'chevron' | 'slash' | 'arrow' | 'dot';
export type BreadcrumbVariant = 'default' | 'icons' | 'pills' | 'ghost';

export interface BreadcrumbItemData {
  label: string;
  href?: string | undefined;
  icon?: ReactNode | undefined;
}

export function BreadcrumbHomeIcon({ className = 'w-4 h-4' }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

export function renderSeparator(variant: BreadcrumbSeparatorVariant): ReactNode {
  switch (variant) {
    case 'slash':
      return <span className="text-xs text-neutral-300 font-mono select-none px-0.5">/</span>;
    case 'arrow':
      return (
        <svg
          className="w-3.5 h-3.5 text-neutral-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      );
    case 'dot':
      return <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 flex-shrink-0" aria-hidden="true" />;
    case 'chevron':
    default:
      return (
        <svg
          className="w-4 h-4 text-neutral-300 flex-shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
  }
}

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items?: BreadcrumbItemData[] | undefined;
  separator?: ReactNode | undefined;
  separatorVariant?: BreadcrumbSeparatorVariant | undefined;
  variant?: BreadcrumbVariant | undefined;
  showHomeIcon?: boolean | undefined;
  homeHref?: string | undefined;
  children?: ReactNode | undefined;
}

export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  (
    {
      items,
      separator,
      separatorVariant = 'chevron',
      variant = 'default',
      showHomeIcon = false,
      homeHref,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const sep = separator ?? renderSeparator(separatorVariant);

    // Compute active items list, prepending Home icon if requested and not already present
    let computedItems = items ? [...items] : undefined;
    if (computedItems && showHomeIcon && computedItems.length > 0) {
      const first = computedItems[0];
      if (first && !first.icon) {
        computedItems[0] = {
          ...first,
          icon: <BreadcrumbHomeIcon className="w-3.5 h-3.5 text-neutral-400 group-hover:text-primary transition-colors" />,
        };
      }
    }

    const containerPillClass =
      variant === 'pills'
        ? 'inline-flex items-center bg-neutral-100/80 px-3 py-1.5 rounded-md border border-neutral-200/60 shadow-2xs'
        : '';

    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={`flex items-center text-sm font-medium text-neutral-500 ${containerPillClass} ${className}`.trim()}
        {...props}
      >
        <ol className="flex items-center space-x-2">
          {computedItems
            ? computedItems.map((item, idx) => {
                const isLast = idx === computedItems.length - 1;
                const isPill = variant === 'pills';

                return (
                  <li key={idx} className="flex items-center space-x-2">
                    {idx > 0 && <span aria-hidden="true" className="flex items-center">{sep}</span>}
                    {isLast || !item.href ? (
                      <span
                        className={`flex items-center gap-1.5 text-neutral-900 font-semibold truncate max-w-xs ${
 isPill ? 'bg-white px-2.5 py-1 rounded-sm border border-neutral-200/80 shadow-2xs text-xs' : ''
 }`}
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {item.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-500">{item.icon}</span>}
                        <span>{item.label}</span>
                      </span>
                    ) : (
                      <a
                        href={item.href}
                        className={`group flex items-center gap-1.5 text-neutral-500 hover:text-primary transition-colors ${
 isPill ? 'hover:bg-white/80 px-2 py-0.5 rounded-md text-xs' : ''
 }`}
                      >
                        {item.icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-400 group-hover:text-primary transition-colors">{item.icon}</span>}
                        <span>{item.label}</span>
                      </a>
                    )}
                  </li>
                );
              })
            : children}
        </ol>
      </nav>
    );
  }
);
Breadcrumbs.displayName = 'Breadcrumbs';

export interface BreadcrumbItemProps extends HTMLAttributes<HTMLLIElement> {
  children: ReactNode;
}

export const BreadcrumbItem = forwardRef<HTMLLIElement, BreadcrumbItemProps>(
  ({ className = '', children, ...props }, ref) => (
    <li ref={ref} className={`flex items-center space-x-2 ${className}`} {...props}>
      {children}
    </li>
  )
);
BreadcrumbItem.displayName = 'BreadcrumbItem';

export interface BreadcrumbLinkProps extends HTMLAttributes<HTMLAnchorElement> {
  href: string;
  icon?: ReactNode | undefined;
  children: ReactNode;
}

export const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ href, icon, className = '', children, ...props }, ref) => (
    <a
      ref={ref}
      href={href}
      className={`group inline-flex items-center gap-1.5 text-neutral-500 hover:text-primary transition-colors ${className}`}
      {...props}
    >
      {icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-400 group-hover:text-primary transition-colors">{icon}</span>}
      <span>{children}</span>
    </a>
  )
);
BreadcrumbLink.displayName = 'BreadcrumbLink';

export interface BreadcrumbPageProps extends HTMLAttributes<HTMLSpanElement> {
  icon?: ReactNode | undefined;
  children: ReactNode;
}

export const BreadcrumbPage = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  ({ icon, className = '', children, ...props }, ref) => (
    <span
      ref={ref}
      aria-current="page"
      className={`inline-flex items-center gap-1.5 text-neutral-900 font-semibold ${className}`}
      {...props}
    >
      {icon && <span className="w-4 h-4 shrink-0 flex items-center justify-center text-neutral-700">{icon}</span>}
      <span>{children}</span>
    </span>
  )
);
BreadcrumbPage.displayName = 'BreadcrumbPage';

export interface BreadcrumbSeparatorProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BreadcrumbSeparatorVariant | undefined;
  children?: ReactNode | undefined;
}

export const BreadcrumbSeparator = forwardRef<HTMLSpanElement, BreadcrumbSeparatorProps>(
  ({ variant = 'chevron', className = '', children, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={`text-neutral-300 select-none flex items-center ${className}`}
      {...props}
    >
      {children ?? renderSeparator(variant)}
    </span>
  )
);
BreadcrumbSeparator.displayName = 'BreadcrumbSeparator';

export interface CommandMenuProps {
  open: boolean;
  onClose: () => void;
  placeholder?: string | undefined;
  children?: ReactNode | undefined;
}

export function CommandMenu({
  open,
  onClose,
  placeholder = 'Type a command or search...',
  children,
}: CommandMenuProps): React.JSX.Element | null {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-chrome/50" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-md border border-neutral-200 bg-white shadow-lg p-4">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full bg-neutral-50 border border-neutral-300 rounded-sm px-3.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-nav-accent/20 focus:border-primary"
          autoFocus
        />
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
