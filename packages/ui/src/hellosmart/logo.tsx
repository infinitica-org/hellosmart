import React from 'react';

export interface HelloSmartLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number | undefined;
  /** Custom classes for image */
  className?: string | undefined;
  /** Source override if needed */
  src?: string | undefined;
  /** Alt text */
  alt?: string | undefined;
  /** Fallback background color */
  bgVariant?: 'transparent' | 'dark' | 'glow' | undefined;
}

export const HELLOSMART_LOGO_SRC = '/hellosmart.png';

const SIZE_MAP: Record<string, { sizeClass: string; px: number }> = {
  xs: { sizeClass: 'w-5 h-5', px: 20 },
  sm: { sizeClass: 'w-7 h-7', px: 28 },
  md: { sizeClass: 'w-9 h-9', px: 36 },
  lg: { sizeClass: 'w-11 h-11', px: 44 },
  xl: { sizeClass: 'w-16 h-16', px: 64 },
};

/**
 * Official HelloSmart.ai Logo component from @hs/ui
 * Renders the brand logo asset with high quality and responsive sizing
 */
export function HelloSmartLogo({
  size = 'md',
  className = '',
  src = HELLOSMART_LOGO_SRC,
  alt = 'HelloSmart.ai Logo',
  bgVariant = 'transparent',
  style,
  ...props
}: HelloSmartLogoProps): React.JSX.Element {
  const fallbackConfig = { sizeClass: 'w-9 h-9', px: 36 };
  const sizeConfig: { sizeClass: string; px: number } =
    typeof size === 'number'
      ? { sizeClass: '', px: size }
      : (SIZE_MAP[size] ?? fallbackConfig);

  const dimensionStyles: React.CSSProperties = typeof size === 'number'
    ? { width: `${size}px`, height: `${size}px` }
    : {};

  const bgStyles = {
    transparent: '',
    dark: 'bg-neutral-900 p-1 rounded-xl border border-neutral-800 shadow-md',
    glow: 'bg-neutral-900 p-1 rounded-xl border border-primary/30 shadow-lg shadow-primary/15',
  }[bgVariant];

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 ${bgStyles} ${className}`}
      style={dimensionStyles}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={sizeConfig.px}
        height={sizeConfig.px}
        className={`object-contain select-none ${sizeConfig.sizeClass}`}
        style={{ ...dimensionStyles, ...style }}
        loading="eager"
        {...props}
      />
    </div>
  );
}
