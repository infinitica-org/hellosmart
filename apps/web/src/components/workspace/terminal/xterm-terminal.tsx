'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useTerminalSocket } from '../../../hooks/workspace/use-terminal-socket';
import { TerminalToolbar } from './terminal-toolbar';
import type { WorkspaceFile } from '../../../hooks/workspace/use-workspace-files';

export interface XtermTerminalProps {
  workspaceId: string;
  sessionToken?: string | undefined;
  theme?: 'dark' | 'light' | undefined;
  files?: WorkspaceFile[] | undefined;
  onClose?: (() => void) | undefined;
  isMaximized?: boolean | undefined;
  onToggleMaximize?: (() => void) | undefined;
  className?: string | undefined;
}

const DARK_THEME = {
  background: '#121212',
  foreground: '#e5e5e5',
  cursor: '#f97316',
  cursorAccent: '#121212',
  selectionBackground: '#f9731640',
  black: '#1e1e1e',
  red: '#ef4444',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#f3f4f6',
  brightBlack: '#6b7280',
  brightRed: '#f87171',
  brightGreen: '#34d399',
  brightYellow: '#fbbf24',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#ffffff',
};

const LIGHT_THEME = {
  background: '#ffffff',
  foreground: '#1e293b',
  cursor: '#f97316',
  cursorAccent: '#ffffff',
  selectionBackground: '#f9731630',
  black: '#0f172a',
  red: '#dc2626',
  green: '#059669',
  yellow: '#d97706',
  blue: '#2563eb',
  magenta: '#9333ea',
  cyan: '#0891b2',
  white: '#f8fafc',
  brightBlack: '#64748b',
  brightRed: '#ef4444',
  brightGreen: '#10b981',
  brightYellow: '#f59e0b',
  brightBlue: '#3b82f6',
  brightMagenta: '#a855f7',
  brightCyan: '#06b6d4',
  brightWhite: '#0f172a',
};

export function XtermTerminal({
  workspaceId,
  sessionToken,
  theme = 'dark',
  files = [],
  onClose,
  isMaximized = false,
  onToggleMaximize,
  className = '',
}: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);

  // Pipe output into xterm display buffer
  const handleDataFromPty = useCallback((data: string) => {
    if (xtermRef.current) {
      xtermRef.current.write(data);
    }
  }, []);

  const {
    status,
    isSimulated,
    sendInput,
    sendResize,
    restartShell,
  } = useTerminalSocket({
    workspaceId,
    token: sessionToken,
    files,
    onData: handleDataFromPty,
  });

  // Handle Clear button
  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      sendInput('\x0c'); // Trigger clear in shell as well
    }
  }, [sendInput]);

  // Handle Restart button
  const handleRestart = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
    restartShell();
  }, [restartShell]);

  // Initialize xterm.js instance
  useEffect(() => {
    let disposed = false;

    async function initTerminal() {
      if (!containerRef.current || typeof window === 'undefined') return;

      const { Terminal } = await import('@xterm/xterm');
      const { FitAddon } = await import('@xterm/addon-fit');
      const { WebLinksAddon } = await import('@xterm/addon-web-links');

      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontFamily: 'Menlo, Monaco, "Courier New", monospace, "Fira Code"',
        fontSize: 12.5,
        lineHeight: 1.25,
        theme: theme === 'light' ? LIGHT_THEME : DARK_THEME,
        convertEol: true,
        allowTransparency: true,
        scrollback: 1000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      term.open(containerRef.current);
      fitAddon.fit();

      // Listen for user keystrokes
      term.onData((data: string) => {
        sendInput(data);
      });

      // Listen for terminal resize events and transmit cols & rows
      term.onResize((event: { cols: number; rows: number }) => {
        sendResize(event.cols, event.rows);
      });

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;
      setIsReady(true);

      // Perform initial resize
      sendResize(term.cols, term.rows);
    }

    initTerminal();

    return () => {
      disposed = true;
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      fitAddonRef.current = null;
    };
  }, []); // Run once on mount

  // Update theme dynamically when theme prop toggles
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
    }
  }, [theme]);

  // Auto-resize terminal when container size or window changes
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (fitAddonRef.current && xtermRef.current) {
          try {
            fitAddonRef.current.fit();
            sendResize(xtermRef.current.cols, xtermRef.current.rows);
          } catch {}
        }
      });
    });

    resizeObserver.observe(containerRef.current);

    const handleWindowResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          sendResize(xtermRef.current.cols, xtermRef.current.rows);
        } catch {}
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [isReady, sendResize]);

  return (
    <div
      className={`flex flex-col h-full w-full overflow-hidden border-t transition-colors ${
        theme === 'light'
          ? 'bg-white border-neutral-200'
          : 'bg-neutral-950 border-neutral-800'
      } ${className}`}
      data-testid="xterm-terminal-container"
    >
      <TerminalToolbar
        status={status}
        isSimulated={isSimulated}
        onClear={handleClear}
        onRestart={handleRestart}
        onClose={onClose}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        theme={theme}
      />

      <div
        ref={containerRef}
        className="flex-1 w-full h-full p-2.5 overflow-hidden"
        style={{ minHeight: '120px' }}
      />
    </div>
  );
}
