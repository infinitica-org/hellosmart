import type { Readable } from 'node:stream';

export type WorkspaceEntryType = 'file' | 'directory' | 'symlink' | 'special';

export interface WorkspaceEntry {
  path: string; // Relative normalized POSIX path
  type: WorkspaceEntryType;
  size: number;
  mtime: Date;
  mode: number;
  symlinkTarget?: string | undefined;
}

export interface WorkspaceVolumeReaderPort {
  listEntries(workspaceId: string, subpath?: string): Promise<WorkspaceEntry[]>;
  openReadStream(workspaceId: string, relativePath: string): Promise<Readable>;
  readFile(workspaceId: string, relativePath: string): Promise<Buffer>;
}

export const WORKSPACE_VOLUME_READER_PORT = Symbol('WORKSPACE_VOLUME_READER_PORT');

/**
 * Fail-closed production provider for WorkspaceVolumeReaderPort.
 * Until the Sysbox container / orchestrator is deployed, access to candidate
 * volumes is denied or returns empty to ensure security.
 */
export class FailClosedWorkspaceVolumeReader implements WorkspaceVolumeReaderPort {
  async listEntries(_workspaceId: string, _subpath?: string): Promise<WorkspaceEntry[]> {
    return [];
  }

  async openReadStream(_workspaceId: string, _relativePath: string): Promise<Readable> {
    throw new Error('Workspace volume reader is not available in current environment');
  }

  async readFile(_workspaceId: string, _relativePath: string): Promise<Buffer> {
    throw new Error('Workspace volume reader is not available in current environment');
  }
}
