import React, { HTMLAttributes, forwardRef } from 'react';

export type EvidenceType = 'term' | 'diff' | 'ai' | 'file' | 'event' | 'test';

export interface EvidenceReferenceProps extends HTMLAttributes<HTMLSpanElement> {
  reference: string;
  onView?: ((ref: string) => void) | undefined;
}

const typeConfig: Record<EvidenceType, { label: string; bg: string; text: string; border: string }> = {
  term: { label: 'Terminal', bg: 'bg-success-muted', text: 'text-success-foreground', border: 'border-success-border' },
  diff: { label: 'Git Diff', bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' },
  ai: { label: 'AI Prompt', bg: 'bg-primary/10', text: 'text-primary-700', border: 'border-primary/30' },
  file: { label: 'File', bg: 'bg-neutral-100', text: 'text-neutral-800', border: 'border-neutral-200' },
  event: { label: 'Activity', bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-300' },
  test: { label: 'Test Result', bg: 'bg-danger-muted', text: 'text-danger-foreground', border: 'border-danger-border' },
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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[11px] font-mono select-none transition-colors ${
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

