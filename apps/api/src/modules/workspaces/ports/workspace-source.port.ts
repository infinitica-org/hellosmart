import { Injectable, Logger } from '@nestjs/common';

export interface WorkspaceSourcePort {
  /**
   * Reads the candidate's final working tree from the workspace container volume or agent.
   * Returns a map of relative POSIX path -> file buffer.
   */
  readCandidateTree(orgId: string, workspaceId: string): Promise<Map<string, Buffer>>;

  /**
   * Reads the template base file tree for diff generation.
   * Returns null if template base cannot be resolved or is unavailable.
   */
  readTemplateTree(templateRef: string): Promise<Map<string, Buffer> | null>;

  /**
   * Reads terminal session history captured during the candidate's session.
   */
  readTerminalHistory(orgId: string, workspaceId: string): Promise<string | null>;

  /**
   * Reads optional workspace configuration (e.g. AI proxy policy, chat state).
   */
  readWorkspaceConfig(orgId: string, workspaceId: string): Promise<Record<string, unknown> | null>;
}

export const WORKSPACE_SOURCE_PORT = Symbol('WORKSPACE_SOURCE_PORT');

/**
 * Production fail-closed implementation until ws-agent (T-023) and orchestrator (T-021) are built.
 */
@Injectable()
export class EmptyWorkspaceSourceAdapter implements WorkspaceSourcePort {
  private readonly logger = new Logger(EmptyWorkspaceSourceAdapter.name);

  async readCandidateTree(orgId: string, workspaceId: string): Promise<Map<string, Buffer>> {
    this.logger.warn(
      `readCandidateTree called for org=${orgId} ws=${workspaceId} but no live workspace volume reader is attached.`,
    );
    return new Map<string, Buffer>();
  }

  async readTemplateTree(templateRef: string): Promise<Map<string, Buffer> | null> {
    this.logger.warn(
      `readTemplateTree called for templateRef=${templateRef}; template base repository resolution is not built yet.`,
    );
    return null;
  }

  async readTerminalHistory(orgId: string, workspaceId: string): Promise<string | null> {
    this.logger.warn(
      `readTerminalHistory called for org=${orgId} ws=${workspaceId}; ws-agent terminal recorder is not attached.`,
    );
    return null;
  }

  async readWorkspaceConfig(
    orgId: string,
    workspaceId: string,
  ): Promise<Record<string, unknown> | null> {
    return null;
  }
}
