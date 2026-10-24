import React, { forwardRef, HTMLAttributes } from 'react';
import { Card } from '../../components/card';
import { Progress } from '../../components/progress';
import { Button } from '../../components/button';

export interface EntitlementUsageCardProps extends HTMLAttributes<HTMLDivElement> {
  templatesUsed: number;
  templatesMax: number;
  candidatesUsed: number;
  candidatesMax: number;
  trialEndsAt?: string | Date | undefined;
  onUpgrade?: (() => void) | undefined;
}

export const EntitlementUsageCard = forwardRef<HTMLDivElement, EntitlementUsageCardProps>(
  (
    {
      templatesUsed,
      templatesMax,
      candidatesUsed,
      candidatesMax,
      trialEndsAt,
      onUpgrade,
      className = '',
      ...props
    },
    ref
  ) => {
    const candidatePct =
      candidatesMax > 0 ? Math.min(Math.round((candidatesUsed / candidatesMax) * 100), 100) : 0;
    const templatePct =
      templatesMax > 0 ? Math.min(Math.round((templatesUsed / templatesMax) * 100), 100) : 0;

    const daysRemaining = trialEndsAt
      ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;

    return (
      <Card ref={ref} variant="glass" className={`p-6 space-y-5 ${className}`} {...props}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Organization Entitlements (BR-05)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enforced server-side quotas for your organization.
            </p>
          </div>
          {daysRemaining !== null && (
            <span
              className={`text-xs font-mono px-2.5 py-1 rounded-full border ${
                daysRemaining <= 3
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                  : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
              }`}
            >
              {daysRemaining} days left
            </span>
          )}
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300 font-medium">
              <span>Candidate Quota (BR-06: counts at 1st launch)</span>
              <span className="font-mono text-slate-400">
                {candidatesUsed} / {candidatesMax}
              </span>
            </div>
            <Progress
              value={candidatePct}
              max={100}
              variant={candidatePct >= 90 ? 'warning' : 'primary'}
              size="sm"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 text-slate-300 font-medium">
              <span>Private Templates Quota</span>
              <span className="font-mono text-slate-400">
                {templatesUsed} / {templatesMax}
              </span>
            </div>
            <Progress
              value={templatePct}
              max={100}
              variant={templatePct >= 90 ? 'warning' : 'primary'}
              size="sm"
            />
          </div>
        </div>

        {onUpgrade && (
          <div className="pt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={onUpgrade}>
              Request Quota Upgrade
            </Button>
          </div>
        )}
      </Card>
    );
  }
);
EntitlementUsageCard.displayName = 'EntitlementUsageCard';

