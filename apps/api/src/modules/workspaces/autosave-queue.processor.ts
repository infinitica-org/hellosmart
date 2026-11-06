import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { AutosavePackager } from './autosave.packager.js';
import {
  WORKSPACE_REGISTRY_PORT,
  type WorkspaceRegistryPort,
} from './ports/workspace-registry.port.js';

export const WORKSPACE_AUTOSAVE_QUEUE_NAME = 'workspace-autosave';

export interface AutosaveJobData {
  workspaceId: string;
  orgId: string;
  assignmentId: string;
}

@Injectable()
export class AutosaveQueueProcessor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AutosaveQueueProcessor.name);
  private queue: Queue<AutosaveJobData> | null = null;
  private worker: Worker<AutosaveJobData> | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;
  private readonly activeProcessing = new Set<string>();

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    @Inject(WORKSPACE_REGISTRY_PORT)
    private readonly registry: WorkspaceRegistryPort,
    private readonly packager: AutosavePackager,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.WORKSPACE_AUTOSAVE_ENABLED) {
      this.logger.log(
        'Workspace autosave background service is disabled (WORKSPACE_AUTOSAVE_ENABLED=false).',
      );
      return;
    }

    if (this.config.NODE_ENV === 'test') {
      this.logger.log('Workspace autosave queue processor disabled in test environment.');
      return;
    }

    this.validateRuntimeConfiguration();
    this.initializeQueue();
    this.startSweepTimer();
  }

  private validateRuntimeConfiguration(): void {
    if (!this.config.REDIS_URL) {
      throw new Error(
        'Invalid configuration: WORKSPACE_AUTOSAVE_ENABLED=true requires REDIS_URL to be defined',
      );
    }
    if (this.config.STORAGE_DRIVER === 's3' && !this.config.STORAGE_S3_BUCKET) {
      throw new Error(
        'Invalid configuration: STORAGE_DRIVER=s3 requires STORAGE_S3_BUCKET to be defined',
      );
    }
  }

  private initializeQueue(): void {
    const url = new URL(this.config.REDIS_URL!);
    const connection: ConnectionOptions = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };

    const prefix = `hs:${this.config.NODE_ENV}:autosave`;

    this.queue = new Queue<AutosaveJobData>(WORKSPACE_AUTOSAVE_QUEUE_NAME, {
      connection,
      prefix,
    });

    this.worker = new Worker<AutosaveJobData>(
      WORKSPACE_AUTOSAVE_QUEUE_NAME,
      async (job: Job<AutosaveJobData>) => {
        await this.processJob(job.data);
      },
      {
        connection,
        prefix,
        concurrency: 5,
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        `Autosave job failed for workspace ${job?.data?.workspaceId}: ${err?.message}`,
      );
    });

    this.logger.log(
      `Workspace autosave queue initialized with interval ${this.config.AUTOSAVE_INTERVAL_SECONDS}s.`,
    );
  }

  private startSweepTimer(): void {
    const intervalMs = (this.config.AUTOSAVE_INTERVAL_SECONDS || 30) * 1000;
    this.sweepTimer = setInterval(() => {
      void this.sweepAndSchedule();
    }, intervalMs);
    this.sweepTimer.unref();

    void this.sweepAndSchedule();
  }

  /**
   * Periodic sweeper finding due workspaces and enqueuing jobs.
   */
  async sweepAndSchedule(): Promise<void> {
    if (!this.config.WORKSPACE_AUTOSAVE_ENABLED || !this.queue) {
      return;
    }

    try {
      const intervalSec = this.config.AUTOSAVE_INTERVAL_SECONDS || 30;
      const cutoffDate = new Date(Date.now() - intervalSec * 1000);
      const dueWorkspaces = await this.registry.findDueWorkspaces(cutoffDate);

      for (const ws of dueWorkspaces) {
        if (this.activeProcessing.has(ws.id)) {
          continue;
        }

        const jobId = `autosave:${ws.id}:${Date.now()}`;
        await this.queue.add(
          'snapshot',
          {
            workspaceId: ws.id,
            orgId: ws.orgId,
            assignmentId: ws.assignmentId,
          },
          {
            jobId,
            removeOnComplete: 10,
            removeOnFail: 20,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
          },
        );
      }
    } catch (err: any) {
      this.logger.error(`Error during autosave sweep: ${err?.message}`);
    }
  }

  /**
   * Processes an individual autosave job within tenant boundaries.
   */
  async processJob(data: AutosaveJobData): Promise<void> {
    const { workspaceId, orgId } = data;

    if (this.activeProcessing.has(workspaceId)) {
      this.logger.debug(`Autosave already in progress for workspace ${workspaceId}; skipping`);
      return;
    }

    this.activeProcessing.add(workspaceId);
    try {
      const workspace = await this.registry.getWorkspaceById(workspaceId, orgId);
      if (!workspace) {
        this.logger.warn(
          `Workspace ${workspaceId} not found or tenant mismatch with ${orgId}; dropping job`,
        );
        return;
      }

      if (workspace.status !== 'connected' && workspace.status !== 'disconnected') {
        this.logger.debug(
          `Workspace ${workspaceId} status '${workspace.status}' is no longer active; skipping`,
        );
        return;
      }

      await this.packager.snapshotWorkspace(workspace);
    } finally {
      this.activeProcessing.delete(workspaceId);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    await Promise.all([this.worker?.close(), this.queue?.close()]);
    this.worker = null;
    this.queue = null;
  }
}
