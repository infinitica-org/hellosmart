import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { AutoSubmitWorker } from './auto-submit.worker.js';
import { EmailWorker } from './email.worker.js';

@Injectable()
export class TimingJobsScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TimingJobsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(APP_CONFIG) private readonly config: Config,
    private readonly autoSubmit: AutoSubmitWorker,
    private readonly email: EmailWorker,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 30_000);
    this.timer.unref();
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.autoSubmit.sweep();
      await this.email.run();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'timing jobs failed';
      this.logger.error(message);
    } finally {
      this.running = false;
    }
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
