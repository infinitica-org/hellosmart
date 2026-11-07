import React from 'react';
import { Gauge, AlertTriangle, AlertOctagon } from 'lucide-react';

export interface TokenBudgetGaugeProps {
  tokensUsed: number;
  tokenCap: number;
  theme?: 'dark' | 'light' | undefined;
  className?: string | undefined;
}

export function TokenBudgetGauge({
  tokensUsed,
  tokenCap,
  theme = 'dark',
  className = '',
}: TokenBudgetGaugeProps) {
  const isLight = theme === 'light';
  const safeCap = Math.max(1, tokenCap);
  const percentage = Math.min(100, Math.round((tokensUsed / safeCap) * 100));
  const isWarning = percentage >= 80 && percentage < 100;
  const isBlocked = percentage >= 100;
  const tokensRemaining = Math.max(0, safeCap - tokensUsed);

  // Status-dependent colors
  const barColor = isBlocked
    ? 'bg-rose-500'
    : isWarning
      ? 'bg-amber-500'
      : 'bg-primary';

  const badgeBg = isBlocked
    ? isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-950/60 text-rose-400 border-rose-800'
    : isWarning
      ? isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950/60 text-amber-400 border-amber-800'
      : isLight ? 'bg-orange-50 text-primary border-orange-200' : 'bg-orange-950/50 text-orange-400 border-orange-900/60';

  return (
    <div
      className={`p-3 rounded-xl border text-xs transition-colors ${
        isLight
          ? 'bg-white border-neutral-200/90 text-neutral-800 shadow-2xs'
          : 'bg-neutral-900 border-neutral-800 text-neutral-200'
      } ${className}`}
      data-testid="token-budget-gauge"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 font-medium">
          <Gauge className="w-3.5 h-3.5 text-primary" />
          <span className={isLight ? 'text-neutral-900 font-semibold' : 'text-neutral-100 font-semibold'}>
            Token Budget (BR-15)
          </span>
        </div>

        <div className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${badgeBg}`}>
          {isBlocked ? (
            <>
              <AlertOctagon className="w-3 h-3 text-rose-500" />
              <span>Cap Reached</span>
            </>
          ) : isWarning ? (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-500 animate-pulse" />
              <span>80% Warning</span>
            </>
          ) : (
            <span>{`${percentage}% Used`}</span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-2 rounded-full overflow-hidden mb-1.5 ${
        isLight ? 'bg-neutral-200/90' : 'bg-neutral-800'
      }`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
          data-testid="token-gauge-progress"
        />
      </div>

      {/* Numerical Stats & Warnings */}
      <div className={`flex items-center justify-between text-[11px] ${
        isLight ? 'text-neutral-600' : 'text-neutral-400'
      }`}>
        <span>
          <strong className={isLight ? 'text-neutral-900 font-semibold' : 'text-neutral-100 font-semibold'}>
            {tokensUsed.toLocaleString()}
          </strong>
          {` / ${safeCap.toLocaleString()} tokens`}
        </span>

        {isBlocked ? (
          <span className="text-rose-500 font-semibold">Input Blocked</span>
        ) : (
          <span>{`${tokensRemaining.toLocaleString()} remaining`}</span>
        )}
      </div>

      {isBlocked && (
        <p className="mt-1.5 text-[10px] text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded border border-rose-200 dark:border-rose-900/60 font-mono">
          Token budget cap reached for this candidate session. AI generation is now blocked per company assessment policy.
        </p>
      )}
    </div>
  );
}
