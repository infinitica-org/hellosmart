'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Input,
  StatCard,
  Alert,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@hs/ui';

export interface ProviderKeyItem {
  id: string;
  provider: 'anthropic' | 'openai' | 'google';
  displayName: string;
  maskedKey: string;
  status: 'active' | 'untested';
  lastTestedAt: string;
}

export const INITIAL_PROVIDER_KEYS: ProviderKeyItem[] = [
  {
    id: 'key_anthropic_01',
    provider: 'anthropic',
    displayName: 'Anthropic Claude (Sonnet 3.5)',
    maskedKey: 'sk-ant-api03-••••••••••••••••••••••••••89a2',
    status: 'active',
    lastTestedAt: '2026-10-30T10:15:00Z',
  },
  {
    id: 'key_openai_02',
    provider: 'openai',
    displayName: 'OpenAI (GPT-4o)',
    maskedKey: 'sk-proj-••••••••••••••••••••••••••41f0',
    status: 'active',
    lastTestedAt: '2026-10-29T16:40:00Z',
  },
  {
    id: 'key_google_03',
    provider: 'google',
    displayName: 'Google Gemini (1.5 Pro)',
    maskedKey: 'AIzaSy••••••••••••••••••••••••••7k12',
    status: 'active',
    lastTestedAt: '2026-10-28T12:00:00Z',
  },
];

export function CompanySettingsView() {
  const [orgName, setOrgName] = useState('Acme Simulation Academy');
  const [timezone, setTimezone] = useState('UTC');
  const [keys, setKeys] = useState<ProviderKeyItem[]>(INITIAL_PROVIDER_KEYS);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAddKeyOpen, setIsAddKeyOpen] = useState(false);
  const [newProvider, setNewProvider] = useState<'anthropic' | 'openai' | 'google'>('anthropic');
  const [newKeyValue, setNewKeyValue] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyValue.trim()) return;

    const last4 = newKeyValue.slice(-4);
    const added: ProviderKeyItem = {
      id: `key_${Date.now()}`,
      provider: newProvider,
      displayName:
        newProvider === 'anthropic'
          ? 'Anthropic Claude'
          : newProvider === 'openai'
            ? 'OpenAI'
            : 'Google Gemini',
      maskedKey: `sk-••••••••••••••••••••••••••${last4}`,
      status: 'active',
      lastTestedAt: new Date().toISOString(),
    };

    setKeys([...keys, added]);
    setIsAddKeyOpen(false);
    setNewKeyValue('');
  };

  return (
    <div className="space-y-6" data-testid="company-settings-page">
      <PageHeader
        title="Settings & Integrations"
        description="Organization preferences, branding, AI provider key vault, and billing configuration."
        badge={{ text: 'Company Admin', variant: 'default' }}
        data-testid="company-settings-header"
      />

      {saveSuccess && (
        <Alert variant="success" data-testid="settings-save-success">
          Organization settings and governance preferences have been saved successfully.
        </Alert>
      )}

      {/* Summary Entitlement Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Subscription Plan"
          value="Pro Simulation"
          description="14-day evaluation trial"
          data-testid="stat-plan"
        />
        <StatCard
          label="Candidate Cap"
          value="25 Candidates"
          description="Server-enforced quota (BR-06)"
          data-testid="stat-cand-cap"
        />
        <StatCard
          label="Blueprint Quota"
          value="5 Templates"
          description="Private assigned templates (BR-02)"
          data-testid="stat-template-cap"
        />
        <StatCard
          label="Data Retention"
          value="90 Days"
          description="Automatic audit cleanup (BR-31)"
          data-testid="stat-retention"
        />
      </div>

      {/* Section 1: Organization Profile & Branding */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Organization & Branding</h2>
          <p className="text-xs text-neutral-500 font-normal mt-0.5">
            Basic company identity and candidate workspace appearance settings.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4 max-w-xl text-xs">
          <div className="space-y-1">
            <label className="font-medium text-neutral-700 block">Company Legal / Display Name</label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="text-xs"
              data-testid="settings-org-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-medium text-neutral-700 block">Default Timezone</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="text-xs"
                data-testid="settings-timezone-input"
              />
              <span className="text-[11px] text-neutral-400 block">
                Window scheduling references; timers enforce UTC (BR-08).
              </span>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-neutral-700 block">White-Label Branding (BR-29)</label>
              <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
                <span className="text-neutral-600 font-mono text-[11px]">Powered by HelloSmart</span>
                <Badge variant="default" size="sm">
                  Add-on
                </Badge>
              </div>
            </div>
          </div>

          <Button type="submit" variant="primary" size="sm" data-testid="save-org-settings-btn">
            Save Preferences
          </Button>
        </form>
      </Card>

      {/* Section 2: AI Provider Key Vault (BR-16) */}
      <Card className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900">AI Provider Key Vault (BYOK)</h2>
              <Badge variant="success" size="sm">
                AES-256 Vaulted
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 font-normal mt-0.5">
              Securely store API keys for candidate AI proxy assistants. Keys are tested on save and never returned in full (BR-16).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddKeyOpen(true)}
            data-testid="add-provider-key-btn"
          >
            + Add Provider Key
          </Button>
        </div>

        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              data-testid={`key-row-${k.id}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-neutral-900">{k.displayName}</span>
                  <Badge variant="success" size="sm">
                    {k.status}
                  </Badge>
                </div>
                <div className="font-mono text-neutral-600 text-[11px]">{k.maskedKey}</div>
              </div>

              <div className="text-right space-y-0.5">
                <span className="text-[11px] text-neutral-400 block font-mono">
                  Verified: {new Date(k.lastTestedAt).toLocaleDateString()}
                </span>
                <span className="text-[11px] text-emerald-600 font-medium block">
                  ✓ Proxy Egress Authorized (BR-13)
                </span>
              </div>
            </div>
          ))}
        </div>

        <Alert variant="info" className="text-xs">
          <strong>Security Invariant (BR-13, BR-16):</strong> Candidate workspaces hold only temporary, short-lived session tokens. Workspaces never receive raw provider keys; all calls are policy-checked, token-capped, and logged via the AI Proxy.
        </Alert>
      </Card>

      {/* Section 3: Workspace Governance & Security Controls */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-neutral-900">Controlled Workspace Policy</h2>
          <p className="text-xs text-neutral-500 font-normal mt-0.5">
            Platform-wide invariants enforced during candidate assessment sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50 space-y-1.5">
            <span className="font-semibold text-neutral-800 block">Full-Screen Mode (BR-10)</span>
            <p className="text-neutral-600 text-[11px]">
              Connecting requests browser full-screen. Exiting disconnects the workspace and requires explicit resume.
            </p>
            <Badge variant="primary" size="sm">
              Enforced Server-Side
            </Badge>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50 space-y-1.5">
            <span className="font-semibold text-neutral-800 block">Continuous Autosave (BR-11)</span>
            <p className="text-neutral-600 text-[11px]">
              Editor files, terminal history, and chat transcripts persist continuously with RPO &le; 30 seconds.
            </p>
            <Badge variant="success" size="sm">
              Continuous Persistence
            </Badge>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50 space-y-1.5">
            <span className="font-semibold text-neutral-800 block">Timer on Disconnect (BR-09)</span>
            <p className="text-neutral-600 text-[11px]">
              Timer keeps running while candidate is disconnected unless explicitly paused in assessment blueprint.
            </p>
            <Badge variant="default" size="sm">
              Runs Continuously
            </Badge>
          </div>

          <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50 space-y-1.5">
            <span className="font-semibold text-neutral-800 block">No Real Cloud Credentials (BR-33)</span>
            <p className="text-neutral-600 text-[11px]">
              Workspaces utilize LocalStack and sandboxed mocks. Real cloud credentials are never provisioned to candidates.
            </p>
            <Badge variant="info" size="sm">
              LocalStack Sandboxed
            </Badge>
          </div>
        </div>
      </Card>

      {/* Add Provider Key Modal */}
      {isAddKeyOpen && (
        <Dialog open={isAddKeyOpen} onClose={() => setIsAddKeyOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add AI Provider Key</DialogTitle>
              <DialogDescription>
                Store your company AI provider key in the encrypted vault (BR-16).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddKey} className="space-y-4 py-2 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-neutral-700 block">Provider</label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-xs bg-white"
                  data-testid="provider-select"
                >
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="google">Google Gemini</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-neutral-700 block">API Secret Key</label>
                <Input
                  required
                  type="password"
                  placeholder="Paste sk-... or AIza..."
                  value={newKeyValue}
                  onChange={(e) => setNewKeyValue(e.target.value)}
                  className="text-xs font-mono"
                  data-testid="api-key-input"
                />
                <span className="text-[11px] text-neutral-400 block">
                  Encrypted upon receipt. Only the last 4 characters are ever displayed.
                </span>
              </div>

              <DialogFooter className="pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddKeyOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" data-testid="submit-add-key-btn">
                  Vault & Verify Key
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function CompanySettingsPage() {
  return <CompanySettingsView />;
}
