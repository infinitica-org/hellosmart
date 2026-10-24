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
        className="w-4 h-4 text-slate-600 flex-shrink-0"
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
        className={`flex items-center text-sm font-medium text-slate-400 ${className}`}
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
                        className="flex items-center gap-1.5 text-slate-100 font-semibold truncate max-w-xs"
                        aria-current={isLast ? 'page' : undefined}
                      >
                        {item.icon}
                        {item.label}
                      </span>
                    ) : (
                      <a
                        href={item.href}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-400 transition-colors"
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
      className={`text-slate-400 hover:text-indigo-400 transition-colors ${className}`}
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
      className={`text-slate-100 font-semibold ${className}`}
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
      className={`text-slate-600 select-none ${className}`}
      {...props}
    >
      {children ?? (
        <svg
          className="w-4 h-4 inline"
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
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-800 bg-[#0c1222] shadow-2xl p-4">
        <input
          type="text"
          placeholder={placeholder}
          className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          autoFocus
        />
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
