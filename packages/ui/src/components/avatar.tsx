'use client';

import React, { HTMLAttributes, forwardRef, useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AvatarShape = 'circle' | 'rounded';
export type AvatarVariant = 'orange' | 'subtle' | 'neutral' | 'dark';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | undefined;
  alt?: string | undefined;
  name?: string | undefined;
  initials?: string | undefined;
  fallback?: string | undefined;
  size?: AvatarSize | undefined;
  shape?: AvatarShape | undefined;
  variant?: AvatarVariant | undefined;
  status?: ('online' | 'busy' | 'offline' | 'away') | undefined;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[9px] font-bold tracking-tight', status: 'w-1.5 h-1.5 bottom-0 right-0' },
  sm: { container: 'w-8 h-8', text: 'text-[11px] font-bold tracking-tight', status: 'w-2 h-2 bottom-0 right-0' },
  md: { container: 'w-10 h-10', text: 'text-xs font-bold tracking-tight', status: 'w-2.5 h-2.5 bottom-0 right-0' },
  lg: { container: 'w-12 h-12', text: 'text-sm font-bold tracking-tight', status: 'w-3 h-3 bottom-0 right-0' },
  xl: { container: 'w-16 h-16', text: 'text-base font-bold tracking-tight', status: 'w-3.5 h-3.5 bottom-0.5 right-0.5' },
};

const variantClasses: Record<AvatarVariant, string> = {
  orange: 'bg-primary text-white border border-primary-600/30 shadow-xs shadow-primary/20',
  subtle: 'bg-primary/10 text-primary border border-primary/25',
  neutral: 'bg-neutral-100 text-neutral-800 border border-neutral-200',
  dark: 'bg-chrome text-white border border-chrome-muted',
};

const statusDotColors = {
  online: 'bg-success ring-white',
  busy: 'bg-danger ring-white',
  away: 'bg-warning ring-white',
  offline: 'bg-neutral-400 ring-white',
};

/**
 * Extracts exactly 2 uppercase letters for the avatar initials
 */
export function getTwoLetterInitials(name?: string, alt?: string, explicit?: string): string {
  if (explicit) {
    return explicit.trim().substring(0, 2).toUpperCase();
  }
  const source = (name || alt || '').trim();
  if (!source) return 'HS';

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    return (first + second).toUpperCase();
  }

  if (source.length >= 2) {
    return source.substring(0, 2).toUpperCase();
  }

  return (source + source).toUpperCase();
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      initials,
      fallback,
      size = 'md',
      shape = 'circle',
      variant = 'orange',
      status,
      className = '',
      ...props
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const cfg = sizeClasses[size];
    const twoLetters = getTwoLetterInitials(name, alt, initials || fallback);
    const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-md';
    const variantClass = variantClasses[variant] || variantClasses.orange;

    return (
      <div
        ref={ref}
        className={`relative inline-flex items-center justify-center shrink-0 select-none ${variantClass} ${
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
          <span className={`${cfg.text} select-none leading-none`}>{twoLetters}</span>
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
  spacing?: ('tight' | 'normal' | 'loose') | undefined;
  children: React.ReactNode;
}

export function AvatarGroup({
  max = 4,
  size = 'md',
  spacing = 'normal',
  className = '',
  children,
  ...props
}: AvatarGroupProps): React.JSX.Element {
  const childArray = React.Children.toArray(children);
  const visible = childArray.slice(0, max);
  const remaining = childArray.length - max;
  const cfg = sizeClasses[size];

  const spacingClass =
    spacing === 'tight' ? '-space-x-3' : spacing === 'loose' ? '-space-x-1' : '-space-x-2';

  return (
    <div className={`flex items-center ${spacingClass} ${className}`} {...props}>
      {visible.map((child, idx) => {
        const renderedChild = React.isValidElement<AvatarProps>(child)
          ? React.cloneElement(child, {
              size: child.props.size || size,
            })
          : child;

        return (
          <div key={idx} className="relative ring-2 ring-white rounded-full shrink-0">
            {renderedChild}
          </div>
        );
      })}
      {remaining > 0 && (
        <div
          className={`relative inline-flex items-center justify-center rounded-full bg-neutral-100 border border-neutral-200 ring-2 ring-white text-neutral-800 font-semibold shrink-0 ${
 cfg.container
 } ${cfg.text}`}
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
