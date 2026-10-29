import React, { forwardRef, HTMLAttributes } from 'react';
import { Button } from '../../components/button';

export interface WorkspaceRecoveryPanelProps extends HTMLAttributes<HTMLDivElement> {
  lastSavedAt?: string | Date | undefined;
  snapshotRef?: string | undefined;
  onRestore?: (() => void) | undefined;
  isRestoring?: boolean | undefined;
}

export const WorkspaceRecoveryPanel = forwardRef<HTMLDivElement, WorkspaceRecoveryPanelProps>(
  ({ lastSavedAt, snapshotRef, onRestore, isRestoring = false, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-md bg-white border border-neutral-200 text-xs text-neutral-700 shadow-xs ${className}`}
        {...props}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm bg-success-muted border border-success-border flex items-center justify-center text-success shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-neutral-900 flex items-center gap-2">
              Continuous Autosave Active (BR-11)
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                RPO &le; 30s
              </span>
            </div>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              {lastSavedAt
                ? `Last snapshot saved at ${new Date(lastSavedAt).toLocaleTimeString()}`
                : 'All files, terminal buffers, and git diffs are continuously persisted.'}
              {snapshotRef && ` • Ref: ${snapshotRef.slice(0, 8)}`}
            </div>
          </div>
        </div>

        {onRestore && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRestore}
            isLoading={isRestoring}
            className="shrink-0"
          >
            Verify State
          </Button>
        )}
      </div>
    );
  }
);
WorkspaceRecoveryPanel.displayName = 'WorkspaceRecoveryPanel';

