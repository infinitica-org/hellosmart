'use client';

import React, { useState } from 'react';

export interface HelloSmartLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number | undefined;
  /** Custom classes for image */
  className?: string | undefined;
  /** Source override if needed */
  src?: string | undefined;
  /** Alt text */
  alt?: string | undefined;
  /** Fallback background color */
  bgVariant?: 'transparent' | 'dark' | 'glow' | undefined;
  /** Force vector SVG rendering instead of raster image */
  variant?: 'image' | 'vector' | undefined;
  /** Rounded corner style for image and container */
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | undefined;
}

export const HELLOSMART_LOGO_SRC = '/hellosmart.png';

const SIZE_MAP: Record<string, { sizeClass: string; px: number }> = {
  xs: { sizeClass: 'w-5 h-5', px: 20 },
  sm: { sizeClass: 'w-7 h-7', px: 28 },
  md: { sizeClass: 'w-9 h-9', px: 36 },
  lg: { sizeClass: 'w-12 h-12', px: 48 },
  xl: { sizeClass: 'w-14 h-14', px: 56 },
  '2xl': { sizeClass: 'w-16 h-16', px: 64 },
};

/**
 * Official HelloSmart.ai Vector Brand Icon
 * Renders instantly without depending on external asset loading
 */
export function HelloSmartIcon({
  size = 36,
  className = '',
}: {
  size?: number | string | undefined;
  className?: string | undefined;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none shrink-0 ${className}`}
      aria-label="HelloSmart Logo"
    >
      <defs>
        <linearGradient id="hs-orange-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ff7043" />
          <stop offset="100%" stopColor="#ff5722" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#hs-orange-grad)" />
      <path
        d="M13 11V29M27 11V29M13 20H27"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="2.4" fill="white" />
    </svg>
  );
}

/**
 * Official HelloSmart.ai Logo component from @hs/ui
 * Renders the brand logo asset with high quality and graceful vector fallback
 */
export function HelloSmartLogo({
  size = 'md',
  className = '',
  src = HELLOSMART_LOGO_SRC,
  alt = 'HelloSmart.ai Logo',
  bgVariant = 'transparent',
  variant = 'image',
  rounded = 'lg',
  style,
  onError,
  ...props
}: HelloSmartLogoProps): React.JSX.Element {
  const [imageError, setImageError] = useState(false);

  const roundedClasses: Record<'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full', string> = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    '2xl': 'rounded-2xl',
    full: 'rounded-full',
  };

  const roundedClass = roundedClasses[rounded] || 'rounded-lg';

  const fallbackConfig = { sizeClass: 'w-9 h-9', px: 36 };
  const sizeConfig: { sizeClass: string; px: number } =
    typeof size === 'number'
      ? { sizeClass: '', px: size }
      : (SIZE_MAP[size] ?? fallbackConfig);

  const dimensionStyles: React.CSSProperties =
    typeof size === 'number'
      ? { width: `${size}px`, height: `${size}px` }
      : {};

  const bgStyles = {
    transparent: '',
    dark: 'bg-neutral-900 p-1 rounded-xl border border-neutral-800 shadow-md',
    glow: 'bg-neutral-900 p-1 rounded-xl border border-primary/30 shadow-lg shadow-primary/15',
  }[bgVariant];

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setImageError(true);
    onError?.(e);
  };

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${roundedClass} ${bgStyles} ${className}`}
      style={dimensionStyles}
    >
      {variant === 'vector' || imageError || !src ? (
        <HelloSmartIcon size={sizeConfig.px} className={`${sizeConfig.sizeClass} ${roundedClass}`} />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          width={sizeConfig.px}
          height={sizeConfig.px}
          className={`object-contain select-none ${roundedClass} ${sizeConfig.sizeClass}`}
          style={{ ...dimensionStyles, ...style }}
          loading="eager"
          onError={handleImageError}
          {...props}
        />
      )}
    </div>
  );
}

