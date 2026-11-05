'use client';

import React, { useState } from 'react';
import { Alert, Button, Card, Input } from '@hs/ui';
import {
  useGetMfaStatusQuery,
  useStartMfaSetupMutation,
  useConfirmMfaSetupMutation,
  useRegenerateBackupCodesMutation,
} from '@/store/admin/adminApi';
import { MfaSetupQr } from '@/components/security/mfa-setup-qr';

export default function AdminSecuritySettingsPage(): React.JSX.Element {
  const {
    data: status,
    isLoading: loadingStatus,
    error: statusError,
  } = useGetMfaStatusQuery();

  const [triggerStartSetup, { isLoading: isStartingSetup }] = useStartMfaSetupMutation();
  const [triggerConfirmSetup, { isLoading: isConfirmingSetup }] = useConfirmMfaSetupMutation();
  const [triggerRegenerateBackupCodes, { isLoading: isRegenerating }] =
    useRegenerateBackupCodesMutation();

  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const busy = isStartingSetup || isConfirmingSetup || isRegenerating;

  const getErrorMessage = (err: any, fallback: string): string => {
    return (
      err?.data?.detail ||
      err?.data?.message ||
      err?.message ||
      fallback
    );
  };

  const startSetup = async () => {
    setError(null);
    setBackupCodes(null);
    try {
      const data = await triggerStartSetup().unwrap();
      setSetupSecret(data.secret ?? null);
      setOtpauthUri(data.otpauthUri ?? null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not start MFA setup'));
    }
  };

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(confirmCode.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError(null);
    try {
      const data = await triggerConfirmSetup({ totpCode: confirmCode.trim() }).unwrap();
      setBackupCodes(data.backupCodes ?? []);
      setSetupSecret(null);
      setOtpauthUri(null);
      setConfirmCode('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not confirm MFA setup'));
    }
  };

  const regenerateBackupCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(regenerateCode.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError(null);
    setBackupCodes(null);
    try {
      const data = await triggerRegenerateBackupCodes({ totpCode: regenerateCode.trim() }).unwrap();
      setBackupCodes(data.backupCodes ?? []);
      setRegenerateCode('');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not generate backup codes'));
    }
  };

  const displayError =
    error ||
    (statusError
      ? getErrorMessage(statusError, 'Failed to load MFA status')
      : null);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Security</h1>
        <p className="text-sm text-neutral-600 mt-1">
          Platform administrators must use multi-factor authentication. Set up an authenticator app and
          store backup codes in a safe place.
        </p>
      </div>

      {displayError && (
        <Alert variant="error" className="text-sm">
          {displayError}
        </Alert>
      )}

      <Card className="p-6 space-y-4 border border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900">Multi-factor authentication</h2>
        {loadingStatus ? (
          <p className="text-sm text-neutral-500">Loading status…</p>
        ) : status?.enrolled ? (
          <div className="space-y-2 text-sm text-neutral-700">
            <p>
              <span className="font-semibold text-emerald-700">Enabled</span> — authenticator app is
              configured for this account.
            </p>
            <p>
              Unused backup codes remaining:{' '}
              <span className="font-mono font-semibold">{status.backupCodesRemaining}</span>
            </p>
            {status.backupCodesRemaining === 0 && (
              <Alert variant="warning" className="text-sm mt-2">
                No backup codes are stored for this account (for example if MFA was enabled via a legacy
                environment secret). Generate a new set below using your authenticator app.
              </Alert>
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            MFA is not enabled yet. You will be prompted for a code at sign-in after setup is complete.
          </p>
        )}

        {!status?.enrolled && !setupSecret && (
          <Button type="button" onClick={startSetup} disabled={busy || loadingStatus}>
            {busy ? 'Starting…' : 'Set up authenticator app'}
          </Button>
        )}

        {status?.enrolled && (
          <form onSubmit={regenerateBackupCodes} className="space-y-3 border-t border-neutral-100 pt-4">
            <p className="text-sm text-neutral-700">
              {status.backupCodesRemaining === 0
                ? 'Generate backup codes so you can sign in without your authenticator app.'
                : 'Replace all backup codes (old codes stop working immediately).'}
            </p>
            <label htmlFor="mfa-regenerate-code" className="text-xs font-medium text-neutral-700">
              Confirm with a 6-digit authenticator code
            </label>
            <Input
              id="mfa-regenerate-code"
              value={regenerateCode}
              onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              disabled={busy}
            />
            <Button type="submit" disabled={busy || regenerateCode.length !== 6}>
              {busy ? 'Generating…' : 'Generate new backup codes'}
            </Button>
          </form>
        )}

        {setupSecret && (
          <div className="space-y-4 border-t border-neutral-100 pt-4">
            <p className="text-sm text-neutral-700">
              Scan the QR code with Google Authenticator, 1Password, Authy, or another TOTP app. You can
              also enter the secret key manually if scanning is not available.
            </p>
            {otpauthUri && (
              <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                <MfaSetupQr otpauthUri={otpauthUri} />
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
                    Manual entry key
                  </p>
                  <p className="font-mono text-sm bg-neutral-100 rounded-lg p-3 break-all select-all">
                    {setupSecret}
                  </p>
                </div>
              </div>
            )}
            {!otpauthUri && (
              <p className="font-mono text-sm bg-neutral-100 rounded-lg p-3 break-all select-all">
                {setupSecret}
              </p>
            )}
            <form onSubmit={confirmSetup} className="space-y-3">
              <label htmlFor="mfa-confirm-code" className="text-xs font-medium text-neutral-700">
                Enter the 6-digit code from your app to confirm
              </label>
              <Input
                id="mfa-confirm-code"
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                disabled={busy}
              />
              <Button type="submit" disabled={busy || confirmCode.length !== 6}>
                {busy ? 'Confirming…' : 'Confirm and generate backup codes'}
              </Button>
            </form>
          </div>
        )}

        {backupCodes && backupCodes.length > 0 && (
          <div className="space-y-3 border-t border-neutral-100 pt-4">
            <Alert variant="warning" className="text-sm">
              Save these backup codes now. Each code works once. They will not be shown again.
            </Alert>
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-neutral-50 rounded-xl p-4 border border-neutral-200">
              {backupCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
