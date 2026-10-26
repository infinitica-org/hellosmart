import React, { forwardRef, HTMLAttributes } from 'react';
import { StatusIndicator, StatusType } from '../../components/badge';

export type WorkspaceConnectionState =
  | 'provisioning'
  | 'not_connected'
  | 'connected'
  | 'disconnected'
  | 'fullscreen_exit'
  | 'ended';

export interface WorkspaceConnectionStatusProps extends HTMLAttributes<HTMLDivElement> {
  state: WorkspaceConnectionState;
  onReconnect?: (() => void) | undefined;
}

const statusMap: Record<WorkspaceConnectionState, { label: string; type: StatusType }> = {
  provisioning: { label: 'Provisioning Slot...', type: 'busy' },
  not_connected: { label: 'Ready to Connect', type: 'idle' },
  connected: { label: 'Connected & Recording', type: 'online' },
  disconnected: { label: 'Disconnected (Timer Running)', type: 'offline' },
  fullscreen_exit: { label: 'Paused: Full Screen Exited', type: 'error' },
  ended: { label: 'Session Ended', type: 'offline' },
};

export const WorkspaceConnectionStatus = forwardRef<HTMLDivElement, WorkspaceConnectionStatusProps>(
  ({ state, onReconnect, className = '', ...props }, ref) => {
    const cfg = statusMap[state] || statusMap.not_connected;

    return (
      <div
        ref={ref}
        className={`inline-flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white border border-neutral-200 text-xs shadow-xs text-neutral-900 ${className}`}
        {...props}
      >
        <StatusIndicator status={cfg.type} label={cfg.label} />

        {(state === 'disconnected' || state === 'fullscreen_exit') && onReconnect && (
          <button
            type="button"
            onClick={onReconnect}
            className="text-[11px] font-semibold text-primary hover:text-primary-hover underline underline-offset-2 ml-1"
          >
            Resume Session
          </button>
        )}
      </div>
    );
  }
);
WorkspaceConnectionStatus.displayName = 'WorkspaceConnectionStatus';

