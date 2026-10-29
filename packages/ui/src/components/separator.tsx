import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

export interface SeparatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  orientation?: 'horizontal' | 'vertical' | undefined;
  decorative?: boolean | undefined;
  title?: ReactNode | undefined;
  subtitle?: ReactNode | undefined;
  textAlign?: 'left' | 'center' | 'right' | undefined;
}

export const Separator = forwardRef<HTMLDivElement, SeparatorProps>(
  (
    {
      orientation = 'horizontal',
      decorative = true,
      title,
      subtitle,
      textAlign = 'center',
      className = '',
      ...props
    },
    ref
  ) => {
    const isHorizontal = orientation === 'horizontal';

    if (isHorizontal && (title || subtitle)) {
      return (
        <div
          ref={ref}
          role={decorative ? 'none' : 'separator'}
          aria-orientation="horizontal"
          className={`relative flex items-center my-4 w-full ${className}`}
          {...props}
        >
          {textAlign !== 'left' && <div className="grow border-t border-neutral-200" />}
          <div
            className={`flex flex-col shrink-0 ${
              textAlign === 'left'
                ? 'pr-4 text-left'
                : textAlign === 'right'
                  ? 'pl-4 text-right'
                  : 'px-4 text-center items-center'
            }`}
          >
            {title && (
              <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wider">
                {title}
              </span>
            )}
            {subtitle && (
              <span className="text-[11px] text-neutral-400 font-normal mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
          {textAlign !== 'right' && <div className="grow border-t border-neutral-200" />}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        className={`bg-neutral-200 shrink-0 ${
          isHorizontal ? 'h-[1px] w-full my-4' : 'h-full w-[1px] mx-4'
        } ${className}`}
        {...props}
      />
    );
  }
);
Separator.displayName = 'Separator';


