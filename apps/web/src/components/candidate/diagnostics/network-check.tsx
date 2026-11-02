'use client';

import React from 'react';
import { Card, Badge, Button } from '@hs/ui';
import { Wifi, CheckCircle2, AlertTriangle, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import type { NetworkCheckResult } from '@/hooks/candidate/use-system-diagnostics';

export interface NetworkCheckProps {
  result: NetworkCheckResult;
  isRunning?: boolean;
  onRetry?: () => void;
}

export function NetworkCheck({ result, isRunning = false, onRetry }: NetworkCheckProps) {
  const isPass = result.status === 'pass';
  const isError = result.status === 'error';
  const isWarning = result.status === 'warning';

  return (
    <Card className="p-4 sm:p-5 border-neutral-200/80 bg-white shadow-2xs hover:border-neutral-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPass
                ? 'bg-emerald-50 text-emerald-600'
                : isWarning
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-red-50 text-red-600'
            }`}
          >
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">Network Diagnostics</h4>
            <p className="text-xs text-neutral-500 mt-0.5">
              Target endpoint: <span className="font-medium text-neutral-700">{result.endpoint}</span>
            </p>
          </div>
        </div>

        {isRunning ? (
          <Badge variant="default" dot className="shrink-0">
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
            Testing
          </Badge>
        ) : isPass ? (
          <Badge variant="success" dot className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Connected
          </Badge>
        ) : isWarning ? (
          <Badge variant="warning" dot className="shrink-0 bg-amber-50 text-amber-800 border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            High Latency
          </Badge>
        ) : (
          <Badge variant="danger" dot className="shrink-0 bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            Failed
          </Badge>
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/60">
          <span className="text-[11px] text-neutral-400 block font-light">Measured Latency</span>
          <span className="font-semibold text-neutral-800 text-sm">
            {result.latencyMs !== null ? `${result.latencyMs} ms` : 'Measuring...'}
          </span>
        </div>
        <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/60">
          <span className="text-[11px] text-neutral-400 block font-light">Connection Test</span>
          <span className="font-semibold text-neutral-800 text-sm">
            {isRunning ? 'In Progress' : isError ? 'Offline' : 'Connected'}
          </span>
        </div>
        <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/60">
          <span className="text-[11px] text-neutral-400 block font-light">Test Endpoint</span>
          <span className="font-semibold text-neutral-800 text-sm">Platform API</span>
        </div>
        <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/60">
          <span className="text-[11px] text-neutral-400 block font-light">Last Checked</span>
          <span className="font-semibold text-neutral-800 text-sm">
            {result.lastChecked || 'Just now'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
        {!isRunning && result.message && (
          <p
            className={`text-xs leading-relaxed flex-1 ${
              isPass ? 'text-neutral-500' : isWarning ? 'text-amber-700' : 'text-red-700 font-medium'
            }`}
          >
            {result.message}
          </p>
        )}

        {isError && onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRunning}
            className="text-xs border-red-300 text-red-700 hover:bg-red-50"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Retry Connection
          </Button>
        )}
      </div>
    </Card>
  );
}
