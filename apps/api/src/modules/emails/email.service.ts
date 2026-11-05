import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.tokens.js';
import { withOrg, withPlatform } from '../tenancy/with-org.js';

export const EMAIL_TEMPLATES = [
  'candidate-invite',
  'password-reset',
  'deadline-reminder',
  'submission-receipt',
] as const;

export type EmailTemplateName = (typeof EMAIL_TEMPLATES)[number];

export const EMAIL_BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 30 * 60_000, 60 * 60_000] as const;
export const EMAIL_MAX_ATTEMPTS = EMAIL_BACKOFF_MS.length;

const HELLOSMART_MARK =
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0b1f3a;">HelloSmart<span style="color:#ea580c;">.ai</span></div>';

export interface OutboundEmail {
  orgId?: string | null;
  to: string;
  template: EmailTemplateName;
  vars: Record<string, string | number | null | undefined>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeMailValue(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

export function templateDirectory(): string {
  const candidates = [
    path.resolve(process.cwd(), 'packages/contracts/src/templates'),
    path.resolve(process.cwd(), '../../packages/contracts/src/templates'),
    path.resolve(process.cwd(), '../../../packages/contracts/src/templates'),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'candidate-invite.html'))) {
      return candidate;
    }
  }
  return candidates[0]!;
}

export function renderEmail(template: EmailTemplateName, vars: Record<string, string>): { html: string; text: string } {
  const dir = templateDirectory();
  const htmlSource = readFileSync(path.join(dir, `${template}.html`), 'utf8');
  const textSource = readFileSync(path.join(dir, `${template}.txt`), 'utf8');
  const logo = vars.logoUrl ?? '';
  const withLogo = logo
    ? htmlSource
    : htmlSource.replace(/<img\s+src="\{\{logoUrl\}\}"[^>]*>/i, HELLOSMART_MARK);
  const fill = (source: string, escape: boolean) =>
    source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
      const raw = vars[key] ?? '';
      return escape ? escapeHtml(raw) : raw;
    });
  return { html: fill(withLogo, true), text: fill(textSource, false) };
}

export function isPermanentEmailFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /bounce|invalid recipient|mailbox unavailable|user unknown|\b550\b/i.test(message);
}

export function nextEmailDelayMs(attemptsAfterFailure: number): number {
  const index = Math.min(Math.max(attemptsAfterFailure - 1, 0), EMAIL_BACKOFF_MS.length - 1);
  return EMAIL_BACKOFF_MS[index]!;
}

@Injectable()
export class EmailService {
  constructor(@Optional() @Inject(PG_POOL) private readonly pool?: Pool) {}

  render(template: EmailTemplateName, vars: Record<string, string | number | null | undefined>) {
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars)) {
      clean[key] = sanitizeMailValue(value);
    }
    if (!clean.logoUrl) {
      clean.logoUrl = '';
    }
    if (!clean.companyName) {
      clean.companyName = 'HelloSmart';
    }
    return renderEmail(template, clean);
  }

  /**
   * Queues a transactional email. The HTTP request returns as soon as the job row is committed.
   */
  async enqueue(input: OutboundEmail, client?: PoolClient): Promise<{ jobId: string }> {
    const payload = {
      to: sanitizeMailValue(input.to),
      template: input.template,
      vars: Object.fromEntries(
        Object.entries(input.vars).map(([key, value]) => [key, sanitizeMailValue(value)]),
      ),
    };
    const insert = async (tx: PoolClient) => {
      const result = await tx.query<{ id: string }>(
        `INSERT INTO app.jobs (org_id, kind, payload, status, run_after)
         VALUES ($1, 'email', $2::jsonb, 'queued', now())
         RETURNING id`,
        [input.orgId ?? null, JSON.stringify(payload)],
      );
      return result.rows[0]!.id;
    };

    if (client) {
      return { jobId: await insert(client) };
    }
    if (!this.pool) {
      throw new Error('Database is not configured for the email queue');
    }
    const pooled = await this.pool.connect();
    try {
      if (input.orgId) {
        return { jobId: await withOrg(pooled, input.orgId, insert) };
      }
      return { jobId: await withPlatform(pooled, insert) };
    } finally {
      pooled.release();
    }
  }
}
