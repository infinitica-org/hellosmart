'use client';

import React, { useState } from 'react';
import { KeyRound, CreditCard } from 'lucide-react';
import { PageHeader } from '@hs/ui';
import { AiVaultMetricsCards } from '@/components/admin/ai-vault/ai-vault-metrics-cards';
import { AiKeysVaultTab } from '@/components/admin/ai-vault/ai-keys-vault-tab';
import { CreditAllocationsTab } from '@/components/admin/ai-vault/credit-allocations-tab';
import { useGetAiVaultStatsQuery } from '@/store/admin/adminApi';

type TabType = 'keys' | 'allocations';

export default function AdminAiKeysPage() {
  const [activeTab, setActiveTab] = useState<TabType>('keys');
  const { data: stats, isLoading: isStatsLoading } = useGetAiVaultStatsQuery();

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 pb-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
            Platform AI Keys Vault & Credit Allocations
          </h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Super Admin
          </span>
        </div>
        <p className="text-sm text-slate-400 max-w-3xl">
          Centralized cryptographic vault for platform AI provider credentials and tenant-level credit allocations (AD-023 / AD-024).
        </p>
      </div>

      {/* Overview Metrics Cards */}
      <AiVaultMetricsCards stats={stats} isLoading={isStatsLoading} />

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('keys')}
            className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 transition-colors ${
              activeTab === 'keys'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Platform AI Keys Vault</span>
            {stats && (
              <span className="ml-1.5 py-0.5 px-2 rounded-full text-xs bg-slate-800 text-slate-300">
                {stats.totalKeys}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('allocations')}
            className={`py-3 px-1 border-b-2 font-medium text-sm inline-flex items-center gap-2 transition-colors ${
              activeTab === 'allocations'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Tenant Credit Allocations</span>
            {stats && (
              <span className="ml-1.5 py-0.5 px-2 rounded-full text-xs bg-slate-800 text-slate-300">
                {stats.totalAllocations}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'keys' ? <AiKeysVaultTab /> : <CreditAllocationsTab />}
      </div>
    </div>
  );
}
