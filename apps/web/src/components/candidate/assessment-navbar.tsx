'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BrandMark, Button } from '@hs/ui';
import { ArrowLeft, Check } from 'lucide-react';
import { ROUTES } from '@/constants/routes';

export interface AssessmentNavbarProps {
  userName?: string | null | undefined;
  onExit?: () => void;
}

export function AssessmentNavbar({ userName, onExit }: AssessmentNavbarProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const isDiagnostics = Boolean(pathname?.includes('/diagnostics'));
  const isConsent = Boolean(pathname?.includes('/consent'));
  const isWorkspace = Boolean(pathname?.includes('/workspaces/') || pathname?.includes('/workspace/'));

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      router.push(ROUTES.CANDIDATE.DASHBOARD);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-neutral-800 px-4 sm:px-8 flex items-center justify-between">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <Link href={ROUTES.CANDIDATE.DASHBOARD} className="focus:outline-none">
          <BrandMark size="sm" showSubtitle={false} logoVariant="image" />
        </Link>
        <span className="text-neutral-300 dark:text-neutral-700 select-none hidden sm:inline">|</span>
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 hidden sm:inline flex items-center gap-1.5">
          {isWorkspace ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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
              ? 'bg-orange-50 text-primary border border-orange-200/80 font-semibold'
              : isConsent || isWorkspace
                ? 'text-emerald-700 font-medium'
                : 'text-neutral-400'
          }`}
        >
          {isDiagnostics ? (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          ) : isConsent || isWorkspace ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : null}
          <span>1. Diagnostics</span>
        </div>

        <span className="text-neutral-300 dark:text-neutral-700 select-none">&rarr;</span>

        {/* Step 2: Agreement */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
            isConsent
              ? 'bg-orange-50 text-primary border border-orange-200/80 font-semibold'
              : isWorkspace
                ? 'text-emerald-700 font-medium'
                : 'text-neutral-400'
          }`}
        >
          {isConsent ? (
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          ) : isWorkspace ? (
            <Check className="w-3.5 h-3.5 text-emerald-600" />
          ) : null}
          <span>2. Agreement</span>
        </div>

        <span className="text-neutral-300 dark:text-neutral-700 select-none">&rarr;</span>

        {/* Step 3: Workspace */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${
            isWorkspace
              ? 'bg-orange-50 text-primary border border-orange-200/80 font-semibold'
              : 'text-neutral-400'
          }`}
        >
          {isWorkspace && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExit}
          leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
        >
          Exit to Dashboard
        </Button>
      </div>
    </header>
  );
}
