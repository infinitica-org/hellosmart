import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

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

export interface Argon2Engine {
  hash(
    plain: string | Uint8Array,
    options?: {
      memoryCost?: number;
      timeCost?: number;
      parallelism?: number;
      outputLen?: number;
      algorithm?: number; // 2 = Argon2id
    },
  ): Promise<string>;
  verify(hash: string, plain: string | Uint8Array): Promise<boolean>;
}

export const ARGON2_ENGINE = 'ARGON2_ENGINE';

@Injectable()
export class HasherService {
  private readonly logger = new Logger(HasherService.name);
  private argon2Engine: Argon2Engine | null = null;
  private loadAttempted = false;

  constructor(@Optional() @Inject(ARGON2_ENGINE) customEngine?: Argon2Engine) {
    if (customEngine) {
      this.argon2Engine = customEngine;
      this.loadAttempted = true;
    }
  }

  private async getArgon2(): Promise<Argon2Engine> {
    if (!this.loadAttempted) {
      this.loadAttempted = true;
      try {
        const mod = await import('@node-rs/argon2');
        this.argon2Engine = mod;
      } catch (err: unknown) {
        this.logger.error(
          `Argon2id native engine failed to initialize: ${err instanceof Error ? err.message : String(err)}`,
        );
        this.argon2Engine = null;
      }
    }

    if (!this.argon2Engine) {
      throw new Error(
        'Argon2id hashing engine is unavailable. Refusing to hash or verify password with insecure fallback.',
      );
    }

    return this.argon2Engine;
  }

  /**
   * Hashes a plaintext password using Argon2id with project standard parameters:
   * memoryCost: 19456 (19 MiB), timeCost: 2, parallelism: 1.
   *
   * STRICT SECURITY INVARIANT:
   * No fallback hashing algorithms (e.g. scrypt, sha256, bcrypt) are permitted.
   * If the Argon2id engine is unavailable or uninitialized, this method throws immediately.
   */
  async hashPassword(
    password: string,
    params: Argon2Parameters = DEFAULT_ARGON2_PARAMS,
  ): Promise<string> {
    const argon2 = await this.getArgon2();
    return argon2.hash(password, {
      memoryCost: params.memoryCost,
      timeCost: params.timeCost,
      outputLen: 32,
      parallelism: params.parallelism,
      algorithm: 2, // 2 = Argon2id
    });
  }

  /**
   * Verifies a plaintext password against an existing hash string using Argon2id.
   * Refuses any non-Argon2 hash formats.
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    if (!hash || !hash.startsWith('$argon2id$')) {
      return false;
    }

    const argon2 = await this.getArgon2();
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
