import React from 'react';
import { Terminal, Trash2, RotateCcw, Maximize2, Minimize2, X } from 'lucide-react';
import type { TerminalConnectionStatus } from '../../../hooks/workspace/use-terminal-socket';

export interface TerminalToolbarProps {
  status: TerminalConnectionStatus;
  isSimulated?: boolean | undefined;
  onClear: () => void;
  onRestart: () => void;
  onClose?: (() => void) | undefined;
  isMaximized?: boolean | undefined;
  onToggleMaximize?: (() => void) | undefined;
  theme?: 'dark' | 'light' | undefined;
}

export function TerminalToolbar({
  status,
  isSimulated = false,
  onClear,
  onRestart,
  onClose,
  isMaximized = false,
  onToggleMaximize,
  theme = 'dark',
}: TerminalToolbarProps) {
  const isLight = theme === 'light';

  return (
    <div
      className={`h-9 shrink-0 flex items-center justify-between px-3 text-xs select-none border-b transition-colors ${
        isLight
          ? 'bg-neutral-50/90 border-neutral-200 text-neutral-700'
          : 'bg-neutral-900 border-neutral-800 text-neutral-300'
      }`}
    >
      {/* Left: Terminal Tab & Connection Status */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium text-xs border ${
            isLight
              ? 'bg-white border-neutral-200/90 text-neutral-800 shadow-2xs'
              : 'bg-neutral-800 border-neutral-700/80 text-neutral-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span>bash</span>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          {status === 'connected' && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {isSimulated ? 'PTY Ready' : 'Cloud PTY'}
              </span>
            </>
          )}

          {status === 'connecting' && (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span className="text-amber-600 dark:text-amber-400">Connecting...</span>
            </>
          )}

          {(status === 'disconnected' || status === 'error') && (
            <>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-rose-500">Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onClear}
          title="Clear Terminal (Ctrl+L)"
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isLight
              ? 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
              : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
          data-testid="terminal-clear-btn"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onRestart}
          title="Restart Shell"
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isLight
              ? 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
              : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'
          }`}
          data-testid="terminal-restart-btn"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {onToggleMaximize && (
          <button
            type="button"
            onClick={onToggleMaximize}
            title={isMaximized ? 'Restore Terminal' : 'Maximize Terminal'}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isLight
                ? 'hover:bg-neutral-200/70 text-neutral-600 hover:text-neutral-900'
                : 'hover:bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
            data-testid="terminal-maximize-btn"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close Terminal"
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isLight
                ? 'hover:bg-rose-100/70 text-neutral-500 hover:text-rose-600'
                : 'hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400'
            }`}
            data-testid="terminal-close-btn"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
