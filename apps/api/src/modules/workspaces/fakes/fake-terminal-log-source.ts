import type { TerminalLogDelta, TerminalLogSourcePort } from '../ports/terminal-log-source.port.js';

export class FakeTerminalLogSource implements TerminalLogSourcePort {
  private readonly logs = new Map<string, Buffer>();

  setLogs(workspaceId: string, logContent: Buffer | string): void {
    const buf = Buffer.isBuffer(logContent) ? logContent : Buffer.from(logContent, 'utf8');
    this.logs.set(workspaceId, buf);
  }

  async getDelta(workspaceId: string, sinceOffset: number): Promise<TerminalLogDelta> {
    const all = this.logs.get(workspaceId) ?? Buffer.alloc(0);
    if (sinceOffset >= all.length) {
      return { logBytes: Buffer.alloc(0), nextOffset: all.length };
    }
    const delta = all.subarray(sinceOffset);
    return { logBytes: delta, nextOffset: all.length };
  }
}
