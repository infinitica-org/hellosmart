'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AssessmentNavbar as UIAssessmentNavbar, type AssessmentStep } from '@hs/ui';
import { ROUTES } from '@/constants/routes';

export interface AssessmentNavbarProps {
  userName?: string | null | undefined;
  onExit?: () => void;
  activeStep?: AssessmentStep;
  isWorkspace?: boolean;
  className?: string;
}

export function AssessmentNavbar({
  userName,
  onExit,
  activeStep,
  isWorkspace,
  className,
}: AssessmentNavbarProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const isDiagnostics = Boolean(pathname?.includes('/diagnostics'));
  const isConsent = Boolean(pathname?.includes('/consent'));
  const isWs = isWorkspace ?? Boolean(pathname?.includes('/workspaces/') || pathname?.includes('/workspace/'));

  const computedStep: AssessmentStep =
    activeStep ?? (isDiagnostics ? 'diagnostics' : isConsent ? 'agreement' : 'workspace');

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      router.push(ROUTES.CANDIDATE.DASHBOARD);
    }
  };

  const handleBrandClick = () => {
    router.push(ROUTES.CANDIDATE.DASHBOARD);
  };

  return (
    <UIAssessmentNavbar
      userName={userName}
      activeStep={computedStep}
      isWorkspace={isWs}
      onExit={handleExit}
      onBrandClick={handleBrandClick}
      className={className}
    />
  );
}

export { UIAssessmentNavbar };
