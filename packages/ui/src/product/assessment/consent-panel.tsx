'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/card';
import { Checkbox } from '../../components/checkbox';
import { Button } from '../../components/button';
import { ShieldCheck } from 'lucide-react';

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
          <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
            <ShieldCheck className="w-5 h-5" />
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
        <div className="space-y-3 rounded-md bg-neutral-50 border border-neutral-200 p-4 text-xs text-neutral-700">
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
        <span className="text-[11px] text-[#5b6775] font-mono">Policy {textVersion}</span>
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

