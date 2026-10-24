'use client';

import React, { HTMLAttributes, forwardRef, useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | undefined;
  alt?: string | undefined;
  name?: string | undefined;
  size?: AvatarSize | undefined;
  shape?: AvatarShape | undefined;
  status?: ('online' | 'busy' | 'offline' | 'away') | undefined;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', status: 'w-1.5 h-1.5 bottom-0 right-0' },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2 h-2 bottom-0 right-0' },
  md: { container: 'w-10 h-10', text: 'text-sm', status: 'w-2.5 h-2.5 bottom-0 right-0' },
  lg: { container: 'w-12 h-12', text: 'text-base', status: 'w-3 h-3 bottom-0 right-0' },
  xl: { container: 'w-16 h-16', text: 'text-lg', status: 'w-3.5 h-3.5 bottom-0.5 right-0.5' },
};

const statusDotColors = {
  online: 'bg-emerald-400 ring-slate-950',
  busy: 'bg-amber-400 ring-slate-950',
  away: 'bg-indigo-400 ring-slate-950',
  offline: 'bg-slate-600 ring-slate-950',
};

function getInitials(name?: string, alt?: string): string {
  const source = name || alt || '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
  }
  return source.substring(0, 2).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      shape = 'circle',
      status,
      className = '',
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const cfg = sizeClasses[size];
    const initials = getInitials(name, alt);
    const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

    return (
      <div
        ref={ref}
        className={`relative inline-flex items-center justify-center shrink-0 select-none bg-slate-800 border border-slate-700/80 text-slate-200 font-semibold ${
          cfg.container
        } ${shapeClass} ${className}`}
        {...props}
      >
        {src && !imageError ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover ${shapeClass}`}
          />
        ) : (
          <span className={cfg.text}>{initials}</span>
        )}

        {status && (
          <span
            className={`absolute rounded-full ring-2 ${cfg.status} ${statusDotColors[status]}`}
            aria-label={`Status: ${status}`}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number | undefined;
  size?: AvatarSize | undefined;
  children: React.ReactNode;
}

export function AvatarGroup({
  max = 4,
  size = 'md',
  className = '',
  children,
  ...props
}: AvatarGroupProps): React.JSX.Element {
  const childArray = React.Children.toArray(children);
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;
  const cfg = sizeClasses[size];

  return (
    <div className={`flex items-center -space-x-2 overflow-hidden ${className}`} {...props}>
      {visible.map((child, idx) => (
        <div key={idx} className="ring-2 ring-slate-950 rounded-full">
          {child}
        </div>
      ))}
      {remaining > 0 && (
        <div
          className={`relative inline-flex items-center justify-center rounded-full bg-slate-800 border border-slate-700 ring-2 ring-slate-950 text-slate-300 font-medium ${
            cfg.container
          } ${cfg.text}`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}

