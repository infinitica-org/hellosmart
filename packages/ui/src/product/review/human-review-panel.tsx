'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/card';
import { Button } from '../../components/button';
import { Switch } from '../../components/switch';
import { Textarea } from '../../components/textarea';

export interface HumanReviewPanelProps {
  currentScore: number;
  initialNotes?: string | undefined;
  isFinalized?: boolean | undefined;
  currentVersion?: number | undefined;
  releaseResults?: boolean | undefined;
  onFinalize: (data: { score: number; notes: string; release: boolean }) => void;
  isLoading?: boolean | undefined;
  className?: string | undefined;
}

export function HumanReviewPanel({
  currentScore,
  initialNotes = '',
  isFinalized = false,
  currentVersion = 1,
  releaseResults = false,
  onFinalize,
  isLoading = false,
  className = '',
}: HumanReviewPanelProps): React.JSX.Element {
  const [score, setScore] = useState(currentScore);
  const [notes, setNotes] = useState(initialNotes);
  const [release, setRelease] = useState(releaseResults);

  const handleSubmit = () => {
    onFinalize({ score, notes, release });
  };

  return (
    <Card variant="solid" className={`p-6 space-y-5 ${className}`}>
      <CardHeader className="p-0 border-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Human Review & Final Decision</CardTitle>
            <p className="text-xs text-neutral-500 mt-0.5">
              AI agent scores are advisory evidence. Human review overrides are version-tracked.
            </p>
          </div>
          {isFinalized && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-success-muted text-success-foreground border border-success-border">
              Finalized (v{currentVersion})
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
            Final Human Score (0 - 100)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="w-32 bg-white border border-neutral-300 text-neutral-900 font-mono text-base font-bold rounded-md px-3.5 py-2 focus:border-primary focus:ring-2 focus:ring-nav-accent/20 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-800 mb-1.5">
            Evaluator Notes & Qualitative Feedback
          </label>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add specific notes citing candidate decisions, code structure, or rubric overrides..."
          />
        </div>

        <div className="p-3.5 rounded-md bg-neutral-50 border border-neutral-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-neutral-900">
              Release Evaluation Report to Candidate
            </span>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Allow the candidate to view their rubric breakdown in the candidate portal.
            </p>
          </div>
          <Switch checked={release} onChange={setRelease} />
        </div>
      </CardContent>

      <CardFooter className="p-0 border-0 pt-2 flex items-center justify-between">
        <span className="text-[11px] text-neutral-500">
          {isFinalized ? `Editing creates review version ${currentVersion + 1}` : 'Initial finalization'}
        </span>
        <Button variant="primary" isLoading={isLoading} onClick={handleSubmit}>
          {isFinalized ? 'Save Versioned Override' : 'Finalize Decision'}
        </Button>
      </CardFooter>
    </Card>
  );
}

