'use client';

import React from 'react';

export interface StepItem {
  id: number;
  title: string;
  subtitle: string;
}

export const WIZARD_STEPS: readonly StepItem[] = [
  { id: 1, title: 'Details', subtitle: 'Template & metadata' },
  { id: 2, title: 'Instructions', subtitle: 'Candidate brief & deliverables' },
  { id: 3, title: 'Configuration', subtitle: 'Duration & testing window' },
] as const;

export interface WizardProgressProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function WizardProgress({
  currentStep,
  onStepClick,
  className = '',
}: WizardProgressProps): React.JSX.Element {
  return (
    <nav aria-label="Assessment Creation Progress" className={`w-full ${className}`}>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4" role="list">
        {WIZARD_STEPS.map((step) => {
          const isCurrent = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <li
              key={step.id}
              className={`relative flex items-center gap-3 p-3.5 sm:p-4 rounded-xl border transition-all ${
                isCurrent
                  ? 'border-primary bg-primary/5 shadow-xs'
                  : isCompleted
                    ? 'border-neutral-200 bg-white hover:border-neutral-300'
                    : 'border-neutral-200/70 bg-neutral-50/60 opacity-60'
              } ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
              onClick={() => isClickable && onStepClick(step.id)}
              aria-current={isCurrent ? 'step' : undefined}
              data-testid={`wizard-step-indicator-${step.id}`}
            >
              {/* Step Number / Completed Checkmark */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 transition-colors ${
                  isCurrent
                    ? 'bg-primary text-white shadow-xs'
                    : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="min-w-0">
                <div
                  className={`text-xs sm:text-sm font-semibold truncate ${
                    isCurrent ? 'text-primary' : 'text-neutral-900'
                  }`}
                >
                  {step.title}
                </div>
                <div className="text-[11px] text-neutral-500 truncate hidden sm:block">
                  {step.subtitle}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

