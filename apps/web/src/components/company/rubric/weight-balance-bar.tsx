'use client';

import React from 'react';
import { Badge, Card } from '@hs/ui';
import { calculateWeightBalance, type RubricDimension } from './types';
import { RUBRIC_WEIGHT_TOTAL } from '@/constants';

export interface WeightBalanceBarProps {
  dimensions: RubricDimension[];
  className?: string;
}

export function WeightBalanceBar({
  dimensions,
  className = '',
}: WeightBalanceBarProps): React.JSX.Element {
  const balance = calculateWeightBalance(dimensions);

  // Status-dependent visual styles
  const statusStyles = {
    balanced: {
      badgeVariant: 'success' as const,
      badgeText: 'Balanced (100%)',
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50/60',
      borderColor: 'border-emerald-200',
    },
    under: {
      badgeVariant: 'warning' as const,
      badgeText: 'Under Allocated',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-800',
      bgColor: 'bg-amber-50/60',
      borderColor: 'border-amber-200',
    },
    over: {
      badgeVariant: 'danger' as const,
      badgeText: 'Over Allocated',
      barColor: 'bg-rose-500',
      textColor: 'text-rose-800',
      bgColor: 'bg-rose-50/60',
      borderColor: 'border-rose-200',
    },
  }[balance.status];

  const clampedPercentage = Math.min(Math.max(balance.totalWeight, 0), 100);

  return (
    <Card
      data-testid="rubric-weight-balance-card"
      className={`p-5 sm:p-6 rounded-2xl border transition-all ${statusStyles.borderColor} ${statusStyles.bgColor} ${className}`}
    >
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-neutral-900 font-mono uppercase tracking-wider">
              Rubric Weight Balance
            </h3>
            <Badge variant={statusStyles.badgeVariant} size="sm" dot>
              {statusStyles.badgeText}
            </Badge>
          </div>
          <p className="text-xs text-neutral-600 mt-0.5">
            Independent AI Reviewer agents score each dimension according to allocated percentage weight.
          </p>
        </div>

        {/* Numeric Counter */}
        <div className="flex items-baseline gap-1.5 self-start sm:self-auto shrink-0 font-mono">
          <span className={`text-2xl font-extrabold ${statusStyles.textColor}`}>
            {balance.totalWeight}%
          </span>
          <span className="text-xs text-neutral-500 font-semibold">/ {RUBRIC_WEIGHT_TOTAL}% Required</span>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div
        className="w-full h-3 rounded-full bg-neutral-200 overflow-hidden relative"
        role="progressbar"
        aria-valuenow={balance.totalWeight}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Rubric weight distribution progress"
      >
        <div
          className={`h-full transition-all duration-300 rounded-full ${statusStyles.barColor}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>

      {/* Bottom Status Details */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className={`font-medium ${statusStyles.textColor}`}>
          {balance.isBalanced ? (
            <span className="flex items-center gap-1.5 text-emerald-700">
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {balance.message}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {balance.message}
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono text-neutral-500">
          Allocated: <span className="font-semibold text-neutral-800">{balance.totalWeight}%</span> • Remaining:{' '}
          <span className="font-semibold text-neutral-800">{balance.remainingWeight}%</span>
        </div>
      </div>
    </Card>
  );
}

