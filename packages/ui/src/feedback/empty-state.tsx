import React, { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode | undefined;
  title: string;
  description: string;
  action?:
    | {
        label: string;
        onClick?: (() => void) | undefined;
        href?: string | undefined; 
      }
    | undefined;
  className?: string | undefined;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-md border border-dashed border-[#d8dee6] bg-white ${className}`}
    >
      <div className="w-12 h-12 rounded-sm bg-[#eaf3fb] border border-[#b7d4ee] flex items-center justify-center text-nav mb-4">
        {icon || (
          <svg
            className="w-7 h-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>

      <h3 className="text-base font-medium text-neutral-900 mb-1">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-sm mb-6 leading-relaxed font-normal">
        {description}
      </p>

      {action && (
        <>
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-nav-accent"
            >
              {action.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-full hover:bg-primary-hover transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-nav-accent"
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}

