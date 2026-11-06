import type { TaskSpec } from '../schemas/task-spec.js';

export interface WorkspaceSessionContext {
  sessionId: string;
  assignmentId: string;
  candidateId: string;
  orgId: string;
  sessionToken: string;
  expiresAt: string;
}

export interface WorkspaceSlotHandle {
  slotId: string;
  hostId: string;
  ipAddress: string;
  port: number;
  status: 'reserved' | 'starting' | 'running' | 'stopping' | 'destroyed';
  createdAt: string;
}

export interface ResourceBundle {
  repoName: string;
  commitSha: string;
  seedDataUrl?: string;
  taskMarkdownPath: string;
}

export interface WorkspaceConnectionInfo {
  slotId: string;
  webIdeUrl: string;
  terminalWebSocketUrl: string;
  aiProxyLocalUrl: string;
  expiresAt: string;
}

export interface SlotHealthStatus {
  healthy: boolean;
  servicesRunning: {
    ide: boolean;
    terminal: boolean;
    aiProxy: boolean;
    recorder: boolean;
  };
  latencyMs: number;
  lastCheckedAt: string;
}

export interface SnapshotMetadata {
  snapshotId: string;
  slotId: string;
  s3Uri: string;
  sizeBytes: number;
  gitCommitSha: string;
  createdAt: string;
}

export interface SlotRuntimeMetrics {
  slotId: string;
  cpuPercent: number;
  memoryUsedMb: number;
  memoryLimitMb: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptimeSeconds: number;
}

/**
 * Pluggable virtualization driver interface for HelloSmart Fabric (RMS).
 * Decouples the control plane from specific VM/container runtimes.
 */
export interface IWorkspaceProvider {
  /** Reserves a slot from the warm pool or spins up a fresh container/VM */
  createSlot(spec: TaskSpec, session: WorkspaceSessionContext): Promise<WorkspaceSlotHandle>;

  /** Injects the pinned repository commit, seed data, and TASK.md brief */
  attachResources(slotId: string, resources: ResourceBundle): Promise<void>;

  /** Injects decrypted secrets into session-scoped environment slots */
  injectSecrets(slotId: string, secrets: Record<string, string>): Promise<void>;

  /** Starts in-VM daemons (IDE, terminal relay, recorder, AI proxy bridge) */
  startServices(slotId: string): Promise<WorkspaceConnectionInfo>;

  /** Checks health of in-slot daemons before client handover */
  healthCheck(slotId: string): Promise<SlotHealthStatus>;

  /** Takes an immutable snapshot of candidate workspace state and archives to S3 */
  createSnapshot(slotId: string, destinationS3Uri: string): Promise<SnapshotMetadata>;

  /** Destroys the VM slot and releases host resources back to the pool */
  destroySlot(slotId: string): Promise<void>;

  /** Queries real-time runtime metrics for cost control and idle reaping */
  getSlotStatus(slotId: string): Promise<SlotRuntimeMetrics>;
}

