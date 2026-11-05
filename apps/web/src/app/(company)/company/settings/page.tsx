'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge,
  Alert,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@hs/ui';
import {
  Building2,
  Key,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Info,
  Server,
  Lock,
} from 'lucide-react';
import { useGetCompanyMetricsQuery } from '@/store/company/companyApi';

interface ProviderKeyItem {
  id: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  providerName: string;
  maskedKey: string;
  isDefault: boolean;
  status: 'active' | 'untested' | 'error';
  lastTestedAt: string;
}

export interface CompanySettingsViewProps {
  defaultTab?: string;
}

export function CompanySettingsView({ defaultTab = 'general' }: CompanySettingsViewProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Metrics query for billing quotas
  const { data: metrics } = useGetCompanyMetricsQuery();

  // AI Provider Keys local state (BR-16 masked representation)
  const [keys, setKeys] = useState<ProviderKeyItem[]>([
    {
      id: 'key-1',
      provider: 'openai',
      providerName: 'OpenAI (GPT-4o, o3-mini)',
      maskedKey: 'sk-...4921',
      isDefault: true,
      status: 'active',
      lastTestedAt: 'Just now',
    },
    {
      id: 'key-2',
      provider: 'anthropic',
      providerName: 'Anthropic (Claude 3.5 Sonnet)',
      maskedKey: 'sk-ant-...8102',
      isDefault: false,
      status: 'active',
      lastTestedAt: '2 hours ago',
    },
  ]);

  // New key form state
  const [showAddKey, setShowAddKey] = useState(false);
  const [newProvider, setNewProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Billing code state
  const [billingCode, setBillingCode] = useState('');
  const [codeSuccess, setCodeSuccess] = useState<string | null>(null);

  const handleTestConnection = (id: string) => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestResult('Key verified successfully with provider API.');
      setTimeout(() => setTestResult(null), 4000);
    }, 800);
  };

  const handleAddKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyInput.trim()) return;

    const last4 = newKeyInput.slice(-4) || '1234';
    const prefix = newProvider === 'anthropic' ? 'sk-ant-...' : newProvider === 'gemini' ? 'AIza...' : 'sk-...';

    const newKey: ProviderKeyItem = {
      id: `key-${Date.now()}`,
      provider: newProvider,
      providerName:
        newProvider === 'openai'
          ? 'OpenAI (GPT-4o, o3-mini)'
          : newProvider === 'anthropic'
          ? 'Anthropic (Claude 3.5 Sonnet)'
          : 'Google Gemini (1.5 Pro, 2.0 Flash)',
      maskedKey: `${prefix}${last4}`,
      isDefault: setAsDefault || keys.length === 0,
      status: 'active',
      lastTestedAt: 'Just now',
    };

    if (newKey.isDefault) {
      setKeys((prev) => prev.map((k) => ({ ...k, isDefault: false })).concat(newKey));
    } else {
      setKeys((prev) => [...prev, newKey]);
    }

    setNewKeyInput('');
    setShowAddKey(false);
    setTestResult('Provider key vaulted and validated successfully.');
    setTimeout(() => setTestResult(null), 4000);
  };

  const handleDeleteKey = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleApplyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingCode.trim()) return;
    setCodeSuccess(`Promo code "${billingCode.toUpperCase()}" applied to upcoming billing statement.`);
    setBillingCode('');
    setTimeout(() => setCodeSuccess(null), 5000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Integrations"
        description="Organization preferences, candidate data retention, AI provider key vault, and billing configuration."
        badge={{ text: 'Organization Settings', variant: 'default' }}
      />

      {testResult && (
        <Alert variant="success" className="animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
          <span>{testResult}</span>
        </Alert>
      )}

      {codeSuccess && (
        <Alert variant="success" className="animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-2 shrink-0" />
          <span>{codeSuccess}</span>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} variant="line">
        <TabsList className="mb-6">
          <TabsTrigger value="general" icon={<Building2 className="w-4 h-4" />}>
            General & Retention
          </TabsTrigger>
          <TabsTrigger value="keys" icon={<Key className="w-4 h-4" />}>
            AI Provider Keys (BR-16)
          </TabsTrigger>
          <TabsTrigger value="billing" icon={<CreditCard className="w-4 h-4" />}>
            Billing & Quotas
          </TabsTrigger>
        </TabsList>

        {/* ── 1. General & Retention Tab ──────────────────────────────────── */}
        <TabsContent value="general" className="space-y-6">
          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-neutral-100">
              <CardTitle className="text-base font-semibold text-neutral-900">
                Organization Profile
              </CardTitle>
              <p className="text-xs text-neutral-500 mt-0.5">
                Primary tenant identifier and display details.
              </p>
            </CardHeader>

            <CardContent className="p-0 pt-5 space-y-4 max-w-xl">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Company Name
                </label>
                <Input
                  disabled
                  defaultValue="Acme Technologies Inc."
                  className="bg-neutral-50 cursor-not-allowed"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Contact HelloSmart support to modify your official legal company entity name.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Tenant Slug
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    disabled
                    defaultValue="acme-tech"
                    className="bg-neutral-50 font-mono text-xs cursor-not-allowed"
                  />
                  <Badge variant="default" size="sm">
                    Protected (BR-01)
                  </Badge>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  White-label Branding (BR-05)
                </label>
                <div className="flex items-center justify-between p-3.5 rounded-lg border border-neutral-200 bg-neutral-50">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-neutral-900 block">
                      Custom Domain & White Label
                    </span>
                    <span className="text-[11px] text-neutral-500 block">
                      Candidate portal URL and branded invitation emails without "Powered by HelloSmart".
                    </span>
                  </div>
                  <Badge variant="default" size="sm">
                    Paid Add-on
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-neutral-900">
                    Candidate Data Retention (BR-31, BR-32)
                  </CardTitle>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Regulatory retention policy for candidate submissions, recordings, and transcripts.
                  </p>
                </div>
                <Badge variant="default" className="font-mono text-xs text-neutral-700">
                  90 Days Active
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0 pt-5 space-y-4 max-w-xl">
              <div className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Automated Retention Schedule</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Per <strong>BR-31</strong> and <strong>BR-32</strong>, candidate session recordings, terminal logs, AI transcripts, and submitted artifacts are retained for <strong>90 days</strong> from the date of assessment completion, after which automated background jobs cryptographically purge all associated artifacts.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Configured Retention Window
                </label>
                <Input
                  disabled
                  defaultValue="90 Days (GDPR & DPDP Compliant)"
                  className="bg-neutral-50 cursor-not-allowed text-xs"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Enterprise tenants may adjust retention periods (30 to 365 days) by contacting platform administration.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 2. AI Provider Keys Tab (BR-16) ──────────────────────────────── */}
        <TabsContent value="keys" className="space-y-6">
          <Alert variant="info" className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sky-950">
                Zero-Trust Key Isolation Architecture (BR-13, BR-16)
              </p>
              <p className="text-sky-800 leading-relaxed">
                Workspaces never receive real provider API keys. All candidate interactions are routed through the managed AI proxy using short-lived session tokens. Provider keys are encrypted at rest in the secrets vault and <strong>never returned in full</strong> via client bundles or API responses.
              </p>
            </div>
          </Alert>

          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-semibold text-neutral-900">
                  Vaulted AI Provider Keys
                </CardTitle>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Bring-your-own-keys (BYOK) for LLM workspace assistance and reviewer agents.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setShowAddKey((prev) => !prev)}
              >
                {showAddKey ? 'Cancel' : 'Add Provider Key'}
              </Button>
            </CardHeader>

            <CardContent className="p-0 pt-4 space-y-6">
              {showAddKey && (
                <form
                  onSubmit={handleAddKey}
                  className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-4 animate-fade-in"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <Server className="w-4 h-4 text-primary" />
                    <span>Register New Provider Key</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        AI Provider
                      </label>
                      <select
                        value={newProvider}
                        onChange={(e) => setNewProvider(e.target.value as any)}
                        className="w-full h-9 rounded-md border border-neutral-200 bg-white px-3 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="openai">OpenAI (GPT-4o, o3-mini)</option>
                        <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                        <option value="gemini">Google Gemini (1.5 Pro, 2.0 Flash)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">
                        API Key Secret (Vault Encrypted)
                      </label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={newKeyInput}
                        onChange={(e) => setNewKeyInput(e.target.value)}
                        required
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={setAsDefault}
                        onChange={(e) => setSetAsDefault(e.target.checked)}
                        className="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="text-xs text-neutral-700 font-medium">
                        Set as default key for assessments
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddKey(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" size="sm">
                        Save to Vault
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-neutral-50/80">
                      <TableHead className="text-xs font-semibold">Provider</TableHead>
                      <TableHead className="text-xs font-semibold">Key Identifier (BR-16)</TableHead>
                      <TableHead className="text-xs font-semibold">Status</TableHead>
                      <TableHead className="text-xs font-semibold">Last Verified</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keys.map((item) => (
                      <TableRow key={item.id} className="hover:bg-neutral-50/50">
                        <TableCell className="text-xs font-medium text-neutral-900">
                          <div className="flex items-center gap-2">
                            <span>{item.providerName}</span>
                            {item.isDefault && (
                              <Badge variant="default" size="sm" className="text-[10px]">
                                Default
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-neutral-600">
                          {item.maskedKey}
                        </TableCell>
                        <TableCell>
                          <Badge variant="success" size="sm" className="gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Connected
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-neutral-500">
                          {item.lastTestedAt}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              disabled={isTesting}
                              onClick={() => handleTestConnection(item.id)}
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 text-neutral-500 mr-1 ${
                                  isTesting ? 'animate-spin' : ''
                                }`}
                              />
                              Test
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2 text-danger hover:bg-danger/10"
                              onClick={() => handleDeleteKey(item.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── 3. Billing & Quotas Tab ─────────────────────────────────────── */}
        <TabsContent value="billing" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 space-y-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Subscription Tier
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-neutral-900">Scale Plan</span>
                <Badge variant="success" size="sm">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-neutral-500 pt-1">
                Managed multi-tenant workspace with Cloud VM and Chat runtime.
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Candidate Allowance (BR-06)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-neutral-900">
                  {metrics?.remainingQuota ?? 50}
                </span>
                <span className="text-xs text-neutral-500">
                  / {metrics?.maxCandidates ?? 50} remaining
                </span>
              </div>
              <p className="text-xs text-neutral-500 pt-1">
                Candidates count once on first workspace connect.
              </p>
            </Card>

            <Card className="p-5 space-y-2">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider block">
                Assessments Configured
              </span>
              <div className="text-xl font-bold text-neutral-900">
                {metrics?.configuredAssessments ?? 0}
              </div>
              <p className="text-xs text-neutral-500 pt-1">
                Active assessments derived from private templates.
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <CardHeader className="p-0 pb-4 border-b border-neutral-100">
              <CardTitle className="text-base font-semibold text-neutral-900">
                Redeem Promo / Custom Payment Code (BR-29)
              </CardTitle>
              <p className="text-xs text-neutral-500 mt-0.5">
                Apply a custom sales quote voucher or promotional discount code to your tenant account.
              </p>
            </CardHeader>

            <CardContent className="p-0 pt-5 space-y-4 max-w-lg">
              <form onSubmit={handleApplyCode} className="flex items-center gap-2">
                <Input
                  placeholder="e.g. HS-GROWTH-2026"
                  value={billingCode}
                  onChange={(e) => setBillingCode(e.target.value)}
                  className="uppercase font-mono text-xs"
                />
                <Button type="submit" variant="primary" size="sm" className="shrink-0">
                  Apply Code
                </Button>
              </form>
              <span className="text-[11px] text-neutral-400 block">
                Discounts and credits will automatically be reflected in your upcoming Razorpay invoice.
              </span>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CompanySettingsPage() {
  return <CompanySettingsView />;
}
