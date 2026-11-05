import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { EmailSender } from '@hs/adapters';
import type { PoolClient } from 'pg';
import { PG_PLATFORM_POOL, type PgPool } from '../database/database.tokens.js';
import { EMAIL_SENDER_PORT } from '../adapters/adapters.tokens.js';
import { withPlatform } from '../tenancy/with-org.js';
import {
  EMAIL_MAX_ATTEMPTS,
  EmailService,
  isPermanentEmailFailure,
  nextEmailDelayMs,
  type EmailTemplateName,
} from '../emails/email.service.js';

interface EmailJobRow {
  id: string;
  org_id: string | null;
  attempts: number;
  payload: {
    to?: string;
    template?: EmailTemplateName;
    vars?: Record<string, string>;
  };
}

@Injectable()
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly platformPool: PgPool,
    private readonly emails: EmailService,
    @Optional() @Inject(EMAIL_SENDER_PORT) private readonly sender?: EmailSender,
  ) {}

  async run(options?: { referenceTime?: Date; limit?: number }): Promise<{ processed: number; sent: number; failed: number }> {
    const now = options?.referenceTime ?? new Date();
    const limit = options?.limit ?? 20;
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < limit; i += 1) {
      const job = await this.claim(now);
      if (!job) break;
      processed += 1;
      const outcome = await this.dispatch(job, now);
      if (outcome === 'sent') sent += 1;
      else failed += 1;
    }

    return { processed, sent, failed };
  }

  private async claim(now: Date): Promise<EmailJobRow | null> {
    const client = await this.platformPool.connect();
    try {
      return await withPlatform(client, async (tx) => {
        await tx.query(
          `UPDATE app.jobs
              SET status = 'failed',
                  run_after = now(),
                  last_error = 'recovered stale running job'
            WHERE status = 'running'
              AND locked_at IS NOT NULL
              AND locked_at < $1::timestamptz - interval '10 minutes'`,
          [now.toISOString()],
        );
        const result = await tx.query<EmailJobRow>(
          `WITH next AS (
             SELECT id FROM app.jobs
              WHERE kind = 'email'
                AND status IN ('queued', 'failed')
                AND run_after <= $1
              ORDER BY run_after
              FOR UPDATE SKIP LOCKED
              LIMIT 1
           )
           UPDATE app.jobs AS j
              SET status = 'running',
                  attempts = j.attempts + 1,
                  locked_at = $1,
                  updated_at = $1
             FROM next
            WHERE j.id = next.id
            RETURNING j.id, j.org_id, j.attempts, j.payload`,
          [now.toISOString()],
        );
        return result.rows[0] ?? null;
      });
    } finally {
      client.release();
    }
  }

  private async dispatch(job: EmailJobRow, now: Date): Promise<'sent' | 'failed' | 'bounced'> {
    const to = job.payload?.to ?? '';
    const template = job.payload?.template;
    try {
      if (!to || !template) {
        throw new Error('invalid recipient');
      }
      const rendered = this.emails.render(template, job.payload.vars ?? {});
      if (!this.sender) {
        throw new Error('email provider is not configured');
      }
      const sent = await this.sender.send({
        to,
        template,
        vars: {
          ...job.payload.vars,
          html: rendered.html,
          text: rendered.text,
        },
        ...(job.org_id ? { orgId: job.org_id } : {}),
      });
      await this.finish(job, {
        status: 'sent',
        logStatus: 'sent',
        providerMessageId: sent.providerId,
        now,
      });
      return 'sent';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'email send failed';
      const bounced = isPermanentEmailFailure(error);
      const exhausted = job.attempts >= EMAIL_MAX_ATTEMPTS || bounced;
      const delay = nextEmailDelayMs(job.attempts);
      await this.finish(job, {
        status: exhausted ? 'dead' : 'failed',
        logStatus: bounced ? 'bounced' : 'failed',
        error: message,
        runAfter: new Date(now.getTime() + delay),
        now,
      });
      this.logger.warn(`email job ${job.id} ${bounced ? 'bounced' : 'failed'}: ${message}`);
      return bounced ? 'bounced' : 'failed';
    }
  }

  private async finish(
    job: EmailJobRow,
    result: {
      status: 'sent' | 'failed' | 'dead';
      logStatus: 'sent' | 'failed' | 'bounced';
      providerMessageId?: string;
      error?: string;
      runAfter?: Date;
      now: Date;
    },
  ): Promise<void> {
    const client = await this.platformPool.connect();
    try {
      await withPlatform(client, async (tx: PoolClient) => {
        await tx.query(
          `UPDATE app.jobs
              SET status = $2,
                  last_error = $3,
                  run_after = COALESCE($4::timestamptz, run_after),
                  locked_at = NULL,
                  updated_at = $5
            WHERE id = $1`,
          [
            job.id,
            result.status,
            result.error ?? null,
            result.runAfter ? result.runAfter.toISOString() : null,
            result.now.toISOString(),
          ],
        );
        await tx.query(
          `INSERT INTO app.email_logs (org_id, job_id, recipient, template, status, provider_message_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            job.org_id,
            job.id,
            job.payload?.to ?? '',
            job.payload?.template ?? 'unknown',
            result.logStatus,
            result.providerMessageId ?? null,
          ],
        );
      });
    } finally {
      client.release();
    }
  }
}
