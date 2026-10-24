import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  description?: string | undefined;
  icon?: ReactNode | undefined;
  trend?:
    | {
        value: string;
        direction?: ('up' | 'down' | 'neutral') | undefined;
      }
    | undefined;
  badge?: ReactNode | undefined;
  href?: string | undefined;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    { label, value, description, icon, trend, badge, href, className = '', ...props },
    ref
  ) => {
    const trendColors = {
      up: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60',
      down: 'text-rose-400 bg-rose-950/60 border-rose-800/60',
      neutral: 'text-slate-400 bg-slate-800 border-slate-700',
    };

    const cardContent = (
      <>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {label}
          </div>
          {icon && (
            <div className="w-8 h-8 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0">
              {icon}
            </div>
          )}
          {badge}
        </div>

        <div className="flex items-baseline gap-3 mt-3">
          <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
            {value}
          </div>
          {trend && (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                trendColors[trend.direction || 'neutral']
              }`}
            >
              {trend.direction === 'up' && '↑'}
              {trend.direction === 'down' && '↓'}
              {trend.value}
            </span>
          )}
        </div>

        {description && (
          <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {description}
          </div>
        )}
      </>
    );

    const baseClasses =
      'rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md p-6 shadow-lg shadow-black/20 transition-all duration-200';

    if (href) {
      return (
        <a
          href={href}
          className={`${baseClasses} hover:border-indigo-500/40 hover:shadow-indigo-500/10 hover:-translate-y-0.5 block ${className}`}
        >
          {cardContent}
        </a>
      );
    }

    return (
      <div ref={ref} className={`${baseClasses} ${className}`} {...props}>
        {cardContent}
      </div>
    );
  }
);
StatCard.displayName = 'StatCard';

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const FilterBar = forwardRef<HTMLDivElement, FilterBarProps>(
  ({ className = '', children, ...props }, ref) => (
    <div
      ref={ref}
      className={`flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);
FilterBar.displayName = 'FilterBar';

export interface SearchAndSortToolbarProps extends HTMLAttributes<HTMLDivElement> {
  searchQuery?: string | undefined;
  onSearchChange?: ((query: string) => void) | undefined;
  searchPlaceholder?: string | undefined;
  children?: ReactNode | undefined;
}

export const SearchAndSortToolbar = forwardRef<HTMLDivElement, SearchAndSortToolbarProps>(
  (
    {
      searchQuery,
      onSearchChange,
      searchPlaceholder = 'Search...',
      children,
      className = '',
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${className}`}
      {...props}
    >
      <div className="relative flex-1">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-slate-900/70 border border-slate-700/80 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
);
SearchAndSortToolbar.displayName = 'SearchAndSortToolbar';

export interface BulkActionBarProps extends HTMLAttributes<HTMLDivElement> {
  selectedCount: number;
  onClear?: (() => void) | undefined;
  children: ReactNode;
}

export const BulkActionBar = forwardRef<HTMLDivElement, BulkActionBarProps>(
  ({ selectedCount, onClear, children, className = '', ...props }, ref) => {
    if (selectedCount <= 0) return null;
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-indigo-950/80 border border-indigo-800/80 text-sm text-indigo-200 shadow-xl ${className}`}
        {...props}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{selectedCount}</span>
          <span>selected</span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-indigo-400 hover:text-indigo-300 underline ml-2"
            >
              Deselect all
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    );
  }
);
BulkActionBar.displayName = 'BulkActionBar';

export interface TimelineProps extends HTMLAttributes<HTMLOListElement> {
  children: ReactNode;
}

export const Timeline = forwardRef<HTMLOListElement, TimelineProps>(
  ({ className = '', children, ...props }, ref) => (
    <ol ref={ref} className={`relative border-l border-slate-800 ml-3 space-y-6 ${className}`} {...props}>
      {children}
    </ol>
  )
);
Timeline.displayName = 'Timeline';

export interface TimelineItemProps extends Omit<HTMLAttributes<HTMLLIElement>, 'title'> {
  title: ReactNode;
  time?: ReactNode | undefined;
  icon?: ReactNode | undefined;
  children?: ReactNode | undefined;
}

export const TimelineItem = forwardRef<HTMLLIElement, TimelineItemProps>(
  ({ title, time, icon, children, className = '', ...props }, ref) => (
    <li ref={ref} className={`ml-6 ${className}`} {...props}>
      <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-slate-400">
        {icon || <span className="w-2 h-2 rounded-full bg-indigo-500" />}
      </span>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        {time && <time className="text-xs text-slate-500">{time}</time>}
      </div>
      {children && <div className="mt-1 text-xs text-slate-400">{children}</div>}
    </li>
  )
);
TimelineItem.displayName = 'TimelineItem';

export const MetricCard = StatCard;
export type MetricCardProps = StatCardProps;
