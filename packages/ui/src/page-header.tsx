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
    default: 'bg-slate-800 text-slate-300 border-slate-700',
    success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    info: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60',
  };

  return (
    <div className="mb-8 flex flex-col gap-3 pb-5 border-b border-slate-800/80">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {crumb.href ? (
                <a
                  href={crumb.href}
                  className="hover:text-slate-200 transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-slate-200">{crumb.label}</span>
              )}
              {idx < breadcrumbs.length - 1 && <span className="text-slate-600">/</span>}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
              {title}
            </h1>
            {badge && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  badgeColors[badge.variant || 'default']
                }`}
              >
                {badge.text}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-slate-400 max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
