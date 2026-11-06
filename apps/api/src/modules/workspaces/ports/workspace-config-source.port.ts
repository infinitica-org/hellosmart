export interface WorkspaceConfigSourcePort {
  getConfig(workspaceId: string): Promise<Record<string, unknown>>;
}

export const WORKSPACE_CONFIG_SOURCE_PORT = Symbol('WORKSPACE_CONFIG_SOURCE_PORT');

/**
 * Empty production fallback for WorkspaceConfigSourcePort.
 */
export class EmptyWorkspaceConfigSource implements WorkspaceConfigSourcePort {
  async getConfig(_workspaceId: string): Promise<Record<string, unknown>> {
    return {};
  }
}
