import React, { forwardRef, AnchorHTMLAttributes } from 'react';

export type EmailButtonVariant = 'orange' | 'black' | 'secondary' | 'purple';

export interface EmailButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: EmailButtonVariant | undefined;
  href: string;
  showArrow?: boolean | undefined;
  children: React.ReactNode;
}

export const EmailButton = forwardRef<HTMLAnchorElement, EmailButtonProps>(
  (
    {
      variant = 'orange',
      href,
      showArrow = true,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      orange:
        'bg-gradient-to-b from-[#fe7330] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white shadow-xs border border-[#c2410c]',
      black:
        'bg-[#0b1f3a] hover:bg-[#0e2a4d] text-white shadow-xs border border-[#0b1f3a]',
      purple:
        'bg-[#7F56D9] hover:bg-[#6941C6] text-white shadow-xs border border-[#6941C6]',
      secondary:
        'bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 shadow-2xs',
    };

    return (
      <div className="py-2 inline-block">
        <a
          ref={ref}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center justify-center px-6 py-3 rounded-lg text-sm font-bold tracking-tight transition-all text-decoration-none select-none ${variantStyles[variant]} ${className}`}
          {...props}
        >
          <span>{children}</span>
          {showArrow && <span className="ml-1.5 font-normal">&rarr;</span>}
        </a>
      </div>
    );
  }
);

EmailButton.displayName = 'EmailButton';
