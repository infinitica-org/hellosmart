import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL, type PgPool } from '../../database/database.tokens.js';
import type { ModelTokenUsage } from '../workspace-telemetry.types.js';

export const TOKEN_USAGE_PORT = Symbol('TOKEN_USAGE_PORT');

export interface TokenUsagePort {
  /**
   * Retrieves aggregated prompt and completion tokens grouped by model for a workspace session.
   */
  getTokenUsageByWorkspace(workspaceId: string): Promise<ModelTokenUsage[]>;
}

/**
 * Production adapter for TokenUsagePort querying app.ai_messages.
 * NOTE: app.ai_messages table is created by the AI Proxy service migration (Stream 10).
 * If the table does not exist, queries will fail gracefully and return empty token metrics.
 */
@Injectable()
export class PgTokenUsageAdapter implements TokenUsagePort {
  private readonly logger = new Logger(PgTokenUsageAdapter.name);

  constructor(@Inject(PG_POOL) private readonly pool: PgPool) {}

  async getTokenUsageByWorkspace(workspaceId: string): Promise<ModelTokenUsage[]> {
    try {
      const res = await this.pool.query<{
        model: string;
        prompt_tokens: string;
        completion_tokens: string;
      }>(
        `SELECT model,
                COALESCE(SUM(tokens_in), 0)::text AS prompt_tokens,
                COALESCE(SUM(tokens_out), 0)::text AS completion_tokens
           FROM app.ai_messages
          WHERE workspace_id = $1
          GROUP BY model
          ORDER BY model ASC`,
        [workspaceId],
      );

      return res.rows.map((row) => ({
        model: row.model,
        promptTokens: BigInt(row.prompt_tokens),
        completionTokens: BigInt(row.completion_tokens),
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('relation "app.ai_messages" does not exist')) {
        this.logger.debug(
          `app.ai_messages does not exist yet (blocked on AI proxy migration); returning 0 tokens for ws ${workspaceId}`,
        );
        return [];
      }
      this.logger.error(`Failed to query token usage for workspace ${workspaceId}: ${msg}`);
      throw err;
    }
  }
}

/**
 * In-memory fake adapter for unit and integration testing.
 */
export class FakeTokenUsageAdapter implements TokenUsagePort {
  private readonly tokenMap = new Map<string, ModelTokenUsage[]>();

  public setWorkspaceTokens(workspaceId: string, usage: ModelTokenUsage[]): void {
    this.tokenMap.set(workspaceId, [...usage]);
  }

  public clear(): void {
    this.tokenMap.clear();
  }

  async getTokenUsageByWorkspace(workspaceId: string): Promise<ModelTokenUsage[]> {
    return this.tokenMap.get(workspaceId) ?? [];
  }
}
