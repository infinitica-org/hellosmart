import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { WorkspaceReaperService } from './workspace-reaper.service.js';

export const WORKSPACE_REAPER_QUEUE_NAME = 'workspace-reaper';
export const WORKSPACE_REAPER_SCHEDULER_ID = 'workspace-reaper-sweep';

@Injectable()
export class WorkspaceReaperScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WorkspaceReaperScheduler.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    private readonly reaperService: WorkspaceReaperService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.WORKSPACE_REAPER_ENABLED) {
      this.logger.log(
        'Workspace orphan reaper is disabled (WORKSPACE_REAPER_ENABLED=false). Automated garbage collection will not run.',
      );
      return;
    }

    if (this.config.NODE_ENV === 'test') {
      this.logger.log('Workspace orphan reaper scheduler disabled in test environment.');
      return;
    }

    this.validateRuntimeConfiguration();
    this.initializeQueue();
  }

  private validateRuntimeConfiguration(): void {
    if (!this.config.REDIS_URL) {
      throw new Error(
        'Invalid configuration: WORKSPACE_REAPER_ENABLED=true requires REDIS_URL to be defined',
      );
    }

    if (
      !this.config.REAPER_DRY_RUN &&
      this.config.NODE_ENV !== 'production' &&
      !this.config.REAPER_ALLOW_DESTRUCTION_IN_NON_PROD
    ) {
      throw new Error(
        'Invalid configuration: REAPER_DRY_RUN=false in non-production requires REAPER_ALLOW_DESTRUCTION_IN_NON_PROD=true',
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

    const prefix = `hs:${this.config.NODE_ENV}:reaper`;
    const intervalSec = this.config.REAPER_INTERVAL_SECONDS ?? 300;
    const intervalMs = intervalSec * 1000;

    this.queue = new Queue(WORKSPACE_REAPER_QUEUE_NAME, {
      connection,
      prefix,
    });

    this.worker = new Worker(
      WORKSPACE_REAPER_QUEUE_NAME,
      async (job) => {
        if (job.name === 'sweep') {
          return await this.reaperService.sweep();
        }
        throw new Error(`Unknown reaper job ${job.name}`);
      },
      {
        connection,
        prefix,
        concurrency: 1, // Sweeps never overlap
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Reaper sweep job ${job?.id} failed: ${err?.message}`);
    });

    // Register repeatable job schedule idempotently
    void this.registerScheduler(intervalMs);

    this.logger.log(
      `Workspace orphan reaper initialized: interval=${intervalSec}s, dryRun=${this.config.REAPER_DRY_RUN ?? true}`,
    );
  }

  private async registerScheduler(intervalMs: number): Promise<void> {
    if (!this.queue) return;
    try {
      if (typeof (this.queue as any).upsertJobScheduler === 'function') {
        await (this.queue as any).upsertJobScheduler(
          WORKSPACE_REAPER_SCHEDULER_ID,
          { every: intervalMs },
          {
            name: 'sweep',
            data: {},
            opts: {
              removeOnComplete: 10,
              removeOnFail: 20,
            },
          },
        );
      } else {
        await this.queue.add(
          'sweep',
          {},
          {
            repeat: { every: intervalMs, key: WORKSPACE_REAPER_SCHEDULER_ID },
            removeOnComplete: 10,
            removeOnFail: 20,
          },
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `Failed to register repeatable reaper schedule: ${err instanceof Error ? err.message : String(err)}`,
      );
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
