'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/card';
import { Checkbox } from '../../components/checkbox';
import { Button } from '../../components/button';

export interface ConsentPanelProps {
  workspaceMode: 'cloud' | 'chat';
  aiEnabled: boolean;
  pauseTimerOnDisconnect?: boolean | undefined;
  onAccept: (consentData: { textVersion: string; acceptedAt: string }) => void;
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

export function ConsentPanel({
  workspaceMode,
  aiEnabled,
  pauseTimerOnDisconnect = false,
  onAccept,
  isLoading = false,
  className = '',
}: ConsentPanelProps): React.JSX.Element {
  const [hasAgreed, setHasAgreed] = useState(false);
  const textVersion = 'v1.0';

  const handleSubmit = () => {
    if (!hasAgreed) return;
    onAccept({
      textVersion,
      acceptedAt: new Date().toISOString(),
    });
  };

  return (
    <Card variant="solid" className={`max-w-2xl mx-auto ${className}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <CardTitle>Assessment Environment Agreement</CardTitle>
            <p className="text-xs text-neutral-500 mt-0.5">
              Review environment recording and integrity policies before connecting.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-xs text-neutral-700">
          <div className="flex items-start gap-2.5">
            <span className="text-primary font-bold">•</span>
            <div>
              <span className="font-semibold text-neutral-900">Session Recording (BR-12):</span>{' '}
              All actions inside this workspace, including terminal commands, git snapshots, editor changes, and chat interactions, are captured as evaluation evidence.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-primary font-bold">•</span>
            <div>
              <span className="font-semibold text-neutral-900">AI Assistant Policy (BR-14):</span>{' '}
              {aiEnabled
                ? 'Governed AI coding assistance is enabled for this assessment via the secure HelloSmart AI proxy.'
                : 'AI coding assistance is disabled for this assessment. Network egress to external AI services is blocked.'}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <span className="text-primary font-bold">•</span>
            <div>
              <span className="font-semibold text-neutral-900">Timer & Disconnection (BR-09):</span>{' '}
              {pauseTimerOnDisconnect
                ? 'The timer will automatically pause if your connection is lost.'
                : 'The countdown timer keeps running if you disconnect or close your browser. Autosave ensures no work is lost upon resuming (BR-11).'}
            </div>
          </div>

          {workspaceMode === 'cloud' && (
            <div className="flex items-start gap-2.5">
              <span className="text-primary font-bold">•</span>
              <div>
                <span className="font-semibold text-neutral-900">Full Screen Requirement (BR-10):</span>{' '}
                Connecting will request full-screen mode. Exiting full screen disconnects the session until resumed.
              </div>
            </div>
          )}
        </div>

        <Checkbox
          id="agree-consent"
          checked={hasAgreed}
          onChange={(e) => setHasAgreed(e.target.checked)}
          label="I understand and accept the session recording, timing, and workspace integrity policies."
        />
      </CardContent>

      <CardFooter>
        <span className="text-[11px] text-slate-500 font-mono">Policy {textVersion}</span>
        <Button
          variant="primary"
          disabled={!hasAgreed || isLoading}
          isLoading={isLoading}
          onClick={handleSubmit}
        >
          Connect to Workspace →
        </Button>
      </CardFooter>
    </Card>
  );
}

