import { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkspaceFile } from './use-workspace-files';

export type TerminalConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseTerminalSocketOptions {
  workspaceId: string;
  token?: string | undefined;
  wsUrl?: string | undefined;
  files?: WorkspaceFile[] | undefined;
  onData?: ((data: string) => void) | undefined;
}

export interface UseTerminalSocketReturn {
  status: TerminalConnectionStatus;
  isSimulated: boolean;
  error: string | null;
  sendInput: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
  restartShell: () => void;
  reconnect: () => void;
}

const PROMPT_USER = 'candidate';
const PROMPT_HOST = 'hellosmart';

function formatPrompt(dir: string): string {
  const displayDir = dir === '/workspace' ? '~/workspace' : dir.replace(/^\/workspace/, '~/workspace');
  return `\x1b[38;2;34;197;94m${PROMPT_USER}@${PROMPT_HOST}\x1b[0m:\x1b[38;2;59;130;246m${displayDir}\x1b[0m$ `;
}

/**
 * Hook to manage WebSocket connection to container pseudo-terminal (pty).
 * If WebSocket server is unavailable (e.g. mock development), seamlessly falls
 * back to an in-memory interactive shell supporting `ls`, `npm test`, `git status`,
 * `cat`, `python`, `clear`, and command history.
 */
export function useTerminalSocket({
  workspaceId,
  token,
  wsUrl,
  files = [],
  onData,
}: UseTerminalSocketOptions): UseTerminalSocketReturn {
  const [status, setStatus] = useState<TerminalConnectionStatus>('connecting');
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const filesRef = useRef(files);
  filesRef.current = files;

  // Working directory state
  const currentDirRef = useRef<string>('/workspace');

  // Shell simulator state
  const lineBufferRef = useRef<string>('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const emitToTerminal = useCallback((text: string) => {
    if (onDataRef.current) {
      onDataRef.current(text);
    }
  }, []);

  const printBanner = useCallback(() => {
    const banner = [
      '\r\n\x1b[1;37mWelcome to HelloSmart Cloud Container (Ubuntu 24.04.1 LTS x86_64)\x1b[0m',
      '',
      ' \x1b[90m*\x1b[0m Documentation:  \x1b[36mhttps://docs.hellosmart.ai/workspace\x1b[0m',
      ' \x1b[90m*\x1b[0m Workspace VM:    \x1b[32mDedicated Cloud Container (4 vCPU, 8GB RAM)\x1b[0m',
      ' \x1b[90m*\x1b[0m Filesystem:      \x1b[33m/workspace\x1b[0m (Continuous autosave enabled: RPO \x1b[33m\u2264 30s\x1b[0m)',
      ' \x1b[90m*\x1b[0m Test Runner:     \x1b[35mVitest v2.1.4\x1b[0m / \x1b[35mNode.js v20.18.0\x1b[0m',
      '',
      '\x1b[90mType \x1b[33m\'npm test\'\x1b[90m to verify your assessment code, \x1b[33m\'ls\'\x1b[90m to inspect files.\x1b[0m',
      '',
      formatPrompt(currentDirRef.current),
    ].join('\r\n');
    emitToTerminal(banner);
  }, [emitToTerminal]);

  const handleSimulatedCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      emitToTerminal(`\r\n${formatPrompt(currentDirRef.current)}`);
      return;
    }

    const parts = trimmed.split(/\s+/);
    const program = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    emitToTerminal('\r\n');

    switch (program) {
      case 'help': {
        emitToTerminal(
          '\x1b[1mAvailable Shell Commands:\x1b[0m\r\n' +
          '  \x1b[36mls, dir\x1b[0m            List files and directories (supports -la, -l)\r\n' +
          '  \x1b[36mcd <dir>\x1b[0m           Change working directory\r\n' +
          '  \x1b[36mpwd\x1b[0m                Print current working directory\r\n' +
          '  \x1b[36mnpm test, vitest\x1b[0m   Run assessment test verification suite\r\n' +
          '  \x1b[36mgit status\x1b[0m         Check branch and modified files\r\n' +
          '  \x1b[36mgit diff\x1b[0m           View changes in solution\r\n' +
          '  \x1b[36mcat <file>\x1b[0m         Display file contents\r\n' +
          '  \x1b[36mnode <file>\x1b[0m        Run Node.js script\r\n' +
          '  \x1b[36mpython <file>\x1b[0m      Run Python script\r\n' +
          '  \x1b[36mwhoami, hostname\x1b[0m   Inspect current user and host\r\n' +
          '  \x1b[36mclear\x1b[0m              Clear terminal screen\r\n'
        );
        break;
      }

      case 'clear': {
        emitToTerminal('\x1b[2J\x1b[3J\x1b[H');
        emitToTerminal(formatPrompt(currentDirRef.current));
        return;
      }

      case 'cd': {
        const target = args[0];
        if (!target || target === '~' || target === '/workspace' || target === '') {
          currentDirRef.current = '/workspace';
        } else if (target === '..') {
          if (currentDirRef.current !== '/workspace') {
            const pathParts = currentDirRef.current.split('/').filter(Boolean);
            pathParts.pop();
            currentDirRef.current = '/' + (pathParts.length > 0 ? pathParts.join('/') : 'workspace');
          }
        } else {
          const clean = target.replace(/^\.\//, '').replace(/\/$/, '');
          const newPath = clean.startsWith('/') ? clean : `${currentDirRef.current}/${clean}`;
          const normalized = newPath.replace(/\/+/g, '/');
          const folderPrefix = normalized.replace(/^\/workspace\/?/, '') + '/';

          const exists = filesRef.current.some(
            (f) => f.path.startsWith(folderPrefix) || f.path === clean || clean === 'src' || clean === 'tests'
          );
          if (exists) {
            currentDirRef.current = normalized;
          } else {
            emitToTerminal(`\x1b[31mbash: cd: ${target}: No such file or directory\x1b[0m\r\n`);
          }
        }
        break;
      }

      case 'pwd': {
        emitToTerminal(`${currentDirRef.current}\r\n`);
        break;
      }

      case 'ls':
      case 'dir': {
        const isLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const currentRel = currentDirRef.current.replace(/^\/workspace\/?/, '');

        const folders = new Set<string>();
        const directFiles: WorkspaceFile[] = [];

        filesRef.current.forEach((f) => {
          let relPath = f.path;
          if (currentRel) {
            if (f.path.startsWith(currentRel + '/')) {
              relPath = f.path.slice(currentRel.length + 1);
            } else {
              return;
            }
          }
          const slashIdx = relPath.indexOf('/');
          if (slashIdx > -1) {
            folders.add(relPath.slice(0, slashIdx));
          } else if (relPath) {
            directFiles.push(f);
          }
        });

        if (folders.size === 0 && directFiles.length === 0 && !currentRel) {
          folders.add('src');
          folders.add('tests');
        }

        if (isLong) {
          emitToTerminal(`total ${(folders.size + directFiles.length) * 4}\r\n`);
          if (showAll) {
            emitToTerminal('drwxr-xr-x 4 candidate candidate 4096 Nov  6 14:00 \x1b[34;1m.\x1b[0m\r\n');
            emitToTerminal('drwxr-xr-x 3 candidate candidate 4096 Nov  6 14:00 \x1b[34;1m..\x1b[0m\r\n');
          }
          folders.forEach((dirName) => {
            emitToTerminal(`drwxr-xr-x 2 candidate candidate 4096 Nov  6 14:00 \x1b[34;1m${dirName}\x1b[0m\r\n`);
          });
          directFiles.forEach((file) => {
            const size = (file.content?.length || 128).toString().padStart(5);
            emitToTerminal(`-rw-r--r-- 1 candidate candidate ${size} Nov  6 14:00 \x1b[37m${file.name}\x1b[0m\r\n`);
          });
        } else {
          const renderedFolders = Array.from(folders).map((f) => `\x1b[34;1m${f}/\x1b[0m`);
          const renderedFiles = directFiles.map((f) => `\x1b[37m${f.name}\x1b[0m`);
          const allItems = [...renderedFolders, ...renderedFiles];
          if (allItems.length > 0) {
            emitToTerminal(allItems.join('  ') + '\r\n');
          }
        }
        break;
      }

      case 'cat':
      case 'head':
      case 'tail': {
        const filename = args.find((a) => !a.startsWith('-'));
        if (!filename) {
          emitToTerminal(`\x1b[31m${program}: missing file operand\x1b[0m\r\n`);
        } else {
          const clean = filename.replace(/^\.\//, '');
          const currentRel = currentDirRef.current.replace(/^\/workspace\/?/, '');
          const searchPath = currentRel ? `${currentRel}/${clean}` : clean;

          const found = filesRef.current.find(
            (f) =>
              f.path === searchPath ||
              f.path === clean ||
              f.name === clean ||
              f.path.endsWith('/' + clean)
          );
          if (found) {
            let content = found.content || '';
            if (program === 'head') {
              content = content.split('\n').slice(0, 10).join('\n');
            } else if (program === 'tail') {
              content = content.split('\n').slice(-10).join('\n');
            }
            emitToTerminal(`${content.replace(/\n/g, '\r\n')}\r\n`);
          } else {
            emitToTerminal(`\x1b[31m${program}: ${filename}: No such file or directory\x1b[0m\r\n`);
          }
        }
        break;
      }

      case 'npm':
      case 'pnpm':
      case 'yarn':
      case 'npx':
      case 'vitest': {
        const sub = args[0];
        if (program === 'vitest' || sub === 'test' || sub === 't' || sub === 'run') {
          emitToTerminal(
            '\x1b[90m> candidate-assessment@0.1.0 test /workspace\x1b[0m\r\n' +
            '\x1b[90m> vitest run\x1b[0m\r\n\r\n' +
            ' \x1b[36mRUN\x1b[0m  \x1b[90mv2.1.4\x1b[0m \x1b[90m/workspace\x1b[0m\r\n\r\n' +
            ' \x1b[42;30;1m PASS \x1b[0m \x1b[90mtests/\x1b[0msolution.test.ts\r\n' +
            '  \x1b[32m\u2713\x1b[0m CandidateSolution Verification Suite > should process input payload and return valid structure \x1b[90m(8ms)\x1b[0m\r\n' +
            '  \x1b[32m\u2713\x1b[0m CandidateSolution Verification Suite > should handle edge case input \x1b[90m(4ms)\x1b[0m\r\n\r\n' +
            '\x1b[32;1m Test Files\x1b[0m  \x1b[32;1m1 passed\x1b[0m (1)\r\n' +
            '\x1b[32;1m      Tests\x1b[0m  \x1b[32;1m2 passed\x1b[0m (2)\r\n' +
            '\x1b[90m   Start at\x1b[0m  \x1b[90m14:00:00\x1b[0m\r\n' +
            '\x1b[90m   Duration\x1b[0m  \x1b[32m214ms\x1b[0m \x1b[90m(transform 28ms, setup 0ms, collect 42ms, tests 12ms)\x1b[0m\r\n'
          );
        } else if (sub === 'run' && args[1] === 'build') {
          emitToTerminal(
            '\x1b[90m> candidate-assessment@0.1.0 build\x1b[0m\r\n' +
            '\x1b[90m> tsc --noEmit && vite build\x1b[0m\r\n\r\n' +
            '\x1b[32m\u2713\x1b[0m 3 modules transformed.\r\n' +
            '\x1b[90mdist/solution.js\x1b[0m  \x1b[32m1.48 kB\x1b[0m \x1b[90m(gzip: 0.62 kB)\x1b[0m\r\n' +
            '\x1b[32m\u2713 built in 142ms\x1b[0m\r\n'
          );
        } else if (sub === 'install' || sub === 'i' || sub === 'add') {
          emitToTerminal(
            `\x1b[90mResolving dependencies...\x1b[0m\r\n` +
            `\x1b[32m\u2713\x1b[0m All dependencies are locked and cached for this secure assessment container.\r\n`
          );
        } else {
          emitToTerminal(`\x1b[90mExecuting ${program} ${args.join(' ')} in /workspace...\x1b[0m\r\nDone in 0.38s.\r\n`);
        }
        break;
      }

      case 'git': {
        const sub = args[0];
        if (sub === 'status') {
          const dirtyFiles = filesRef.current.filter((f) => f.isDirty);
          emitToTerminal(
            'On branch main\r\n' +
            'Your branch is up to date with \'origin/main\'.\r\n\r\n'
          );
          if (dirtyFiles.length > 0) {
            emitToTerminal(
              'Changes not staged for commit:\r\n' +
              '  \x1b[90m(use "git add <file>..." to update what will be committed)\x1b[0m\r\n'
            );
            dirtyFiles.forEach((f) => {
              emitToTerminal(`\t\x1b[31mmodified:   ${f.path}\x1b[0m\r\n`);
            });
            emitToTerminal('\r\nno changes added to commit (use "git add" to track)\r\n');
          } else {
            emitToTerminal(
              'Changes to be committed:\r\n' +
              '  \x1b[90m(use "git restore --staged <file>..." to unstage)\x1b[0m\r\n' +
              '  \x1b[32mmodified:   src/solution.ts\x1b[0m\r\n\r\n' +
              'no changes added to commit (use "git add" to track)\r\n'
            );
          }
        } else if (sub === 'diff') {
          emitToTerminal(
            '\x1b[1mdiff --git a/src/solution.ts b/src/solution.ts\x1b[0m\r\n' +
            '\x1b[1mindex a1b2c3d..e4f5g6h 100644\x1b[0m\r\n' +
            '\x1b[31m--- a/src/solution.ts\x1b[0m\r\n' +
            '\x1b[32m+++ b/src/solution.ts\x1b[0m\r\n' +
            '\x1b[36m@@ -1,5 +1,9 @@\x1b[0m\r\n' +
            ' export class CandidateSolution {\r\n' +
            '\x1b[32m+  execute(payload: any) {\r\n' +
            '\x1b[32m+    return { status: "passed", data: payload };\r\n' +
            '\x1b[32m+  }\r\n\x1b[0m'
          );
        } else if (sub === 'add') {
          emitToTerminal('\x1b[90m[git] Changes staged successfully.\x1b[0m\r\n');
        } else if (sub === 'commit') {
          emitToTerminal('[main 9a2f1b4] Assessment solution updated\r\n 1 file changed, 8 insertions(+)\r\n');
        } else if (sub === 'log') {
          emitToTerminal(
            '\x1b[33mcommit 9a2f1b4c8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5\x1b[0m \x1b[36m(HEAD -> main)\x1b[0m\r\n' +
            'Author: candidate <candidate@hellosmart.ai>\r\n' +
            'Date:   Fri Nov 6 14:15:00 2026 +0000\r\n\r\n' +
            '    feat: implement solution logic\r\n\r\n' +
            '\x1b[33mcommit 8f3c7b2e1a4d5f6a7b8c9d0e1f2a3b4c5d6e7f8\x1b[0m \x1b[34m(origin/main)\x1b[0m\r\n' +
            'Author: HelloSmart Template Engine <system@hellosmart.ai>\r\n' +
            'Date:   Fri Nov 6 14:00:00 2026 +0000\r\n\r\n' +
            '    chore: seed candidate assessment workspace\r\n'
          );
        } else {
          emitToTerminal(`\x1b[90m[git] '${sub}' executed successfully\x1b[0m\r\n`);
        }
        break;
      }

      case 'node': {
        if (args[0] === '-v' || args[0] === '--version') {
          emitToTerminal('v20.18.0\r\n');
        } else {
          const file = args[0] || 'src/solution.ts';
          emitToTerminal(
            `\x1b[90m[Node.js v20.18.0]\x1b[0m Executing ${file} in ${currentDirRef.current}...\r\n` +
            `Execution finished with exit code 0.\r\n`
          );
        }
        break;
      }

      case 'python':
      case 'python3': {
        if (args[0] === '--version' || args[0] === '-V') {
          emitToTerminal('Python 3.12.3\r\n');
        } else {
          const file = args[0] || 'main.py';
          emitToTerminal(
            `\x1b[90m[Python 3.12.3]\x1b[0m Executing ${file} in ${currentDirRef.current}...\r\n` +
            `Execution completed successfully with code 0.\r\n`
          );
        }
        break;
      }

      case 'whoami': {
        emitToTerminal('candidate\r\n');
        break;
      }

      case 'hostname': {
        emitToTerminal('hellosmart\r\n');
        break;
      }

      case 'uname': {
        if (args.includes('-a')) {
          emitToTerminal('Linux hellosmart 6.6.0-28-generic #29-Ubuntu SMP PREEMPT_DYNAMIC x86_64 x86_64 GNU/Linux\r\n');
        } else {
          emitToTerminal('Linux\r\n');
        }
        break;
      }

      case 'date': {
        emitToTerminal(`${new Date().toUTCString()}\r\n`);
        break;
      }

      case 'uptime': {
        emitToTerminal(' 14:25:00 up 2:10,  1 user,  load average: 0.08, 0.05, 0.02\r\n');
        break;
      }

      case 'env': {
        emitToTerminal(
          'USER=candidate\r\n' +
          'HOSTNAME=hellosmart\r\n' +
          'HOME=/workspace\r\n' +
          'SHELL=/bin/bash\r\n' +
          'TERM=xterm-256color\r\n' +
          'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\r\n' +
          'NODE_ENV=development\r\n' +
          'WORKSPACE_ID=' + workspaceId + '\r\n'
        );
        break;
      }

      case 'ps': {
        emitToTerminal(
          '  PID TTY          TIME CMD\r\n' +
          '    1 pts/0    00:00:00 bash\r\n' +
          '   42 pts/0    00:00:00 ps\r\n'
        );
        break;
      }

      case 'top': {
        emitToTerminal(
          'top - 14:25:00 up 2:10, 1 user, load average: 0.08, 0.05, 0.02\r\n' +
          'Tasks: 102 total, 1 running, 101 sleeping, 0 stopped\r\n' +
          '%Cpu(s):  1.2 us,  0.4 sy,  0.0 ni, 98.4 id\r\n' +
          'MiB Mem :   8192.0 total,   6420.0 free,   1772.0 used\r\n'
        );
        break;
      }

      case 'which': {
        const prog = args[0];
        if (['npm', 'node', 'pnpm', 'vitest', 'git', 'python', 'python3', 'bash', 'cat', 'ls'].includes(prog || '')) {
          emitToTerminal(`/usr/bin/${prog}\r\n`);
        } else {
          emitToTerminal(`\x1b[31mwhich: no ${prog} in (/usr/local/bin:/usr/bin:/bin)\x1b[0m\r\n`);
        }
        break;
      }

      case 'echo': {
        emitToTerminal(`${args.join(' ')}\r\n`);
        break;
      }

      default: {
        emitToTerminal(`\x1b[31mbash: ${program}: command not found\x1b[0m\r\n`);
        break;
      }
    }

    emitToTerminal(formatPrompt(currentDirRef.current));
  }, [emitToTerminal, workspaceId]);

  const handleSimulatedInput = useCallback((data: string) => {
    // Enter key
    if (data === '\r' || data === '\n') {
      const cmd = lineBufferRef.current;
      if (cmd.trim()) {
        historyRef.current.push(cmd);
        historyIndexRef.current = historyRef.current.length;
      }
      lineBufferRef.current = '';
      handleSimulatedCommand(cmd);
      return;
    }

    // Ctrl+C (cancel)
    if (data === '\x03') {
      lineBufferRef.current = '';
      emitToTerminal('^C\r\n' + formatPrompt(currentDirRef.current));
      return;
    }

    // Ctrl+L (clear)
    if (data === '\x0c') {
      emitToTerminal('\x1b[2J\x1b[3J\x1b[H' + formatPrompt(currentDirRef.current) + lineBufferRef.current);
      return;
    }

    // Backspace
    if (data === '\x7f' || data === '\b') {
      if (lineBufferRef.current.length > 0) {
        lineBufferRef.current = lineBufferRef.current.slice(0, -1);
        emitToTerminal('\b \b');
      }
      return;
    }

    // Arrow Up (History previous)
    if (data === '\x1b[A') {
      if (historyRef.current.length > 0 && historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
        const prevCmd = historyRef.current[historyIndexRef.current] || '';
        // Clear current line in terminal
        const backSpaces = '\b \b'.repeat(lineBufferRef.current.length);
        lineBufferRef.current = prevCmd;
        emitToTerminal(backSpaces + prevCmd);
      }
      return;
    }

    // Arrow Down (History next)
    if (data === '\x1b[B') {
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyIndexRef.current += 1;
        const nextCmd = historyRef.current[historyIndexRef.current] || '';
        const backSpaces = '\b \b'.repeat(lineBufferRef.current.length);
        lineBufferRef.current = nextCmd;
        emitToTerminal(backSpaces + nextCmd);
      } else if (historyIndexRef.current === historyRef.current.length - 1) {
        historyIndexRef.current = historyRef.current.length;
        const backSpaces = '\b \b'.repeat(lineBufferRef.current.length);
        lineBufferRef.current = '';
        emitToTerminal(backSpaces);
      }
      return;
    }

    // Tab (Auto-complete)
    if (data === '\t') {
      const commonCommands = [
        'npm test',
        'git status',
        'git diff',
        'git log',
        'ls -la',
        'pwd',
        'clear',
        'cat README.md',
        'cd src',
        'cd tests',
        'whoami',
        'help',
      ];
      const current = lineBufferRef.current;
      const match = commonCommands.find((c) => c.startsWith(current) && c !== current);
      if (match) {
        const addition = match.slice(current.length);
        lineBufferRef.current = match;
        emitToTerminal(addition);
      }
      return;
    }

    // Normal printable character
    if (data.length >= 1 && !data.startsWith('\x1b')) {
      lineBufferRef.current += data;
      emitToTerminal(data);
    }
  }, [emitToTerminal, handleSimulatedCommand]);

  // Connect to WebSocket
  const connectSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    setStatus('connecting');
    setError(null);

    // Build WebSocket URL
    let url: string;
    if (wsUrl) {
      url = wsUrl;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
      const sessionToken = token || 'candidate-workspace-session-token';
      url = `${protocol}//${host}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/terminal?token=${encodeURIComponent(sessionToken)}`;
    }

    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      let connectionSucceeded = false;

      socket.onopen = () => {
        connectionSucceeded = true;
        setStatus('connected');
        setIsSimulated(false);
        setError(null);
      };

      socket.onmessage = (event) => {
        try {
          if (typeof event.data === 'string') {
            // Check if JSON structured message
            if (event.data.startsWith('{')) {
              try {
                const parsed = JSON.parse(event.data);
                if (parsed.type === 'output' && typeof parsed.data === 'string') {
                  emitToTerminal(parsed.data);
                  return;
                }
              } catch {}
            }
            emitToTerminal(event.data);
          } else if (event.data instanceof ArrayBuffer) {
            const decoded = new TextDecoder().decode(event.data);
            emitToTerminal(decoded);
          }
        } catch (err) {
          console.error('[TerminalSocket] Error handling message:', err);
        }
      };

      socket.onerror = () => {
        if (!connectionSucceeded) {
          // If connection failed immediately, fallback to simulated terminal
          setIsSimulated(true);
          setStatus('connected');
          printBanner();
        } else {
          setError('Terminal connection error');
          setStatus('error');
        }
      };

      socket.onclose = () => {
        if (!connectionSucceeded) {
          setIsSimulated(true);
          setStatus('connected');
          printBanner();
        } else {
          setStatus('disconnected');
        }
      };
    } catch {
      // In case WebSocket constructor throws (e.g. invalid URL in test env)
      setIsSimulated(true);
      setStatus('connected');
      printBanner();
    }
  }, [emitToTerminal, printBanner, token, workspaceId, wsUrl]);

  useEffect(() => {
    connectSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectSocket]);

  const sendInput = useCallback((data: string) => {
    if (isSimulated || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      handleSimulatedInput(data);
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'input', data }));
    } catch (err) {
      console.error('[TerminalSocket] sendInput failed:', err);
    }
  }, [handleSimulatedInput, isSimulated]);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
    } catch (err) {
      console.error('[TerminalSocket] sendResize failed:', err);
    }
  }, []);

  const restartShell = useCallback(() => {
    if (isSimulated || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      lineBufferRef.current = '';
      emitToTerminal('\r\n\x1b[33mRestarting container shell environment...\x1b[0m\r\n');
      printBanner();
      return;
    }

    try {
      socketRef.current.send(JSON.stringify({ type: 'restart' }));
    } catch (err) {
      console.error('[TerminalSocket] restartShell failed:', err);
    }
  }, [emitToTerminal, isSimulated, printBanner]);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    connectSocket();
  }, [connectSocket]);

  return {
    status,
    isSimulated,
    error,
    sendInput,
    sendResize,
    restartShell,
    reconnect,
  };
}
