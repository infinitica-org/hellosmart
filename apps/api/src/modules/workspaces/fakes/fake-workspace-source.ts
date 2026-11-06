import type { CandidateFileEntry, WorkspaceSourcePort } from '../ports/workspace-source.port.js';

export class FakeWorkspaceSourceAdapter implements WorkspaceSourcePort {
  private candidateFiles = new Map<string, Buffer>();
  private candidateDetailed = new Map<string, CandidateFileEntry>();
  private templateFiles: Map<string, Buffer> | null = null;
  private terminalHistory: string | null = null;
  private workspaceConfig: Record<string, unknown> | null = null;

  setCandidateFiles(files: Record<string, string | Buffer>): void {
    this.candidateFiles.clear();
    this.candidateDetailed.clear();
    for (const [p, content] of Object.entries(files)) {
      const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      this.candidateFiles.set(p, buf);
      this.candidateDetailed.set(p, { buffer: buf, mode: 0o644 });
    }
  }

  setCandidateDetailedEntry(path: string, entry: CandidateFileEntry): void {
    this.candidateDetailed.set(path, entry);
    this.candidateFiles.set(path, entry.buffer);
  }

  setTemplateFiles(files: Record<string, string | Buffer> | null): void {
    if (files === null) {
      this.templateFiles = null;
      return;
    }
    this.templateFiles = new Map<string, Buffer>();
    for (const [p, content] of Object.entries(files)) {
      this.templateFiles.set(p, Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));
    }
  }

  setTerminalHistory(log: string | null): void {
    this.terminalHistory = log;
  }

  setWorkspaceConfig(config: Record<string, unknown> | null): void {
    this.workspaceConfig = config;
  }

  async readCandidateTree(_orgId: string, _workspaceId: string): Promise<Map<string, Buffer>> {
    return new Map(this.candidateFiles);
  }

  async readCandidateTreeDetailed(
    _orgId: string,
    _workspaceId: string,
  ): Promise<Map<string, CandidateFileEntry>> {
    return new Map(this.candidateDetailed);
  }

  async readTemplateTree(_templateRef: string): Promise<Map<string, Buffer> | null> {
    return this.templateFiles !== null ? new Map(this.templateFiles) : null;
  }

  async readTerminalHistory(_orgId: string, _workspaceId: string): Promise<string | null> {
    return this.terminalHistory;
  }

  async readWorkspaceConfig(
    _orgId: string,
    _workspaceId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.workspaceConfig;
  }
}
