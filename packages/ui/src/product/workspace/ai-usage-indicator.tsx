import React, { forwardRef, HTMLAttributes } from 'react';
import { Progress } from '../../components/progress';

export interface AiUsageIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  usedTokens: number;
  capTokens: number;
  unit?: string | undefined;
}

export const AiUsageIndicator = forwardRef<HTMLDivElement, AiUsageIndicatorProps>(
  ({ usedTokens, capTokens, unit = 'tokens', className = '', ...props }, ref) => {
    const percentage = capTokens > 0 ? Math.min(Math.round((usedTokens / capTokens) * 100), 100) : 0;
    const isWarning = percentage >= 80 && percentage < 100;
    const isExceeded = percentage >= 100;

    const progressVariant = isExceeded ? 'danger' : isWarning ? 'warning' : 'primary';

    return (
      <div
        ref={ref}
        className={`flex flex-col space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs ${className}`}
        {...props}
      >
        <div className="flex justify-between items-center">
          <span className="font-medium text-slate-300 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            AI Budget Allowance (BR-15)
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            {usedTokens.toLocaleString()} / {capTokens.toLocaleString()} {unit}
          </span>
        </div>

        <Progress value={percentage} max={100} variant={progressVariant} size="sm" />

        {isWarning && (
          <div className="text-[11px] text-amber-400 font-medium mt-0.5">
            ⚠️ 80% AI budget reached. AI requests will be blocked at 100%.
          </div>
        )}

        {isExceeded && (
          <div className="text-[11px] text-rose-400 font-medium mt-0.5">
            ⛔ AI budget depleted. Workspace AI assistant is paused for this session.
          </div>
        )}
      </div>
    );
  }
);
AiUsageIndicator.displayName = 'AiUsageIndicator';

