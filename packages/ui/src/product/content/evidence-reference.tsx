import React, { HTMLAttributes, forwardRef } from 'react';

export type EvidenceType = 'term' | 'diff' | 'ai' | 'file' | 'event' | 'test';

export interface EvidenceReferenceProps extends HTMLAttributes<HTMLSpanElement> {
  reference: string;
  onView?: ((ref: string) => void) | undefined;
}

const typeConfig: Record<EvidenceType, { label: string; bg: string; text: string; border: string }> = {
  term: { label: 'Terminal', bg: 'bg-emerald-950/60', text: 'text-emerald-300', border: 'border-emerald-800/60' },
  diff: { label: 'Git Diff', bg: 'bg-indigo-950/60', text: 'text-indigo-300', border: 'border-indigo-800/60' },
  ai: { label: 'AI Prompt', bg: 'bg-violet-950/60', text: 'text-violet-300', border: 'border-violet-800/60' },
  file: { label: 'File', bg: 'bg-amber-950/60', text: 'text-amber-300', border: 'border-amber-800/60' },
  event: { label: 'Activity', bg: 'bg-cyan-950/60', text: 'text-cyan-300', border: 'border-cyan-800/60' },
  test: { label: 'Test Result', bg: 'bg-rose-950/60', text: 'text-rose-300', border: 'border-rose-800/60' },
};

export const EvidenceReference = forwardRef<HTMLSpanElement, EvidenceReferenceProps>(
  ({ reference, onView, className = '', ...props }, ref) => {
    const colonIdx = reference.indexOf(':');
    const prefix = (colonIdx > 0 ? reference.substring(0, colonIdx) : 'file') as EvidenceType;
    const path = colonIdx > 0 ? reference.substring(colonIdx + 1) : reference;
    const cfg = typeConfig[prefix] || typeConfig.file;

    const isClickable = Boolean(onView);

    return (
      <span
        ref={ref}
        onClick={() => isClickable && onView?.(reference)}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-[11px] font-mono select-none transition-colors ${
          cfg.bg
        } ${cfg.text} ${cfg.border} ${
          isClickable ? 'cursor-pointer hover:brightness-125' : ''
        } ${className}`}
        {...props}
      >
        <span className="font-semibold uppercase tracking-wider text-[10px] opacity-80">
          [{cfg.label}]
        </span>
        <span className="truncate max-w-[200px]">{path}</span>
      </span>
    );
  }
);
EvidenceReference.displayName = 'EvidenceReference';

