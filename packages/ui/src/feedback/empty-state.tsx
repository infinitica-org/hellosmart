import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

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
      className={`flex flex-col items-center justify-center p-8 sm:p-10 text-center rounded-md border border-dashed border-card-border bg-white ${className}`}
    >
      <div className="w-12 h-12 rounded-sm bg-info-muted border border-info-border flex items-center justify-center text-nav mb-4">
        {icon || <Inbox className="w-7 h-7 stroke-[1.75]" />}
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

