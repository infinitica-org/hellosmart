import { Readable } from 'node:stream';
import type {
  WorkspaceEntry,
  WorkspaceVolumeReaderPort,
} from '../ports/workspace-volume-reader.port.js';

export interface FakeFileOptions {
  content: Buffer | string;
  mtime?: Date;
  mode?: number;
}

export class FakeWorkspaceVolumeReader implements WorkspaceVolumeReaderPort {
  private readonly files = new Map<
    string,
    Map<string, { buffer: Buffer; entry: WorkspaceEntry }>
  >();
  private readonly unreadablePaths = new Set<string>();
  private readonly disappearingPaths = new Set<string>();

  /**
   * Adds or updates a regular file in a fake workspace.
   */
  setFile(workspaceId: string, relativePath: string, options: FakeFileOptions): void {
    let ws = this.files.get(workspaceId);
    if (!ws) {
      ws = new Map();
      this.files.set(workspaceId, ws);
    }

    const buf = Buffer.isBuffer(options.content)
      ? options.content
      : Buffer.from(options.content, 'utf8');
    const entry: WorkspaceEntry = {
      path: relativePath,
      type: 'file',
      size: buf.length,
      mtime: options.mtime ?? new Date(0),
      mode: options.mode ?? 0o644,
    };

    ws.set(relativePath, { buffer: buf, entry });
  }

  /**
   * Adds a symlink entry to a fake workspace.
   */
  setSymlink(workspaceId: string, relativePath: string, target: string): void {
    let ws = this.files.get(workspaceId);
    if (!ws) {
      ws = new Map();
      this.files.set(workspaceId, ws);
    }
    const entry: WorkspaceEntry = {
      path: relativePath,
      type: 'symlink',
      size: 0,
      mtime: new Date(0),
      mode: 0o777,
      symlinkTarget: target,
    };
    ws.set(relativePath, { buffer: Buffer.alloc(0), entry });
  }

  /**
   * Adds a special entry (FIFO, socket, block/char device).
   */
  setSpecial(workspaceId: string, relativePath: string): void {
    let ws = this.files.get(workspaceId);
    if (!ws) {
      ws = new Map();
      this.files.set(workspaceId, ws);
    }
    const entry: WorkspaceEntry = {
      path: relativePath,
      type: 'special',
      size: 0,
      mtime: new Date(0),
      mode: 0o600,
    };
    ws.set(relativePath, { buffer: Buffer.alloc(0), entry });
  }

  deleteFile(workspaceId: string, relativePath: string): void {
    const ws = this.files.get(workspaceId);
    if (ws) {
      ws.delete(relativePath);
    }
  }

  markUnreadable(relativePath: string): void {
    this.unreadablePaths.add(relativePath);
  }

  markDisappearing(relativePath: string): void {
    this.disappearingPaths.add(relativePath);
  }

  async listEntries(workspaceId: string, _subpath?: string): Promise<WorkspaceEntry[]> {
    const ws = this.files.get(workspaceId);
    if (!ws) {
      return [];
    }
    return Array.from(ws.values()).map((v) => ({ ...v.entry }));
  }

  async openReadStream(workspaceId: string, relativePath: string): Promise<Readable> {
    const buf = await this.readFile(workspaceId, relativePath);
    return Readable.from(buf);
  }

  async readFile(workspaceId: string, relativePath: string): Promise<Buffer> {
    if (this.unreadablePaths.has(relativePath)) {
      throw new Error(`EACCES: permission denied, open '${relativePath}'`);
    }
    if (this.disappearingPaths.has(relativePath)) {
      // Simulate file disappearing after listEntries
      const ws = this.files.get(workspaceId);
      if (ws) ws.delete(relativePath);
      throw new Error(`ENOENT: no such file or directory, open '${relativePath}'`);
    }

    const ws = this.files.get(workspaceId);
    const item = ws?.get(relativePath);
    if (!item) {
      throw new Error(`ENOENT: no such file or directory, open '${relativePath}'`);
    }
    return item.buffer;
  }
}
