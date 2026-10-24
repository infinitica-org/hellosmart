import React, { HTMLAttributes, forwardRef, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'solid' | 'bordered' | 'interactive' | undefined;
  children?: ReactNode | undefined;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'glass', className = '', children, ...props }, ref) => {
    const variantStyles = {
      glass: 'bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-xl shadow-black/20',
      solid: 'bg-slate-900 border border-slate-800 shadow-md',
      bordered: 'bg-transparent border border-slate-800',
      interactive:
        'bg-slate-900/60 backdrop-blur-md border border-slate-800/80 hover:border-indigo-500/40 hover:shadow-indigo-500/10 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
    };

    return (
      <div
        ref={ref}
        className={`rounded-2xl text-slate-100 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode | undefined;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col space-y-1.5 p-6 border-b border-slate-800/60 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | undefined;
  children?: ReactNode | undefined;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Component = 'h3', className = '', children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={`text-lg font-semibold tracking-tight text-slate-100 ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
CardTitle.displayName = 'CardTitle';

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children?: ReactNode | undefined;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={`text-xs text-slate-400 leading-relaxed ${className}`}
        {...props}
      >
        {children}
      </p>
    );
  }
);
CardDescription.displayName = 'CardDescription';

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode | undefined;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`p-6 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardContent.displayName = 'CardContent';

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode | undefined;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between p-6 pt-4 border-t border-slate-800/60 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);
CardFooter.displayName = 'CardFooter';

