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
    container: 'bg-[#f4f6f8] text-[#3d4754] border-[#d8dee6]',
    dot: 'bg-[#8a95a3]',
  },
  primary: {
    container: 'bg-[#fff7ed] text-[#c2410c] border-[#fed7aa] font-medium',
    dot: 'bg-primary',
  },
  success: {
    container: 'bg-[#e8f7ee] text-[#0f6b38] border-[#b7e3c8]',
    dot: 'bg-[#1aa053]',
  },
  warning: {
    container: 'bg-[#fff7e8] text-[#9a4d05] border-[#f3d7a1]',
    dot: 'bg-[#d97706]',
  },
  danger: {
    container: 'bg-[#fdeeee] text-[#9b1c1c] border-[#f3c4c4]',
    dot: 'bg-[#d64545]',
  },
  info: {
    container: 'bg-[#eaf3fb] text-[#0b2f5c] border-[#b7d4ee]',
    dot: 'bg-[#1b6bba]',
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
        className={`inline-flex items-center font-medium rounded-sm border tracking-[0.02em] uppercase select-none ${
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
    color: 'bg-success',
    pingColor: 'bg-success',
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
    color: 'bg-danger',
    pingColor: 'bg-danger',
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
