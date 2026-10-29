import React, { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string | undefined;
  badge?:
    | {
        text: string;
        variant?: ('default' | 'success' | 'warning' | 'info') | undefined;
      }
    | undefined;
  breadcrumbs?: Array<{ label: string; href?: string | undefined }> | undefined;
  actions?: ReactNode | undefined;
}

export function PageHeader({
  title,
  description,
  badge,
  breadcrumbs,
  actions,
}: PageHeaderProps): React.JSX.Element {
  const badgeColors = {
    default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    success: 'bg-success-muted text-success-foreground border-success-border',
    warning: 'bg-warning-muted text-warning-foreground border-warning-border',
    info: 'bg-primary/10 text-primary border-primary/25',
  };

  return (
    <div className="mb-5 flex flex-col gap-2 pb-4 border-b border-[#d8dee6]">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500 font-light">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-neutral-900 transition-colors font-normal"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-neutral-800 font-normal">{crumb.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && <span className="text-neutral-300">/</span>}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {badge && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-normal border shrink-0 ${
 badgeColors[badge.variant || 'default']
 }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-xs sm:text-sm text-neutral-600 max-w-3xl leading-relaxed font-normal">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
