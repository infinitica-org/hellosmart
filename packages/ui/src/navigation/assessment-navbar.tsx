'use client';

import React from 'react';
import { BrandMark } from '../brand-mark';
import { Button } from '../components/button';
import { ArrowLeft, Check } from 'lucide-react';

export type AssessmentStep = 'diagnostics' | 'agreement' | 'workspace';

export interface AssessmentNavbarProps {
  userName?: string | null | undefined;
  activeStep?: AssessmentStep | undefined;
  isWorkspace?: boolean | undefined;
  onExit?: (() => void) | undefined;
  exitLabel?: string | undefined;
  brandHref?: string | undefined;
  onBrandClick?: (() => void) | undefined;
  className?: string | undefined;
}

export function AssessmentNavbar({
  userName,
  activeStep,
  isWorkspace = false,
  onExit,
  exitLabel = 'Exit to Dashboard',
  brandHref = '/candidate',
  onBrandClick,
  className = '',
}: AssessmentNavbarProps): React.JSX.Element {
  const step = activeStep ?? (isWorkspace ? 'workspace' : 'diagnostics');
  const isDiagnostics = step === 'diagnostics';
  const isConsent = step === 'agreement';
  const isAtWorkspace = step === 'workspace' || isWorkspace;

  return (
    <header
      className={`sticky top-0 z-40 w-full h-14 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 px-4 sm:px-8 flex items-center justify-between ${className}`}
      data-testid="assessment-navbar"
    >
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        {onBrandClick ? (
          <button
            type="button"
            onClick={onBrandClick}
            className="focus:outline-none cursor-pointer flex items-center"
          >
            <BrandMark size="sm" showSubtitle={false} logoVariant="image" />
          </button>
        ) : (
          <a href={brandHref} className="focus:outline-none flex items-center">
            <BrandMark size="sm" showSubtitle={false} logoVariant="image" />
          </a>
        )}
        <span className="text-neutral-300 dark:text-neutral-700 select-none hidden sm:inline">|</span>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hidden sm:inline-flex items-center gap-1.5">
          {isAtWorkspace ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>Assessment Workspace</span>
            </>
          ) : (
            'Assessment Pre-Flight'
          )}
        </span>
      </div>

      {/* Stepper in Center */}
      <nav aria-label="Assessment Progress" className="hidden md:flex items-center gap-2 text-xs">
        {/* Step 1: Diagnostics */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
            isDiagnostics
              ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
              : isConsent || isAtWorkspace
                ? 'text-success-foreground font-medium'
                : 'text-neutral-400'
          }`}
        >
          {isDiagnostics ? (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          ) : isConsent || isAtWorkspace ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : null}
          <span>1. Diagnostics</span>
        </div>

        <span className="text-neutral-300 dark:text-neutral-700 select-none">&rarr;</span>

        {/* Step 2: Agreement */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
            isConsent
              ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
              : isAtWorkspace
                ? 'text-success-foreground font-medium'
                : 'text-neutral-400'
          }`}
        >
          {isConsent ? (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          ) : isAtWorkspace ? (
            <Check className="w-3.5 h-3.5 text-success" />
          ) : null}
          <span>2. Agreement</span>
        </div>

        <span className="text-neutral-300 dark:text-neutral-700 select-none">&rarr;</span>

        {/* Step 3: Workspace */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
            isAtWorkspace
              ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
              : 'text-neutral-400'
          }`}
        >
          {isAtWorkspace && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          <span>3. Workspace</span>
        </div>
      </nav>

      {/* Right Controls: Candidate info & Exit button */}
      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300 hidden sm:inline">
            {userName}
          </span>
        )}
        {onExit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExit}
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            {exitLabel}
          </Button>
        )}
      </div>
    </header>
  );
}
