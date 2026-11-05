import React, { forwardRef } from 'react';

export type EmailHeroVariant = 'image' | '3d-abstract' | 'gradient';

export interface EmailHeroProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmailHeroVariant | undefined;
  imageSrc?: string | undefined;
  imageAlt?: string | undefined;
  aspectRatio?: 'video' | 'banner' | 'square' | undefined;
  badgeText?: string | undefined;
  title?: string | undefined;
  subtitle?: string | undefined;
}

export const EmailHero = forwardRef<HTMLDivElement, EmailHeroProps>(
  (
    {
      variant = '3d-abstract',
      imageSrc,
      imageAlt = 'Email hero header',
      aspectRatio = 'banner',
      badgeText,
      title,
      subtitle,
      className = '',
      ...props
    },
    ref
  ) => {
    // 1. Photo Hero (Email 2 style)
    if (variant === 'image') {
      return (
        <div
          ref={ref}
          className={`w-full overflow-hidden rounded-xl border border-neutral-200/80 mb-6 bg-neutral-100 ${className}`}
          {...props}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={imageAlt}
              className="w-full h-auto object-cover max-h-56 sm:max-h-64"
            />
          ) : (
            // Default placeholder photo hero representing modern professional workspace
            <div className="w-full h-48 sm:h-56 bg-gradient-to-br from-neutral-800 via-neutral-900 to-neutral-950 flex flex-col items-center justify-center p-6 text-center text-white relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(127,86,217,0.25),transparent_70%)]" />
              {badgeText && (
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-white/10 border border-white/20 text-white backdrop-blur-xs mb-2 z-10 uppercase tracking-wider">
                  {badgeText}
                </span>
              )}
              {title && (
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight z-10">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-neutral-300 mt-1 max-w-sm z-10">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    // 2. 3D Abstract Glass Artwork Hero (Email 5 style)
    if (variant === '3d-abstract') {
      return (
        <div
          ref={ref}
          className={`w-full overflow-hidden rounded-xl border border-neutral-200/80 mb-6 relative bg-gradient-to-b from-[#180828] via-[#240e3f] to-[#120520] ${className}`}
          {...props}
        >
          {/* Glass Ribbon SVG Simulation */}
          <div className="w-full h-44 sm:h-52 relative flex items-center justify-center overflow-hidden">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 600 240"
              fill="none"
              preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="glassGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
                  <stop offset="50%" stopColor="#7F56D9" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#E879F9" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="glassGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.7" />
                  <stop offset="60%" stopColor="#818CF8" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#C084FC" stopOpacity="0.1" />
                </linearGradient>
                <filter id="glassBlur" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                </filter>
              </defs>

              {/* Background ambient glow */}
              <circle cx="300" cy="120" r="100" fill="#7F56D9" opacity="0.4" filter="url(#glassBlur)" />
              <circle cx="450" cy="80" r="80" fill="#E879F9" opacity="0.3" filter="url(#glassBlur)" />

              {/* Curving 3D Glass Tubes / Ribbons */}
              <path
                d="M -50,180 C 150,220 220,40 380,80 C 480,100 550,200 650,150"
                stroke="url(#glassGrad1)"
                strokeWidth="48"
                strokeLinecap="round"
                fill="none"
                opacity="0.85"
              />
              <path
                d="M 20,40 C 180,-10 320,160 460,110 C 540,80 580,30 650,40"
                stroke="url(#glassGrad2)"
                strokeWidth="32"
                strokeLinecap="round"
                fill="none"
                opacity="0.75"
              />
              {/* Highlight refraction sheen */}
              <path
                d="M -30,178 C 160,218 225,43 380,82 C 478,101 548,198 640,152"
                stroke="#FFFFFF"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                opacity="0.6"
              />
            </svg>

            {/* Optional Overlay Text */}
            {(title || badgeText) && (
              <div className="relative z-10 text-center px-4">
                {badgeText && (
                  <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold bg-white/20 border border-white/30 text-white backdrop-blur-md mb-2 uppercase tracking-wider">
                    {badgeText}
                  </span>
                )}
                {title && (
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                    {title}
                  </h2>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 3. Subtle Brand Gradient Hero
    return (
      <div
        ref={ref}
        className={`w-full h-32 sm:h-40 rounded-xl overflow-hidden border border-neutral-200/80 mb-6 bg-gradient-to-br from-[#FE7330]/10 via-[#7F56D9]/10 to-[#6366F1]/10 flex flex-col items-center justify-center p-6 text-center ${className}`}
        {...props}
      >
        {badgeText && (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#7F56D9]/10 text-[#7F56D9] border border-[#7F56D9]/20 mb-2">
            {badgeText}
          </span>
        )}
        {title && (
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs text-neutral-500 mt-1 max-w-sm">
            {subtitle}
          </p>
        )}
      </div>
    );
  }
);

EmailHero.displayName = 'EmailHero';

