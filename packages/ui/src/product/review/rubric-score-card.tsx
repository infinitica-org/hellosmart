import React, { forwardRef, HTMLAttributes } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/card';
import { EvidenceReference } from '../content/evidence-reference';

export interface RubricScoreCardProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  weight: number;
  score: number;
  maxScore?: number | undefined;
  rationale: string;
  evidence: string[];
  confidence?: number | undefined;
  flags?: string[] | undefined;
  onViewEvidence?: ((ref: string) => void) | undefined;
}

export const RubricScoreCard = forwardRef<HTMLDivElement, RubricScoreCardProps>(
  (
    {
      name,
      weight,
      score,
      maxScore = 100,
      rationale,
      evidence,
      confidence,
      flags,
      onViewEvidence,
      className = '',
      ...props
    },
    ref
  ) => {
    const scoreColor =
      score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';

    return (
      <Card ref={ref} variant="glass" className={`p-5 ${className}`} {...props}>
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-100">{name}</h4>
              <span className="text-[11px] font-mono text-slate-500">({weight}% weight)</span>
            </div>
            {confidence !== undefined && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Agent Confidence: <span className="font-mono text-slate-300">{confidence}%</span>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold font-mono ${scoreColor}`}>{score}</span>
            <span className="text-xs text-slate-500 font-mono">/{maxScore}</span>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">{rationale}</p>

          {flags && flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {flags.map((flag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-rose-300 text-[10px] font-medium"
                >
                  🚩 {flag}
                </span>
              ))}
            </div>
          )}

          {evidence.length > 0 && (
            <div className="pt-2 border-t border-slate-800/60">
              <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mb-2">
                Mandatory Cited Evidence (BR-18):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {evidence.map((refStr, idx) => (
                  <EvidenceReference
                    key={idx}
                    reference={refStr}
                    onView={onViewEvidence}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    );
  }
);
RubricScoreCard.displayName = 'RubricScoreCard';

