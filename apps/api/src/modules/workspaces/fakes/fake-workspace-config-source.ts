import type { WorkspaceConfigSourcePort } from '../ports/workspace-config-source.port.js';

export class FakeWorkspaceConfigSource implements WorkspaceConfigSourcePort {
  private readonly configs = new Map<string, Record<string, unknown>>();

  setConfig(workspaceId: string, config: Record<string, unknown>): void {
    this.configs.set(workspaceId, { ...config });
  }

  async getConfig(workspaceId: string): Promise<Record<string, unknown>> {
    return this.configs.get(workspaceId) ?? {};
  }
}
