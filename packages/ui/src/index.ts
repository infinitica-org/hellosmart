// Shared UI component exports for @hs/ui
export interface BrandMarkProps {
  whiteLabel?: boolean;
  className?: string;
  showLogo?: boolean;
  size?: 'sm' | 'md' | 'lg';
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

  return {
    type: 'div',
    props: {
      className: `brand-mark ${className}`,
      whiteLabel,
      showLogo,
      size: sizeClasses[size],
    },
  };
}
