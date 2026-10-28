import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant | undefined;
  size?: BadgeSize | undefined;
  dot?: boolean | undefined;
  children?: ReactNode | undefined;
}

const badgeVariants: Record<BadgeVariant, { container: string; dot: string }> = {
  default: {
    container: 'bg-neutral-100 text-neutral-800 border-neutral-200',
    dot: 'bg-neutral-500',
  },
  primary: {
    container: 'bg-primary/10 text-primary border-primary/30 font-medium',
    dot: 'bg-primary',
  },
  success: {
    container: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  info: {
    container: 'bg-primary/10 text-primary border-primary/25',
    dot: 'bg-primary',
  },
};

const badgeSizes: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1.5',
  md: 'text-xs px-2.5 py-1 gap-2',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'sm', dot = false, className = '', children, ...props }, ref) => {
    const config = badgeVariants[variant];

    return (
      <span
        ref={ref}
        className={`inline-flex items-center font-medium rounded-full border tracking-wide select-none ${
          config.container
        } ${badgeSizes[size]} ${className}`}
        {...props}
      >
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

export type StatusType = 'online' | 'offline' | 'busy' | 'idle' | 'error';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  label?: string | undefined;
  ping?: boolean | undefined;
}

const statusConfig: Record<StatusType, { color: string; pingColor: string; defaultLabel: string }> = {
  online: {
    color: 'bg-emerald-500',
    pingColor: 'bg-emerald-400',
    defaultLabel: 'Online',
  },
  offline: {
    color: 'bg-neutral-400',
    pingColor: 'bg-neutral-300',
    defaultLabel: 'Offline',
  },
  busy: {
    color: 'bg-primary',
    pingColor: 'bg-primary/75',
    defaultLabel: 'Busy',
  },
  idle: {
    color: 'bg-neutral-500',
    pingColor: 'bg-neutral-400',
    defaultLabel: 'Idle',
  },
  error: {
    color: 'bg-rose-500',
    pingColor: 'bg-rose-400',
    defaultLabel: 'Error',
  },
};

export const StatusIndicator = forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ status, label, ping = false, className = '', ...props }, ref) => {
    const config = statusConfig[status];
    const text = label ?? config.defaultLabel;

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-2 text-xs font-medium text-neutral-700 ${className}`}
        {...props}
      >
        <span className="relative flex h-2 w-2">
          {ping && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.pingColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
        </span>
        {text && <span>{text}</span>}
      </span>
    );
  }
);
StatusIndicator.displayName = 'StatusIndicator';

export type OrgStatus = 'provisioned' | 'trial_active' | 'trial_expired' | 'paid_active' | 'suspended';

export interface StatusTagProps extends HTMLAttributes<HTMLSpanElement> {
  status: OrgStatus;
  'data-testid'?: string | undefined;
}

const orgStatusConfig: Record<OrgStatus, { label: string; variant: BadgeVariant }> = {
  provisioned: { label: 'Provisioned', variant: 'default' },
  trial_active: { label: 'Trial Active', variant: 'primary' },
  trial_expired: { label: 'Trial Expired', variant: 'warning' },
  paid_active: { label: 'Paid Active', variant: 'success' },
  suspended: { label: 'Suspended', variant: 'danger' },
};

export const StatusTag = forwardRef<HTMLSpanElement, StatusTagProps>(
  ({ status, className = '', ...props }, ref) => {
    const config = orgStatusConfig[status] || orgStatusConfig.provisioned;

    return (
      <Badge
        ref={ref}
        variant={config.variant}
        dot
        className={className}
        {...props}
      >
        {config.label}
      </Badge>
    );
  }
);
StatusTag.displayName = 'StatusTag';
