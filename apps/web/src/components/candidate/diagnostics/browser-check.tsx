'use client';

import React from 'react';
import { Card, Badge } from '@hs/ui';
import { Globe, CheckCircle2, AlertTriangle, Loader2, Check } from 'lucide-react';
import type { BrowserCheckResult } from '@/hooks/candidate/use-system-diagnostics';

export interface BrowserCheckProps {
  result: BrowserCheckResult;
  isRunning?: boolean;
}

export function BrowserCheck({ result, isRunning = false }: BrowserCheckProps) {
  const isPass = result.status === 'pass';

  return (
    <Card className="p-4 sm:p-5 border-neutral-200/80 bg-white shadow-2xs hover:border-neutral-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isPass ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-neutral-900">Browser Compatibility</h4>
            <p className="text-xs text-neutral-500 mt-0.5">
              Supported: Chrome, Firefox, Safari, Edge
            </p>
          </div>
        </div>

        {isRunning ? (
          <Badge variant="default" dot className="shrink-0">
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
            Detecting
          </Badge>
        ) : isPass ? (
          <Badge variant="success" dot className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Supported
          </Badge>
        ) : (
          <Badge variant="warning" dot className="shrink-0 bg-amber-50 text-amber-800 border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Warning
          </Badge>
        )}
      </div>

      <div className="mt-4 pt-3.5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="bg-neutral-50 rounded-lg p-2.5 border border-neutral-200/60 flex-1">
          <span className="text-[11px] text-neutral-400 block font-light">Detected Browser</span>
          <span className="font-semibold text-neutral-800 text-sm">
            {result.browserName} {result.browserVersion ? `(${result.browserVersion.split('.')[0]})` : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px] text-neutral-500">
          <span className="inline-flex items-center gap-1 bg-neutral-100/80 px-2 py-1 rounded-md text-neutral-700 font-medium">
            <Check className="w-3 h-3 text-emerald-600" /> Fullscreen API
          </span>
          <span className="inline-flex items-center gap-1 bg-neutral-100/80 px-2 py-1 rounded-md text-neutral-700 font-medium">
            <Check className="w-3 h-3 text-emerald-600" /> WebSockets
          </span>
          <span className="inline-flex items-center gap-1 bg-neutral-100/80 px-2 py-1 rounded-md text-neutral-700 font-medium">
            <Check className="w-3 h-3 text-emerald-600" /> Storage
          </span>
        </div>
      </div>

      {!isRunning && result.message && (
        <p className={`mt-3 text-xs leading-relaxed ${isPass ? 'text-neutral-500' : 'text-amber-700 font-normal'}`}>
          {result.message}
        </p>
      )}
    </Card>
  );
}
