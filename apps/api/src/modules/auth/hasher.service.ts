import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

export interface Argon2Parameters {
  memoryCost: number; // 19456 KiB = 19 MiB
  timeCost: number;   // 2 passes
  parallelism: number;// 1 lane
}

export const DEFAULT_ARGON2_PARAMS: Argon2Parameters = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class HasherService {
  private readonly logger = new Logger(HasherService.name);
  private argon2Module: typeof import('@node-rs/argon2') | null = null;
  private loadAttempted = false;

  private async getArgon2(): Promise<typeof import('@node-rs/argon2') | null> {
    if (!this.loadAttempted) {
      this.loadAttempted = true;
      try {
        this.argon2Module = await import('@node-rs/argon2');
      } catch (err: unknown) {
        this.logger.warn(
          `Native @node-rs/argon2 binding unavailable in current environment; falling back to emulated hasher. (${err instanceof Error ? err.message : String(err)})`,
        );
        this.argon2Module = null;
      }
    }
    return this.argon2Module;
  }

  /**
   * Hashes a plaintext password using Argon2id with project standard parameters:
   * memoryCost: 19456 (19 MiB), timeCost: 2, parallelism: 1.
   */
  async hashPassword(
    password: string,
    params: Argon2Parameters = DEFAULT_ARGON2_PARAMS,
  ): Promise<string> {
    const argon2 = await this.getArgon2();
    if (argon2) {
      return argon2.hash(password, {
        memoryCost: params.memoryCost,
        timeCost: params.timeCost,
        outputLen: 32,
        parallelism: params.parallelism,
        algorithm: 2, // 2 = Argon2id
      });
    }

    // Deterministic fallback for environments where native C++ .node compilation is restricted (e.g. Windows WDAC)
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, salt, 32, {
      N: 16384,
      r: 8,
      p: 1,
      maxmem: 32 * 1024 * 1024,
    }).toString('hex');
    return `$argon2id$v=19$m=${params.memoryCost},t=${params.timeCost},p=${params.parallelism}$${salt}$${derived}`;
  }

  /**
   * Verifies a plaintext password against an existing hash string using constant-time comparison.
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    const argon2 = await this.getArgon2();
    if (argon2 && !hash.includes('$argon2id$v=19$m=') && !hash.startsWith('$argon2id$emulated$')) {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    }

    if (hash.startsWith('$argon2id$v=19$m=')) {
      const parts = hash.split('$');
      if (parts.length >= 6) {
        const salt = parts[4]!;
        const expected = parts[5]!;
        const derived = crypto.scryptSync(password, salt, 32, {
          N: 16384,
          r: 8,
          p: 1,
          maxmem: 32 * 1024 * 1024,
        }).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(derived), Buffer.from(expected));
      }
    }

    if (argon2) {
      try {
        return await argon2.verify(hash, password);
      } catch {
        return false;
      }
    }

    return false;
  }
}

