'use client';

import React, { forwardRef, ReactNode, HTMLAttributes } from 'react';

export interface BreadcrumbItemData {
  label: string;
  href?: string | undefined;
  icon?: ReactNode | undefined;
}

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items?: BreadcrumbItemData[] | undefined;
  separator?: ReactNode | undefined;
  children?: ReactNode | undefined;
}

export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, separator, children, className = '', ...props }, ref) => {
    const defaultSeparator = (
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

    const sep = separator ?? defaultSeparator;

    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={`flex items-center text-sm font-medium text-neutral-500 ${className}`}
        {...props}
      >
        <ol className="flex items-center space-x-2">
          {items
            ? items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                return (
                  <li key={idx} className="flex items-center space-x-2">
                    {idx > 0 && <span aria-hidden="true">{sep}</span>}
                    {isLast || !item.href ? (
                      <span
                        className="flex items-center gap-1.5 text-neutral-900 font-semibold truncate max-w-xs"
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {item.icon}
                        {item.label}
                      </span>
                    ) : (
                      <a
                        href={item.href}
                        className="flex items-center gap-1.5 text-neutral-500 hover:text-primary transition-colors"
                      >
                        {item.icon}
                        {item.label}
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
  children: ReactNode;
}

export const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ href, className = '', children, ...props }, ref) => (
    <a
      ref={ref}
      href={href}
      className={`text-neutral-500 hover:text-primary transition-colors ${className}`}
      {...props}
    >
      {children}
    </a>
  )
);
BreadcrumbLink.displayName = 'BreadcrumbLink';

export interface BreadcrumbPageProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export const BreadcrumbPage = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
  ({ className = '', children, ...props }, ref) => (
    <span
      ref={ref}
      aria-current="page"
      className={`text-neutral-900 font-semibold ${className}`}
      {...props}
    >
      {children}
    </span>
  )
);
BreadcrumbPage.displayName = 'BreadcrumbPage';

export interface BreadcrumbSeparatorProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode | undefined;
}

export const BreadcrumbSeparator = forwardRef<HTMLSpanElement, BreadcrumbSeparatorProps>(
  ({ className = '', children, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={`text-neutral-300 select-none ${className}`}
      {...props}
    >
      {children ?? (
        <svg
          className="w-4 h-4 inline text-neutral-300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
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
      <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-2xl p-4">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full bg-neutral-50 border border-neutral-300 rounded-lg px-3.5 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          autoFocus
        />
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
