import crypto from 'node:crypto';
import { Transform, type TransformCallback } from 'node:stream';
import { MAX_FILE_SIZE_BYTES } from './storage.types.js';

export { MAX_FILE_SIZE_BYTES };

export class FileTooLargeException extends Error {
  constructor(message = 'File size exceeds maximum allowed limit of 50MB') {
    super(message);
    this.name = 'FileTooLargeException';
  }
}

export class InvalidFileContentException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFileContentException';
  }
}

/**
 * Validates header magic bytes against the claimed file extension.
 * Decision 5 rules:
 * - zip, docx, xlsx: PK\x03\x04 (rejects .docm, .xlsm macro formats)
 * - tar.gz: 1f 8b
 * - pdf: %PDF-
 * - png: \x89PNG\r\n\x1a\n
 * - jpeg: \xff\xd8\xff
 * - txt, md, csv, json: valid UTF-8, no null bytes (json must also parse)
 */
export function verifyMagicBytes(
  header: Buffer,
  extension: string,
  fullContent?: Buffer,
): { valid: boolean; reason?: string } {
  if (!header || header.length === 0) {
    return { valid: false, reason: 'File content is empty' };
  }

  const ext = extension.toLowerCase();

  switch (ext) {
    case '.zip':
    case '.docx':
    case '.xlsx': {
      if (header.length < 4) {
        return { valid: false, reason: `Insufficient header bytes for ${ext}` };
      }
      const isPkZip =
        header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
      if (!isPkZip) {
        return {
          valid: false,
          reason: `File signature does not match ZIP/Office package header (PK\\x03\\x04)`,
        };
      }
      return { valid: true };
    }

    case '.tar.gz': {
      if (header.length < 2) {
        return { valid: false, reason: 'Insufficient header bytes for .tar.gz' };
      }
      const isGzip = header[0] === 0x1f && header[1] === 0x8b;
      if (!isGzip) {
        return { valid: false, reason: 'File signature does not match gzip header (1f 8b)' };
      }
      return { valid: true };
    }

    case '.pdf': {
      if (header.length < 5) {
        return { valid: false, reason: 'Insufficient header bytes for PDF' };
      }
      const isPdf = header.subarray(0, 5).toString('ascii') === '%PDF-';
      if (!isPdf) {
        return { valid: false, reason: 'File signature does not match PDF header (%PDF-)' };
      }
      return { valid: true };
    }

    case '.png': {
      if (header.length < 8) {
        return { valid: false, reason: 'Insufficient header bytes for PNG' };
      }
      const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const isPng = pngSig.every((byte, idx) => header[idx] === byte);
      if (!isPng) {
        return { valid: false, reason: 'File signature does not match PNG header' };
      }
      return { valid: true };
    }

    case '.jpg':
    case '.jpeg': {
      if (header.length < 3) {
        return { valid: false, reason: 'Insufficient header bytes for JPEG' };
      }
      const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      if (!isJpeg) {
        return { valid: false, reason: 'File signature does not match JPEG header' };
      }
      return { valid: true };
    }

    case '.txt':
    case '.md':
    case '.csv': {
      // Must not contain null bytes and must be valid UTF-8
      const sample = fullContent ?? header;
      if (sample.includes(0x00)) {
        return { valid: false, reason: `Text deliverable (${ext}) contains forbidden null bytes` };
      }
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(sample);
        // Additional check: no control characters other than standard whitespace (\r, \n, \t)
        if (/[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(text)) {
          return {
            valid: false,
            reason: `Text deliverable contains raw binary control characters`,
          };
        }
      } catch {
        return { valid: false, reason: `File is not valid UTF-8 encoded text` };
      }
      return { valid: true };
    }

    case '.json': {
      const sample = fullContent ?? header;
      if (sample.includes(0x00)) {
        return { valid: false, reason: 'JSON file contains forbidden null bytes' };
      }
      let text = '';
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(sample);
      } catch {
        return { valid: false, reason: 'JSON file is not valid UTF-8' };
      }
      if (fullContent) {
        try {
          JSON.parse(text);
        } catch (e: any) {
          return { valid: false, reason: `Malformed JSON: ${e.message}` };
        }
      }
      return { valid: true };
    }

    default:
      return { valid: false, reason: `Unsupported deliverable type: ${ext}` };
  }
}

/**
 * Streaming validator:
 * 1. Tracks byte count and aborts with FileTooLargeException if > 50MB.
 * 2. Checks header magic bytes on the first chunk against expectedExtension.
 * 3. Computes streaming SHA-256 hash.
 */
export class StreamValidationTransform extends Transform {
  private bytesRead = 0;
  private readonly hasher = crypto.createHash('sha256');
  private readonly maxBytes: number;
  private readonly expectedExtension?: string | undefined;
  private headerChecked = false;
  private textChunks: Buffer[] = [];

  constructor(maxBytes = MAX_FILE_SIZE_BYTES, expectedExtension?: string | undefined) {
    super();
    this.maxBytes = maxBytes;
    this.expectedExtension = expectedExtension;
  }

  public getBytesRead(): number {
    return this.bytesRead;
  }

  public getDigest(): string {
    return this.hasher.digest('hex');
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.bytesRead += buf.length;

    if (this.bytesRead > this.maxBytes) {
      const err = new FileTooLargeException(
        `File size limit of ${this.maxBytes} bytes (50MB) exceeded; stream aborted at ${this.bytesRead} bytes.`,
      );
      this.destroy(err);
      return callback(err);
    }

    if (!this.headerChecked && this.expectedExtension) {
      this.headerChecked = true;
      const verify = verifyMagicBytes(buf, this.expectedExtension);
      if (!verify.valid) {
        const err = new InvalidFileContentException(
          verify.reason ||
            `File header signature mismatch for extension '${this.expectedExtension}'`,
        );
        this.destroy(err);
        return callback(err);
      }
    }

    if (
      this.expectedExtension &&
      ['.txt', '.md', '.csv', '.json'].includes(this.expectedExtension.toLowerCase())
    ) {
      if (this.bytesRead <= 5 * 1024 * 1024) {
        this.textChunks.push(buf);
      }
    }

    this.hasher.update(buf);
    this.push(buf);
    callback();
  }

  override _flush(callback: TransformCallback): void {
    if (this.expectedExtension && ['.json'].includes(this.expectedExtension.toLowerCase())) {
      const fullText = Buffer.concat(this.textChunks);
      const verify = verifyMagicBytes(fullText, this.expectedExtension, fullText);
      if (!verify.valid) {
        const err = new InvalidFileContentException(
          verify.reason || `File content validation failed for '${this.expectedExtension}'`,
        );
        this.destroy(err);
        return callback(err);
      }
    }
    callback();
  }
}
