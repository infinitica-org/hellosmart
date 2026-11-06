'use client';

import React, { useState } from 'react';
import {
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import {
  Card,
  TextureButton,
  Button,
  Badge,
  Input,
  Alert,
  EmptyState,
  Spinner,
} from '@hs/ui';
import type {
  PlatformAiKeyDto,
  AiProvider,
  PlatformKeyStatus,
} from '@hs/contracts';
import {
  useGetPlatformAiKeysQuery,
  useCreatePlatformAiKeyMutation,
  useUpdatePlatformAiKeyMutation,
  useRevokePlatformAiKeyMutation,
  useTestPlatformAiKeyMutation,
} from '@/store/admin/adminApi';

export function AiKeysVaultTab() {
  const { data: keys = [], isLoading, error, refetch } = useGetPlatformAiKeysQuery();

  const [createKey, { isLoading: isCreating }] = useCreatePlatformAiKeyMutation();
  const [updateKey, { isLoading: isUpdating }] = useUpdatePlatformAiKeyMutation();
  const [revokeKey, { isLoading: isRevoking }] = useRevokePlatformAiKeyMutation();
  const [testKey, { isLoading: isTesting }] = useTestPlatformAiKeyMutation();

  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');

  // Modal states
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedKeyForEdit, setSelectedKeyForEdit] = useState<PlatformAiKeyDto | null>(null);
  const [selectedKeyForRevoke, setSelectedKeyForRevoke] = useState<PlatformAiKeyDto | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form states for Register Key
  const [newProvider, setNewProvider] = useState<AiProvider>('openai');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Form states for Edit / Rotate Key
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<PlatformKeyStatus>('active');
  const [rotateApiKey, setRotateApiKey] = useState('');
  const [showRotateKey, setShowRotateKey] = useState(false);

  const resetRegisterForm = () => {
    setNewProvider('openai');
    setNewName('');
    setNewDescription('');
    setNewApiKey('');
    setShowApiKey(false);
    setActionError(null);
  };

  const handleCloseRegister = () => {
    resetRegisterForm();
    setIsRegisterOpen(false);
  };

  const handleOpenRegister = () => {
    resetRegisterForm();
    setIsRegisterOpen(true);
  };

  const resetEditForm = () => {
    setSelectedKeyForEdit(null);
    setEditName('');
    setEditDescription('');
    setEditStatus('active');
    setRotateApiKey('');
    setShowRotateKey(false);
    setActionError(null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (!newName.trim() || newName.trim().length < 2) {
      setActionError('Key name must be at least 2 characters');
      return;
    }
    if (!newApiKey.trim() || newApiKey.trim().length < 8) {
      setActionError('API key secret must be at least 8 characters');
      return;
    }

    try {
      await createKey({
        provider: newProvider,
        name: newName.trim(),
        description: newDescription.trim() || undefined,
        apiKey: newApiKey.trim(),
      }).unwrap();

      handleCloseRegister();
    } catch (err: any) {
      setActionError(err?.data?.detail || err?.message || 'Failed to vault platform key');
    }
  };

  const handleOpenEdit = (key: PlatformAiKeyDto) => {
    setSelectedKeyForEdit(key);
    setEditName(key.name);
    setEditDescription(key.description || '');
    setEditStatus(key.status);
    setRotateApiKey('');
    setShowRotateKey(false);
    setActionError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKeyForEdit) return;
    setActionError(null);

    try {
      await updateKey({
        id: selectedKeyForEdit.id,
        data: {
          name: editName.trim() || undefined,
          description: editDescription.trim() || undefined,
          status: editStatus,
          apiKey: rotateApiKey.trim() ? rotateApiKey.trim() : undefined,
        },
      }).unwrap();

      resetEditForm();
    } catch (err: any) {
      setActionError(err?.data?.detail || err?.message || 'Failed to update platform key');
    }
  };

  const handleRevokeConfirm = async () => {
    if (!selectedKeyForRevoke) return;
    setActionError(null);

    try {
      await revokeKey(selectedKeyForRevoke.id).unwrap();
      setSelectedKeyForRevoke(null);
    } catch (err: any) {
      setActionError(err?.data?.detail || err?.message || 'Failed to revoke platform key');
    }
  };

  const handleVerifyIntegrity = async (keyId: string) => {
    setTestResult(null);
    try {
      const res = await testKey(keyId).unwrap();
      setTestResult({ id: keyId, success: res.success, message: res.message });
    } catch (err: any) {
      setTestResult({
        id: keyId,
        success: false,
        message: err?.data?.detail || err?.message || 'Envelope verification failed',
      });
    }
  };

  const filteredKeys = keys.filter((k) => {
    const matchesSearch =
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.maskedKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.provider.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProvider = providerFilter === 'all' || k.provider === providerFilter;
    return matchesSearch && matchesProvider;
  });

  const getProviderBadge = (provider: AiProvider) => {
    switch (provider) {
      case 'openai':
        return <Badge variant="default" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">OpenAI</Badge>;
      case 'anthropic':
        return <Badge variant="default" className="border-amber-500/30 text-amber-400 bg-amber-500/10">Anthropic</Badge>;
      case 'gemini':
        return <Badge variant="default" className="border-blue-500/30 text-blue-400 bg-blue-500/10">Google Gemini</Badge>;
      case 'deepseek':
        return <Badge variant="default" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10">DeepSeek</Badge>;
      default:
        return <Badge variant="default">{provider}</Badge>;
    }
  };

  const getStatusBadge = (status: PlatformKeyStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'inactive':
        return <Badge variant="warning">Inactive</Badge>;
      case 'revoked':
        return <Badge variant="danger">Revoked</Badge>;
    }
  };

  const formatDollars = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap gap-3 items-center w-full sm:w-auto">
          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search keys by name, provider, last4..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-slate-900/60 border-slate-800 text-sm w-full"
            />
          </div>
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            className="h-9 px-3 bg-slate-900/60 border border-slate-800 rounded-md text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Providers</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <TextureButton
            variant="primary"
            size="sm"
            onClick={handleOpenRegister}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Vault Platform Key
          </TextureButton>
        </div>
      </div>

      {/* Security Info Alert */}
      <Alert className="bg-slate-900/40 border-slate-800/80 text-slate-300 py-3">
        <div className="flex items-center gap-2 text-xs">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>Zero Secret Leakage Guarantee:</strong> Platform API keys are encrypted at rest using AES-256-GCM.
            Raw secrets are never returned in list/detail APIs or rendered in the DOM. Workspaces access keys only via the short-lived AI proxy.
          </span>
        </div>
      </Alert>

      {/* Global Error Banner if any */}
      {actionError && (
        <Alert variant="error" className="py-2.5">
          <div className="flex items-center justify-between text-sm">
            <span>{actionError}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActionError(null)}
              className="h-6 px-2 text-xs"
            >
              Dismiss
            </Button>
          </div>
        </Alert>
      )}

      {/* Keys Table Card */}
      <Card className="bg-slate-900/60 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-3">
            <Spinner className="w-8 h-8 text-indigo-500" />
            <p className="text-sm text-slate-400">Loading vaulted platform keys...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <EmptyState
            icon={<KeyRound className="w-8 h-8 text-slate-500" />}
            title="No Vaulted Platform Keys"
            description={
              searchQuery || providerFilter !== 'all'
                ? 'No keys match the current filter criteria.'
                : 'No platform AI provider keys have been registered yet. Add a key to enable managed credit allocations.'
            }
            action={
              !searchQuery && providerFilter === 'all'
                ? {
                    label: 'Register First Key',
                    onClick: handleOpenRegister,
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Key Name</th>
                  <th className="py-3 px-4">Masked Key</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Total Allocated</th>
                  <th className="py-3 px-4">Active Tenancies</th>
                  <th className="py-3 px-4">Last Verified</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredKeys.map((key) => {
                  const isCurrentTesting = isTesting && testResult?.id === key.id;
                  const currentResult = testResult?.id === key.id ? testResult : null;

                  return (
                    <tr key={key.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getProviderBadge(key.provider)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-200">{key.name}</div>
                        {key.description && (
                          <div className="text-xs text-slate-400 truncate max-w-xs">{key.description}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                        <span className="px-2 py-0.5 rounded bg-slate-950/60 border border-slate-800/80">
                          {key.maskedKey}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getStatusBadge(key.status)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-200">
                        {formatDollars(key.totalAllocatedCents)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                        {key.activeAllocationsCount} {key.activeAllocationsCount === 1 ? 'org' : 'orgs'}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-400">
                        {currentResult ? (
                          <span
                            className={`flex items-center gap-1 font-medium ${
                              currentResult.success ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {currentResult.success ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {currentResult.success ? 'Integrity OK' : 'Integrity Failed'}
                          </span>
                        ) : key.lastTestedAt ? (
                          new Date(key.lastTestedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-500">Unverified</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVerifyIntegrity(key.id)}
                            disabled={key.status === 'revoked' || isCurrentTesting}
                            className="h-8 px-2.5 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                            title="Verify AES-256-GCM envelope health and decryption integrity"
                          >
                            <ShieldCheck className={`w-3.5 h-3.5 mr-1 ${isCurrentTesting ? 'animate-spin' : ''}`} />
                            Verify Integrity
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(key)}
                            disabled={key.status === 'revoked'}
                            className="h-8 px-2.5 text-xs text-slate-300 hover:text-white"
                          >
                            Rotate / Edit
                          </Button>
                          {key.status !== 'revoked' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedKeyForRevoke(key)}
                              className="h-8 px-2.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal: Register New Key */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                Vault Platform AI Provider Key
              </h3>
              <button
                onClick={handleCloseRegister}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  AI Provider <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value as AiProvider)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="openai">OpenAI (GPT-4o, o1, etc.)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet, etc.)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 Pro, Flash, etc.)</option>
                  <option value="deepseek">DeepSeek (DeepSeek-V3, R1, etc.)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Key Name / Label <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Master Production OpenAI Key"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Dedicated tier for enterprise candidate assessments"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Secret API Key <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..., AIza..., etc."
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="bg-slate-950 border-slate-800 pr-10 font-mono text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Plaintext key is encrypted in memory using AES-256-GCM. Only masked characters and ciphertext envelope are stored.
                </p>
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCloseRegister}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <TextureButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isCreating}
                  className="flex items-center gap-1.5"
                >
                  {isCreating ? <Spinner className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  Encrypt & Vault Key
                </TextureButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit / Rotate Key */}
      {selectedKeyForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
                Edit / Rotate Platform Key
              </h3>
              <button
                onClick={resetEditForm}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Key Name
                </label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description
                </label>
                <Input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as PlatformKeyStatus)}
                  className="w-full h-9 px-3 bg-slate-950 border border-slate-800 rounded-md text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Rotate Secret Key (Leave blank to keep existing key)
                </label>
                <div className="relative">
                  <Input
                    type={showRotateKey ? 'text' : 'password'}
                    placeholder="Enter new secret key to rotate..."
                    value={rotateApiKey}
                    onChange={(e) => setRotateApiKey(e.target.value)}
                    className="bg-slate-950 border-slate-800 pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRotateKey(!showRotateKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showRotateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Rotating will update the encrypted envelope in place. Current key: {selectedKeyForEdit.maskedKey}
                </p>
              </div>

              {actionError && (
                <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                  {actionError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetEditForm}
                  disabled={isUpdating}
                >
                  Cancel
                </Button>
                <TextureButton
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isUpdating}
                  className="flex items-center gap-1.5"
                >
                  {isUpdating ? <Spinner className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  Save Changes
                </TextureButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Revoke Key Confirmation */}
      {selectedKeyForRevoke && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-semibold text-slate-100">Revoke Platform Key</h3>
            </div>
            <p className="text-sm text-slate-300">
              Are you sure you want to revoke <strong className="text-white">{selectedKeyForRevoke.name}</strong> ({selectedKeyForRevoke.maskedKey})?
            </p>
            <p className="text-xs text-slate-400">
              Revoking marks this key as unusable for new credit allocations. Existing allocations mapped to this key will fail upstream calls until re-keyed.
            </p>

            {actionError && (
              <div className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
                {actionError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedKeyForRevoke(null)}
                disabled={isRevoking}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRevokeConfirm}
                disabled={isRevoking}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isRevoking ? <Spinner className="w-4 h-4 mr-1.5" /> : null}
                Confirm Revocation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
