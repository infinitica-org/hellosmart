import React, { forwardRef, HTMLAttributes } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  Hash,
  Info,
  HelpCircle,
} from 'lucide-react';

export type HashChainStatus = 'idle' | 'verifying' | 'valid' | 'tampered' | 'empty' | 'inconclusive';

export interface HashChainStatusBannerProps extends HTMLAttributes<HTMLDivElement> {
  status: HashChainStatus;
  recordsChecked?: number | undefined;
  recordsVerifiedBeforeIssue?: number | undefined;
  verifiedAt?: string | null | undefined;
  chainStart?: string | null | undefined;
  chainEnd?: string | null | undefined;
  failureReason?: string | null | undefined;
  inconclusiveReason?: string | null | undefined;
  firstInvalidEventId?: string | null | undefined;
  firstInconclusiveEventId?: string | null | undefined;
  expectedHash?: string | null | undefined;
  storedHash?: string | null | undefined;
  expectedPreviousHash?: string | null | undefined;
  storedPreviousHash?: string | null | undefined;
  onVerify?: (() => void) | undefined;
  isLoading?: boolean | undefined;
}

export const HashChainStatusBanner = forwardRef<HTMLDivElement, HashChainStatusBannerProps>(
  (
    {
      status,
      recordsChecked = 0,
      recordsVerifiedBeforeIssue,
      verifiedAt,
      chainStart,
      chainEnd,
      failureReason,
      inconclusiveReason,
      firstInvalidEventId,
      firstInconclusiveEventId,
      expectedHash,
      storedHash,
      expectedPreviousHash,
      storedPreviousHash,
      onVerify,
      isLoading = false,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isVerifying = status === 'verifying' || isLoading;

    if (isVerifying) {
      return (
        <div
          ref={ref}
          className={`rounded-xl border border-sky-300 bg-sky-50/90 p-4 sm:p-5 text-sky-900 shadow-xs transition-all ${className}`}
          data-testid="hash-chain-verifying-banner"
          {...props}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-200/80 p-2 text-sky-700 shrink-0">
              <RefreshCw className="h-5 w-5 animate-spin" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-sky-950">
                  Verifying SHA-256 Hash Chain...
                </h4>
                <span className="rounded bg-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-800 uppercase tracking-wider">
                  Verifying
                </span>
              </div>
              <p className="text-xs text-sky-800">
                Traversing every historical event block and validating cryptographic SHA-256 hash chaining (BR-31).
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (status === 'tampered') {
      return (
        <div
          ref={ref}
          className={`rounded-xl border border-rose-300 bg-rose-50/90 p-4 sm:p-5 text-rose-900 shadow-xs transition-all ${className}`}
          role="alert"
          aria-live="assertive"
          data-testid="hash-chain-tampered-banner"
          {...props}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-200/80 p-2 text-rose-700 shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-rose-950">
                    Integrity Violation Detected (BR-31)
                  </h4>
                  <span className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Tampered
                  </span>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed">
                  Cryptographic ledger verification failed at block{' '}
                  <span className="font-mono font-bold text-rose-950">#{firstInvalidEventId || 'unknown'}</span>.{' '}
                  {failureReason || 'Row payload, hash pointer, or ledger sequence was altered.'}
                </p>

                {(expectedHash || storedHash || expectedPreviousHash || storedPreviousHash) && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-white/80 p-3 font-mono text-[11px] text-neutral-800 space-y-1.5 shadow-2xs">
                    {expectedHash && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="text-neutral-500 font-sans text-xs min-w-32">Expected Hash:</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded break-all">
                          {expectedHash}
                        </span>
                      </div>
                    )}
                    {storedHash && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="text-neutral-500 font-sans text-xs min-w-32">Stored Hash:</span>
                        <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded break-all">
                          {storedHash}
                        </span>
                      </div>
                    )}
                    {expectedPreviousHash && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="text-neutral-500 font-sans text-xs min-w-32">Expected Prev Hash:</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded break-all">
                          {expectedPreviousHash}
                        </span>
                      </div>
                    )}
                    {storedPreviousHash && (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <span className="text-neutral-500 font-sans text-xs min-w-32">Stored Prev Hash:</span>
                        <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded break-all">
                          {storedPreviousHash}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {onVerify && (
              <button
                type="button"
                onClick={onVerify}
                disabled={isVerifying}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Re-verify Ledger</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (status === 'inconclusive') {
      const verifiedCount = recordsVerifiedBeforeIssue ?? recordsChecked ?? 0;
      return (
        <div
          ref={ref}
          className={`rounded-xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 text-amber-950 shadow-xs transition-all ${className}`}
          role="status"
          aria-live="polite"
          data-testid="hash-chain-inconclusive-banner"
          {...props}
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-200/80 p-2 text-amber-800 shrink-0 mt-0.5">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-amber-950">
                    Hash Chain Verification Inconclusive
                  </h4>
                  <span className="rounded bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Inconclusive
                  </span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Cryptographic verification halted at block{' '}
                  <span className="font-mono font-bold text-amber-950">
                    #{firstInconclusiveEventId || 'unknown'}
                  </span>
                  . {inconclusiveReason || failureReason || 'Record state ordering cannot be reconstructed with certainty.'}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-amber-800 font-medium pt-1">
                  <span className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-amber-600" />
                    <span>{verifiedCount.toLocaleString()} blocks verified before halting</span>
                  </span>
                  {chainStart && (
                    <span className="text-amber-800 font-mono text-[11px]">
                      (Chain start: #{chainStart})
                    </span>
                  )}
                  {verifiedAt && (
                    <span className="flex items-center gap-1.5 text-amber-700 text-[11px]">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(verifiedAt).toLocaleTimeString()}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {onVerify && (
              <button
                type="button"
                onClick={onVerify}
                disabled={isVerifying}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Re-verify Ledger</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (status === 'valid') {
      return (
        <div
          ref={ref}
          className={`rounded-xl border border-emerald-300 bg-emerald-50/90 p-4 sm:p-5 text-emerald-900 shadow-xs transition-all ${className}`}
          data-testid="hash-chain-valid-banner"
          {...props}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-200/80 p-2 text-emerald-700 shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-emerald-950">
                    Internal Hash-Chain Continuity Verified
                  </h4>
                  <span className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Continuity Verified (BR-31)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-800 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{recordsChecked.toLocaleString()} blocks verified sequentially</span>
                  </span>
                  {chainStart && chainEnd && (
                    <span className="text-emerald-700 font-mono text-[11px]">
                      (Blocks #{chainStart} to #{chainEnd})
                    </span>
                  )}
                  {verifiedAt && (
                    <span className="flex items-center gap-1.5 text-emerald-700 text-[11px]">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(verifiedAt).toLocaleTimeString()}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {onVerify && (
              <button
                type="button"
                onClick={onVerify}
                disabled={isVerifying}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-2xs hover:bg-emerald-100/60 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
                <span>Verify Again</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // Idle, verifying, or empty state
    return (
      <div
        ref={ref}
        className={`rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 sm:p-5 text-neutral-800 shadow-xs transition-all ${className}`}
        data-testid="hash-chain-idle-banner"
        {...props}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-neutral-200/80 p-2 text-neutral-600 shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-neutral-900">
                  Audit Ledger Hash-Chain Continuity Verification
                </h4>
                <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 uppercase tracking-wider">
                  Append-Only
                </span>
              </div>
              <p className="text-xs text-neutral-600">
                Traverse historical event blocks and verify internal SHA-256 sequential hash chaining relative to genesis (BR-31).
              </p>
            </div>
          </div>

          {onVerify && (
            <button
              type="button"
              onClick={onVerify}
              disabled={isVerifying}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 shrink-0 cursor-pointer disabled:opacity-50"
              data-testid="verify-chain-button"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isVerifying ? 'animate-spin' : ''}`} />
              <span>{isVerifying ? 'Verifying Ledger...' : 'Verify Hash-Chain Continuity'}</span>
            </button>
          )}
        </div>
      </div>
    );
  },
);

HashChainStatusBanner.displayName = 'HashChainStatusBanner';
