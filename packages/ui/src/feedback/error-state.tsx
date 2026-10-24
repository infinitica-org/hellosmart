'use client';

import React, { ReactNode } from 'react';
import { Button } from '../components/button';
import { Spinner } from './spinner';

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
      <div className="w-18 h-18 rounded-3xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400 mb-6 shadow-2xl shadow-rose-950/60 p-4">
        <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-rose-400 uppercase mb-2">
        Application Error
      </span>

      <h2 className="text-2xl font-bold tracking-tight text-slate-100 max-w-md">
        {title}
      </h2>

      <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
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
      <div className="w-20 h-20 rounded-3xl bg-indigo-950/40 border border-indigo-800/40 flex items-center justify-center text-indigo-400 mb-6 shadow-2xl shadow-indigo-950/60">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-indigo-400 uppercase mb-2">
        404 &bull; Not Found
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 max-w-md">
        {title}
      </h1>

      <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
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
      <div className="w-20 h-20 rounded-3xl bg-amber-950/40 border border-amber-800/40 flex items-center justify-center text-amber-400 mb-6 shadow-2xl shadow-amber-950/60">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase mb-2">
        403 &bull; Forbidden
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 max-w-md">
        {title}
      </h1>

      <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
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
      <div className="w-20 h-20 rounded-3xl bg-rose-950/40 border border-rose-800/40 flex items-center justify-center text-rose-400 mb-6 shadow-2xl shadow-rose-950/60">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-rose-400 uppercase mb-2">
        500 &bull; Server Failure
      </span>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 max-w-md">
        {title}
      </h1>

      <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
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
      <div className="w-18 h-18 rounded-3xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-400 mb-6 shadow-2xl shadow-black/60 p-4">
        <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-2.828-5.657m0 0l2.828 2.829m-2.828-2.829L3 3"
          />
        </svg>
      </div>

      <span className="text-xs font-mono font-bold tracking-widest text-slate-400 uppercase mb-2">
        Network Disconnected
      </span>

      <h2 className="text-2xl font-bold tracking-tight text-slate-100 max-w-md">
        {title}
      </h2>

      <p className="mt-3 text-sm text-slate-400 max-w-md leading-relaxed">
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
      <Spinner size="lg" className="text-indigo-400 mb-4" />
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description && <p className="mt-1.5 text-xs text-slate-400 max-w-sm">{description}</p>}
    </div>
  );
}

export const NotFoundState = NotFound;
export const AccessDeniedState = AccessDenied;
export const ServerErrorState = ServerError;
export const NetworkErrorState = NetworkError;

