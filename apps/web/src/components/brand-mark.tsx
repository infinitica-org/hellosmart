import React from 'react';

export interface BrandMarkProps {
  /** If true, hides the "Powered by hellosmart.ai" caption per BR-28 white-label entitlement */
  whiteLabel?: boolean | undefined;
  className?: string | undefined;
  showLogo?: boolean | undefined;
  size?: ('sm' | 'md' | 'lg') | undefined;
}

export function BrandMark({
  whiteLabel = false,
  className = '',
  showLogo = true,
  size = 'md',
}: BrandMarkProps) {
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 font-medium select-none ${className}`}>
      {showLogo && (
        <div
          className={`${iconSizes[size]} rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-[1px] shadow-sm flex items-center justify-center`}
        >
          <div className="w-full h-full bg-slate-950/80 rounded-[7px] flex items-center justify-center">
            <svg
              className="w-3/5 h-3/5 text-indigo-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        <span className={`font-semibold tracking-tight text-slate-100 ${sizeClasses[size]}`}>
          HelloSmart<span className="text-indigo-400">.ai</span>
        </span>
        {!whiteLabel && (
          <span className="text-[10px] text-slate-400 tracking-wider font-medium -mt-0.5">
            Powered by hellosmart.ai
          </span>
        )}
      </div>
    </div>
  );
}
