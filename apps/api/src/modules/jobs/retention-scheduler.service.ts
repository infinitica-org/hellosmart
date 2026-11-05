import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { RetentionPurgeWorker } from './retention-purge.worker.js';

@Injectable()
export class RetentionSchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(RetentionSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastRunDate: string | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    private readonly worker: RetentionPurgeWorker,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.RETENTION_PURGE_ENABLED) {
      this.logger.log(
        'Retention purge worker is disabled (RETENTION_PURGE_ENABLED=false). Automated daily cleanup will not run.',
      );
      return;
    }

    if (this.config.NODE_ENV === 'test') {
      this.logger.log('Retention purge worker scheduler disabled in test environment.');
      return;
    }

    this.logger.log(
      `Retention purge worker enabled. Scheduled daily after ${this.config.RETENTION_PURGE_HOUR_UTC}:00 UTC.`,
    );

    // Check cadence once per minute using an unref'd timer
    this.timer = setInterval(() => {
      void this.checkAndRun();
    }, 60_000);
    this.timer.unref();

    // Perform initial check on startup
    void this.checkAndRun();
  }

  async checkAndRun(): Promise<void> {
    if (!this.config.RETENTION_PURGE_ENABLED) {
      return;
    }

    const now = new Date();
    const currentHourUtc = now.getUTCHours();
    const todayDateUtc = now.toISOString().slice(0, 10);

    if (
      currentHourUtc >= this.config.RETENTION_PURGE_HOUR_UTC &&
      this.lastRunDate !== todayDateUtc
    ) {
      this.lastRunDate = todayDateUtc;
      this.logger.log(
        `Triggering daily retention purge for ${todayDateUtc} (hour ${currentHourUtc} UTC)...`,
      );
      try {
        await this.worker.run();
      } catch (err: any) {
        this.logger.error('Error during scheduled retention purge run', err?.stack || err?.message);
      }
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
