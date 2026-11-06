export interface TerminalLogDelta {
  logBytes: Buffer;
  nextOffset: number;
}

export interface TerminalLogSourcePort {
  getDelta(workspaceId: string, sinceOffset: number): Promise<TerminalLogDelta>;
}

export const TERMINAL_LOG_SOURCE_PORT = Symbol('TERMINAL_LOG_SOURCE_PORT');

/**
 * Empty production fallback for TerminalLogSourcePort.
 */
export class EmptyTerminalLogSource implements TerminalLogSourcePort {
  async getDelta(_workspaceId: string, sinceOffset: number): Promise<TerminalLogDelta> {
    return {
      logBytes: Buffer.alloc(0),
      nextOffset: sinceOffset,
    };
  }
}
