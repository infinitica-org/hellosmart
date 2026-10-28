import React, { ReactNode } from 'react';
import { HelloSmartLogo, HELLOSMART_LOGO_SRC } from './hellosmart/logo';

export type BrandMarkVariant = 'mixed' | 'black' | 'white';

export interface BrandMarkProps {
  /** If true, hides the "Powered by hellosmart.ai" caption per BR-28 white-label entitlement */
  whiteLabel?: boolean | undefined;
  /** Whether to show the subtitle / "Powered by" caption. When false, renders only title */
  showSubtitle?: boolean | undefined;
  /** Custom subtitle override */
  subtitle?: ReactNode | undefined;
  className?: string | undefined;
  showLogo?: boolean | undefined;
  size?: ('sm' | 'md' | 'lg' | 'xl') | undefined;
  /** Direct logo size override (xs, sm, md, lg, xl, 2xl, or numeric px) */
  logoSize?: ('xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number) | undefined;
  logoSrc?: string | undefined;
  logoVariant?: ('image' | 'vector') | undefined;
  logoRounded?: ('none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full') | undefined;
  /**
   * Color variant for full brand text:
   * - 'mixed': Black title with brand orange .ai (Default)
   * - 'black': Solid black full text throughout
   * - 'white': Crisp white full text for dark backgrounds
   */
  variant?: BrandMarkVariant | undefined;
  /** Whether to show the text alongside the logo. Set false for logo-only */
  fullText?: boolean | undefined;
  /** Optional custom title override */
  customTitle?: ReactNode | undefined;
}

export function BrandMark({
  whiteLabel = false,
  showSubtitle,
  subtitle,
  className = '',
  showLogo = true,
  size = 'md',
  logoSize,
  logoSrc = HELLOSMART_LOGO_SRC,
  logoVariant = 'image',
  logoRounded = 'lg',
  variant = 'mixed',
  fullText = true,
  customTitle,
}: BrandMarkProps): React.JSX.Element {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  };

  const logoSizes: Record<'sm' | 'md' | 'lg' | 'xl', 'sm' | 'md' | 'lg' | 'xl'> = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl',
  };

  // Subtitle is hidden if showSubtitle is false or whiteLabel is true
  const shouldShowSubtitle = showSubtitle !== undefined ? showSubtitle : !whiteLabel;

  // Color mappings per variant: mixed, black, white
  const textStyles = {
    mixed: {
      title: 'text-neutral-900',
      dotAi: 'text-primary',
      caption: 'text-neutral-500',
      captionAi: 'text-primary',
    },
    black: {
      title: 'text-black',
      dotAi: 'text-black',
      caption: 'text-neutral-700',
      captionAi: 'text-black',
    },
    white: {
      title: 'text-white',
      dotAi: 'text-white',
      caption: 'text-neutral-300',
      captionAi: 'text-white',
    },
  }[variant];

  const effectiveLogoSize = logoSize ?? logoSizes[size];

  return (
    <div className={`inline-flex items-center gap-2.5 font-medium select-none ${className}`}>
      {showLogo && (
        <HelloSmartLogo
          size={effectiveLogoSize}
          src={logoSrc}
          variant={logoVariant}
          rounded={logoRounded}
          className="transition-transform duration-200 hover:scale-105"
        />
      )}

      {fullText && (
        <div className="flex flex-col">
          {customTitle ? (
            <span className={`font-semibold tracking-tight ${textStyles.title} ${sizeClasses[size]}`}>
              {customTitle}
            </span>
          ) : (
            <span className={`font-semibold tracking-tight ${textStyles.title} ${sizeClasses[size]}`}>
              HelloSmart<span className={textStyles.dotAi}>.ai</span>
            </span>
          )}
          {shouldShowSubtitle && (
            <span className={`text-[10px] tracking-wider font-normal -mt-0.5 ${textStyles.caption}`}>
              {subtitle || (
                <>
                  Powered by hellosmart<span className={textStyles.captionAi}>.ai</span>
                </>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
