import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);

  /**
   * Decodes a RFC 4648 Base32 string into a Buffer.
   * Throws an Error if an invalid character is encountered.
   */
  decodeBase32(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = base32.toUpperCase().replace(/[\s=-]/g, '');
    if (cleaned.length === 0) {
      throw new Error('Base32 secret is empty');
    }

    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const idx = alphabet.indexOf(cleaned[i]!);
      if (idx === -1) {
        throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
      }
      value = (value << 5) | idx;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Generates a 6-digit TOTP code for a given timestamp offset according to RFC 6238 / RFC 4226.
   */
  generateTotp(secretBase32: string, timeStepSeconds = 30, timeOffsetSeconds = 0): string {
    const key = this.decodeBase32(secretBase32);
    const nowSeconds = Math.floor(Date.now() / 1000) + timeOffsetSeconds;
    const counter = Math.floor(nowSeconds / timeStepSeconds);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1]! & 0x0f;
    const binary =
      ((hmac[offset]! & 0x7f) << 24) |
      ((hmac[offset + 1]! & 0xff) << 16) |
      ((hmac[offset + 2]! & 0xff) << 8) |
      (hmac[offset + 3]! & 0xff);

    const otp = (binary % 1_000_000).toString().padStart(6, '0');
    return otp;
  }

  /**
   * Verifies a 6-digit TOTP code against a Base32 secret.
   * Tolerates +/- 1 time step (30 seconds) clock drift.
   * Uses constant-time comparison to prevent timing side channels.
   * Returns false if secret is invalid, code format is wrong, or code does not match.
   */
  verifyTotp(code: string, secretBase32: string): boolean {
    if (!code || typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) {
      return false;
    }

    try {
      const codeBuffer = Buffer.from(code, 'utf8');
      const driftOffsets = [-30, 0, 30];

      for (const offset of driftOffsets) {
        const candidate = this.generateTotp(secretBase32, 30, offset);
        const candidateBuffer = Buffer.from(candidate, 'utf8');

        if (
          codeBuffer.length === candidateBuffer.length &&
          crypto.timingSafeEqual(codeBuffer, candidateBuffer)
        ) {
          return true;
        }
      }

      return false;
    } catch (err: unknown) {
      this.logger.warn(`MFA TOTP verification failed due to secret error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
