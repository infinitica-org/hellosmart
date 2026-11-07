import React, { forwardRef, HTMLAttributes } from 'react';
import { Progress } from '../../components/progress';
import { Bot } from 'lucide-react';

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
        className={`flex flex-col space-y-1.5 p-3 rounded-md bg-white border border-neutral-200 text-xs shadow-xs ${className}`}
        {...props}
      >
        <div className="flex justify-between items-center">
          <span className="font-medium text-neutral-800 flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-primary" />
            AI Budget Allowance
          </span>
          <span className="font-mono text-[11px] text-neutral-500">
            {usedTokens.toLocaleString()} / {capTokens.toLocaleString()} {unit}
          </span>
        </div>

        <Progress value={percentage} max={100} variant={progressVariant} size="sm" />

        {isWarning && (
          <div className="text-[11px] text-warning font-medium mt-0.5">
            ⚠️ 80% AI budget reached. AI requests will be blocked at 100%.
          </div>
        )}

        {isExceeded && (
          <div className="text-[11px] text-danger font-medium mt-0.5">
            ⛔ AI budget depleted. Workspace AI assistant is paused for this session.
          </div>
        )}
      </div>
    );
  }
);
AiUsageIndicator.displayName = 'AiUsageIndicator';

