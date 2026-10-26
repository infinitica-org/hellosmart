import React from 'react';
import { HelloSmartLogo, HELLOSMART_LOGO_SRC } from './hellosmart/logo';

export interface BrandMarkProps {
  /** If true, hides the "Powered by hellosmart.ai" caption per BR-28 white-label entitlement */
  whiteLabel?: boolean | undefined;
  className?: string | undefined;
  showLogo?: boolean | undefined;
  size?: ('sm' | 'md' | 'lg') | undefined;
  logoSrc?: string | undefined;
}

export function BrandMark({
  whiteLabel = false,
  className = '',
  showLogo = true,
  size = 'md',
  logoSrc = HELLOSMART_LOGO_SRC,
}: BrandMarkProps): React.JSX.Element {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const logoSizes: Record<'sm' | 'md' | 'lg', 'sm' | 'md' | 'lg'> = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 font-medium select-none ${className}`}>
      {showLogo && (
        <HelloSmartLogo
          size={logoSizes[size]}
          src={logoSrc}
          className="transition-transform duration-200 hover:scale-105"
        />
      )}

      <div className="flex flex-col">
        <span className={`font-medium tracking-tight text-neutral-900 ${sizeClasses[size]}`}>
          HelloSmart<span className="text-primary">.ai</span>
        </span>
        {!whiteLabel && (
          <span className="text-[10px] text-neutral-500 tracking-wider font-normal -mt-0.5">
            Powered by hellosmart<span className="text-primary">.ai</span>
          </span>
        )}
      </div>
    </div>
  );
}
