'use client';

import React, { ReactNode } from 'react';
import { Button } from '../components/button';
import { Spinner } from './spinner';
import { AlertTriangle, HelpCircle, Lock, ServerCrash, WifiOff } from 'lucide-react';

export interface ErrorComponentProps {
  title?: string | undefined;
  description?: string | undefined;
  actionHref?: string | undefined;
  actionLabel?: string | undefined;
  onRetry?: (() => void) | undefined;
  className?: string | undefined;
  children?: ReactNode | undefined;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred while rendering this view. Our monitoring system has captured the event.',
  actionHref = '/',
  actionLabel = 'Return Home',
  onRetry,
  className = '',
}: ErrorComponentProps): React.JSX.Element {
  return (
    <div
      className={`min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
    >
      <div className="w-18 h-18 rounded-md bg-danger-muted border border-danger-border flex items-center justify-center text-danger mb-6 shadow-sm p-4">
        <AlertTriangle className="w-9 h-9" />
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-danger uppercase mb-2">
        Application Error
      </span>

      <h2 className="text-2xl font-bold tracking-tight text-neutral-900 max-w-md">
        {title}
      </h2>

      <p className="mt-3 text-sm text-neutral-600 max-w-md leading-relaxed">
        {description}
      </p>

      <div className="mt-8 flex items-center gap-3">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Try Again
          </Button>
        )}
        <Button href={actionHref} variant={onRetry ? 'secondary' : 'primary'}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function NotFound({
  title = 'Page Not Found',
  description = "The page or resource you are looking for doesn't exist, has been moved, or is private to another organization.",
  actionHref = '/',
  actionLabel = 'Return to Dashboard',
  className = '',
}: ErrorComponentProps): React.JSX.Element {
  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
    >
      <div className="w-20 h-20 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-6 shadow-sm">
        <HelpCircle className="w-10 h-10 stroke-[1.5]" />
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-primary uppercase mb-2">
        404 &bull; Not Found
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 max-w-md">
        {title}
      </h1>

      <p className="mt-3 text-sm text-neutral-600 max-w-md leading-relaxed">
        {description}
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button href={actionHref} variant="primary">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function AccessDenied({
  title = 'Access Restricted',
  description = 'You do not have the required permissions or role to access this portal or resource (BR-01, BR-25).',
  actionHref = '/login',
  actionLabel = 'Sign in with Authorized Account',
  className = '',
}: ErrorComponentProps): React.JSX.Element {
  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
    >
      <div className="w-20 h-20 rounded-md bg-warning-muted border border-warning-border flex items-center justify-center text-warning mb-6 shadow-sm">
        <Lock className="w-10 h-10 stroke-[1.5]" />
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-warning uppercase mb-2">
        403 &bull; Forbidden
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 max-w-md">
        {title}
      </h1>

      <p className="mt-3 text-sm text-neutral-600 max-w-md leading-relaxed">
        {description}
      </p>

      <div className="mt-8 flex items-center gap-3">
        <Button href={actionHref} variant="primary">
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function ServerError({
  title = 'Internal Server Error',
  description = 'Our services encountered an issue while processing your request. Please try again or contact HelloSmart support.',
  onRetry,
  actionHref = '/',
  actionLabel = 'Return to Safety',
  className = '',
}: ErrorComponentProps): React.JSX.Element {
  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
    >
      <div className="w-20 h-20 rounded-md bg-danger-muted border border-danger-border flex items-center justify-center text-danger mb-6 shadow-sm">
        <ServerCrash className="w-10 h-10 stroke-[1.5]" />
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-danger uppercase mb-2">
        500 &bull; Server Failure
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 max-w-md">
        {title}
      </h1>

      <p className="mt-3 text-sm text-neutral-600 max-w-md leading-relaxed">
        {description}
      </p>

      <div className="mt-8 flex items-center gap-3">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Retry Request
          </Button>
        )}
        <Button href={actionHref} variant={onRetry ? 'secondary' : 'primary'}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function NetworkError({
  title = 'Connection Interrupted',
  description = 'Could not reach HelloSmart servers. Please check your internet connectivity and reconnect.',
  onRetry,
  className = '',
}: ErrorComponentProps): React.JSX.Element {
  return (
    <div
      className={`min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
    >
      <div className="w-18 h-18 rounded-md bg-neutral-100 border border-neutral-200 flex items-center justify-center text-neutral-600 mb-6 shadow-sm p-4">
        <WifiOff className="w-9 h-9" />
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-neutral-500 uppercase mb-2">
        Network Disconnected
      </span>

      <h2 className="text-2xl font-bold tracking-tight text-neutral-900 max-w-md">
        {title}
      </h2>

      <p className="mt-3 text-sm text-neutral-600 max-w-md leading-relaxed">
        {description}
      </p>

      {onRetry && (
        <div className="mt-8">
          <Button variant="primary" onClick={onRetry}>
            Reconnect Now
          </Button>
        </div>
      )}
    </div>
  );
}

export interface LoadingStateProps {
  title?: string | undefined;
  description?: string | undefined;
  className?: string | undefined;
}

export function LoadingState({
  title = 'Loading...',
  description = 'Retrieving data from HelloSmart servers.',
  className = '',
}: LoadingStateProps): React.JSX.Element {
  return (
    <div
      className={`min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in ${className}`}
      role="status"
    >
      <Spinner size="lg" color="primary" className="mb-4" />
      <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      {description && <p className="mt-1.5 text-xs text-neutral-600 max-w-sm">{description}</p>}
    </div>
  );
}

export const NotFoundState = NotFound;
export const AccessDeniedState = AccessDenied;
export const ServerErrorState = ServerError;
export const NetworkErrorState = NetworkError;

