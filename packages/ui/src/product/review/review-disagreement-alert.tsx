import React, { forwardRef, HTMLAttributes } from 'react';
import { Alert } from '../../feedback/alert';

export interface ReviewDisagreementAlertProps extends HTMLAttributes<HTMLDivElement> {
  disagreementItem: string;
  agentVariance: string;
  onReview?: (() => void) | undefined;
}

export const ReviewDisagreementAlert = forwardRef<HTMLDivElement, ReviewDisagreementAlertProps>(
  ({ disagreementItem, agentVariance, onReview, className = '', ...props }, ref) => {
    return (
      <Alert
        ref={ref}
        variant="warning"
        title="Reviewer Agent Variance Flagged"
        className={className}
        {...props}
      >
        <p className="mt-1 text-neutral-700">
          The aggregation engine detected significant disagreement on{' '}
          <strong className="text-warning-foreground">{disagreementItem}</strong> ({agentVariance}). Human inspection is strongly advised before finalizing.
        </p>

        {onReview && (
          <div className="mt-3">
            <button
              type="button"
              onClick={onReview}
              className="text-xs font-semibold text-warning-foreground hover:text-warning-foreground underline underline-offset-2"
            >
              Inspect Agent Rationales & Evidence →
            </button>
          </div>
        )}
      </Alert>
    );
  }
);
ReviewDisagreementAlert.displayName = 'ReviewDisagreementAlert';

