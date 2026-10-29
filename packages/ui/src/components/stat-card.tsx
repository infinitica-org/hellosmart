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
  compact?: boolean | undefined;
  size?: ('sm' | 'md' | 'lg') | undefined;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      label,
      value,
      description,
      icon,
      trend,
      badge,
      href,
      compact = false,
      size = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const trendColors = {
      up: 'text-success-foreground bg-success-muted border-success-border font-normal',
      down: 'text-danger-foreground bg-danger-muted border-danger-border font-normal',
      neutral: 'text-neutral-600 bg-neutral-100 border-neutral-200 font-normal',
    };

    const isCompact = compact || size === 'sm';

    const cardContent = (
      <>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider truncate">
            {label}
          </div>
          {icon && (
            <div className={`${isCompact ? 'w-6 h-6' : 'w-7 h-7'} rounded-sm bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 shrink-0`}>
              {icon}
            </div>
          )}
          {badge}
        </div>

        <div className={`flex items-baseline gap-2 ${isCompact ? 'mt-1' : 'mt-1.5'}`}>
          <div className={`${isCompact ? 'text-xl' : 'text-2xl sm:text-3xl'} font-semibold font-mono text-neutral-900 tracking-tight leading-none`}>
            {value}
          </div>
          {trend && (
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
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
          <div className={`text-[11px] text-neutral-500 font-normal leading-snug ${isCompact ? 'mt-1' : 'mt-1.5'}`}>
            {description}
          </div>
        )}
      </>
    );

    const paddingClass = isCompact ? 'p-3' : size === 'lg' ? 'p-5' : 'p-4';
    const baseClasses = `rounded-md border border-[#d8dee6] bg-white ${paddingClass}`;

    if (href) {
      return (
        <a
          href={href}
          className={`${baseClasses} hover:border-[#c3ccd6] block ${className}`}
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
      className={`flex flex-wrap items-center gap-2 p-3 rounded-md bg-neutral-50/80 border border-neutral-200 ${className}`}
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
          className="w-full bg-white border border-neutral-300 rounded-md px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-nav-accent/20 focus:border-primary"
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
        className={`flex items-center justify-between gap-4 px-4 py-3 rounded-md bg-chrome border border-chrome-muted text-sm text-white shadow-xl ${className}`}
        {...props}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{selectedCount}</span>
          <span>selected</span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-primary hover:text-primary-hover underline ml-2"
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
    <ol ref={ref} className={`relative border-l border-neutral-200 ml-3 space-y-6 ${className}`} {...props}>
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
      <span className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full bg-white border border-neutral-300 text-neutral-500">
        {icon || <span className="w-2 h-2 rounded-full bg-primary" />}
      </span>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-neutral-900">{title}</h4>
        {time && <time className="text-xs text-neutral-500">{time}</time>}
      </div>
      {children && <div className="mt-1 text-xs text-neutral-600">{children}</div>}
    </li>
  )
);
TimelineItem.displayName = 'TimelineItem';

export const MetricCard = StatCard;
export type MetricCardProps = StatCardProps;
