import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TerminalToolbar } from '../components/workspace/terminal/terminal-toolbar';
import { XtermTerminal } from '../components/workspace/terminal/xterm-terminal';

describe('Candidate Workspace Interactive Terminal (S1B-T07-2 / Stream 7)', () => {
  describe('TerminalToolbar Component', () => {
    it('renders bash tab and connected status indicator in dark theme', () => {
      const html = renderToString(
        <TerminalToolbar
          status="connected"
          isSimulated={true}
          onClear={vi.fn()}
          onRestart={vi.fn()}
          theme="dark"
        />
      );

      expect(html).toContain('bash');
      expect(html).toContain('PTY Ready');
      expect(html).toContain('terminal-clear-btn');
      expect(html).toContain('terminal-restart-btn');
    });

    it('renders Cloud PTY label when connected to real backend socket', () => {
      const html = renderToString(
        <TerminalToolbar
          status="connected"
          isSimulated={false}
          onClear={vi.fn()}
          onRestart={vi.fn()}
          theme="dark"
        />
      );

      expect(html).toContain('Cloud PTY');
    });

    it('renders Connecting status when establishing WebSocket connection', () => {
      const html = renderToString(
        <TerminalToolbar
          status="connecting"
          onClear={vi.fn()}
          onRestart={vi.fn()}
        />
      );

      expect(html).toContain('Connecting...');
    });

    it('renders Offline status when disconnected or error occurs', () => {
      const html = renderToString(
        <TerminalToolbar
          status="disconnected"
          onClear={vi.fn()}
          onRestart={vi.fn()}
        />
      );

      expect(html).toContain('Offline');
    });

    it('renders maximize and close buttons when callbacks are provided', () => {
      const html = renderToString(
        <TerminalToolbar
          status="connected"
          onClear={vi.fn()}
          onRestart={vi.fn()}
          onClose={vi.fn()}
          onToggleMaximize={vi.fn()}
          isMaximized={false}
        />
      );

      expect(html).toContain('terminal-maximize-btn');
      expect(html).toContain('terminal-close-btn');
      expect(html).toContain('Clear Terminal (Ctrl+L)');
      expect(html).toContain('Restart Shell');
    });

    it('renders restore button title when isMaximized is true', () => {
      const html = renderToString(
        <TerminalToolbar
          status="connected"
          onClear={vi.fn()}
          onRestart={vi.fn()}
          onToggleMaximize={vi.fn()}
          isMaximized={true}
        />
      );

      expect(html).toContain('Restore Terminal');
    });
  });

  describe('XtermTerminal Component', () => {
    it('renders terminal container structure and toolbar', () => {
      const html = renderToString(
        <XtermTerminal
          workspaceId="ws-test-123"
          sessionToken="session-token-abc"
          theme="dark"
          files={[
            { id: '1', name: 'README.md', path: 'README.md', content: '# Solution', language: 'markdown' },
            { id: '2', name: 'solution.ts', path: 'src/solution.ts', content: 'export const x = 1;', language: 'typescript' },
          ]}
        />
      );

      expect(html).toContain('data-testid="xterm-terminal-container"');
      expect(html).toContain('bash');
    });

    it('renders properly in light theme mode', () => {
      const html = renderToString(
        <XtermTerminal
          workspaceId="ws-test-123"
          theme="light"
        />
      );

      expect(html).toContain('data-testid="xterm-terminal-container"');
      expect(html).toContain('bg-white');
    });

    it('handles custom className and default file list without throwing', () => {
      const html = renderToString(
        <XtermTerminal
          workspaceId="ws-test-456"
          className="custom-terminal-panel"
        />
      );

      expect(html).toContain('custom-terminal-panel');
      expect(html).toContain('data-testid="xterm-terminal-container"');
    });
  });
});
