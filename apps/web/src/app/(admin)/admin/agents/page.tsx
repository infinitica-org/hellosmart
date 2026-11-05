'use client';

import React, { useState } from 'react';
import { Bot, Cpu, CheckCircle2, Layers, Sliders, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Card,
  SearchInput,
  Badge,
  Alert,
  EmptyState,
  TextureButton,
} from '@hs/ui';

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
  mode: 'post_session';
  status: 'healthy' | 'updating';
  description: string;
  signals: string[];
  defaultWeight: number;
  model: string;
}

export interface AdminAgentsPageProps {
  initialAgents?: AgentInfo[];
}

export default function AdminAgentsPage({ initialAgents }: AdminAgentsPageProps = {}) {
  const [agents, setAgents] = useState<AgentInfo[]>(initialAgents || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasAgents = agents.length > 0;
  const healthyCount = agents.filter((a) => a.status === 'healthy').length;

  const filteredAgents = agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.signals.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Reviewer Agent Library"
        description="Inspect independent evaluation agents, rubric anchor dimensions, and aggregator telemetry."
        badge={{ text: 'Agent Service', variant: 'info' }}
        data-testid="admin-agents-header"
      />

      {/* Top Telemetry Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="ACTIVE REVIEWER AGENTS"
          value={hasAgents ? agents.length.toString() : '0'}
          description={
            hasAgents
              ? 'Independent evaluation engines ready'
              : 'No evaluation engines registered'
          }
          icon={<Bot className={`h-5 w-5 ${hasAgents ? 'text-primary' : 'text-neutral-400'}`} />}
          data-testid="stat-active-agents"
        />
        <StatCard
          label="SUPPORTED RUNTIMES"
          value={hasAgents ? 'Node, Python, Go' : '—'}
          description={
            hasAgents
              ? 'Cloud VM & Chat workspace evaluation tracks'
              : 'Workspace evaluation tracks in standby'
          }
          icon={<Cpu className={`h-5 w-5 ${hasAgents ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'}`} />}
          data-testid="stat-supported-runtimes"
        />
        <StatCard
          label="CONSENSUS AGGREGATOR"
          value={hasAgents ? `${healthyCount}/${agents.length} Healthy` : 'Standby'}
          description={
            hasAgents
              ? 'Disagreement threshold flags anomaly for human'
              : 'Aggregator idle until reviewer agents are deployed'
          }
          icon={
            <CheckCircle2
              className={`h-5 w-5 ${hasAgents ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-400'}`}
            />
          }
          data-testid="stat-aggregator-health"
        />
      </div>

      {/* Agent Catalog Card */}
      <Card className="rounded-xl border border-neutral-200/80 bg-white p-4 sm:p-6 shadow-2xs space-y-4">
        {/* Toolbar Header */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="w-full sm:w-80 md:w-96">
            <SearchInput
              size="sm"
              placeholder="Search reviewer agents by name, signal, or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              shortcutKey={false}
              autoShortcut={false}
              data-testid="agents-search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <TextureButton
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              className="h-10 text-xs sm:text-sm font-medium rounded-md"
              data-testid="agents-refresh-btn"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Verify Agent Health
            </TextureButton>
          </div>
        </div>

        {/* Agents Grid */}
        {filteredAgents.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No Reviewer Agents Found' : 'No Reviewer Agents Registered'}
            description={
              searchQuery
                ? `No agent matches your search query "${searchQuery}".`
                : 'Independent reviewer agents (BR-18) evaluate candidate workspaces post-session against assigned rubric dimensions. No agents are currently configured in this environment.'
            }
            action={
              searchQuery
                ? {
                    label: 'Reset Filter',
                    onClick: () => setSearchQuery(''),
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-neutral-200 p-5 bg-neutral-50/50 hover:bg-white hover:border-neutral-300 transition-all space-y-3 shadow-2xs"
                data-testid={`agent-card-${agent.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-neutral-900">{agent.name}</h3>
                      <span className="font-mono text-[11px] text-neutral-500 bg-neutral-200/60 px-1.5 py-0.5 rounded">
                        {agent.version}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 line-clamp-2">{agent.description}</p>
                  </div>
                  <Badge variant="success" size="sm" className="shrink-0 capitalize">
                    {agent.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {agent.signals.map((sig) => (
                    <span
                      key={sig}
                      className="text-[11px] font-medium text-neutral-600 bg-white border border-neutral-200 px-2 py-0.5 rounded-md"
                    >
                      {sig}
                    </span>
                  ))}
                </div>

                <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between text-xs text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    {agent.model}
                  </span>
                  <span>Default Weight: <strong className="text-neutral-900">{agent.defaultWeight}%</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Invariant Alert */}
      <Alert variant="info" className="text-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
          <div className="space-y-1">
            <div className="font-semibold text-neutral-900">
              Human-In-The-Loop Final Assessment
            </div>
            <p className="text-neutral-600">
              Reviewer agents evaluate independently and mandate factual citations from candidate evidence. 
              The system never auto-rejects candidates based on agent scores or telemetry signals.
            </p>
          </div>
          <div className="font-mono text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/25 shrink-0 font-medium">
            Post-Session Review Mode
          </div>
        </div>
      </Alert>
    </div>
  );
}
