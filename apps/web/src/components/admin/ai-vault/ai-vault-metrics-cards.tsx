'use client';

import React from 'react';
import { KeyRound, CreditCard, DollarSign, Wallet, ShieldCheck } from 'lucide-react';
import { StatCard } from '@hs/ui';
import type { PlatformAiVaultStatsDto } from '@hs/contracts';

interface AiVaultMetricsCardsProps {
  stats?: PlatformAiVaultStatsDto | undefined;
  isLoading?: boolean;
}

export function AiVaultMetricsCards({ stats, isLoading }: AiVaultMetricsCardsProps) {
  const formatDollars = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const totalKeys = stats?.totalKeys ?? 0;
  const activeKeys = stats?.activeKeys ?? 0;
  const totalAllocations = stats?.totalAllocations ?? 0;
  const totalAllocatedCents = stats?.totalAllocatedCents ?? 0;
  const totalUsedCents = stats?.totalUsedCents ?? 0;
  const totalRemainingBalanceCents = stats?.totalRemainingBalanceCents ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Vaulted Platform Keys"
        value={isLoading ? '...' : totalKeys.toString()}
        description={`${activeKeys} active in key ring`}
        icon={<KeyRound className="w-5 h-5 text-indigo-400" />}
      />
      <StatCard
        label="Tenant Allocations"
        value={isLoading ? '...' : totalAllocations.toString()}
        description="Across subscribed tenant orgs"
        icon={<CreditCard className="w-5 h-5 text-blue-400" />}
      />
      <StatCard
        label="Total Credits Allocated"
        value={isLoading ? '...' : formatDollars(totalAllocatedCents)}
        description={
          totalUsedCents > 0
            ? `Recorded usage: ${formatDollars(totalUsedCents)}`
            : 'Recorded usage: $0.00 (proxy metering unconnected)'
        }
        icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
      />
      <StatCard
        label="Available Remaining Balance"
        value={isLoading ? '...' : formatDollars(totalRemainingBalanceCents)}
        description="Active balance across tenants"
        icon={<Wallet className="w-5 h-5 text-purple-400" />}
      />
    </div>
  );
}
