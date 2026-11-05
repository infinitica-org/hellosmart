import { Inject, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';

const OPS_QUEUE = (env: string) => `hs:${env}:ops`;

/**
 * Lightweight ops ping queue for the worker process.
 * Candidate retention jobs stay in JobsModule (API).
 */
@Module({})
export class OpsQueueModule implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private connection: ConnectionOptions | null = null;

  constructor(@Inject(APP_CONFIG) private readonly config: Config) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.REDIS_URL) {
      return;
    }
    const url = new URL(this.config.REDIS_URL);
    this.connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
    const queueName = OPS_QUEUE(this.config.NODE_ENV);
    this.queue = new Queue(queueName, { connection: this.connection });
    this.worker = new Worker(
      queueName,
      async (job) => {
        if (job.name === 'ping') {
          return { ok: true, at: new Date().toISOString() };
        }
        throw new Error(`Unknown job ${job.name}`);
      },
      { connection: this.connection },
    );
    await this.queue.add(
      'ping',
      { kind: 'health' },
      { repeat: { every: 60_000 }, removeOnComplete: 10, removeOnFail: 20 },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.worker?.close(), this.queue?.close()]);
  }
}
