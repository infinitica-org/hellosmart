import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  FileTooLargeException,
  InvalidFileContentException,
  MAX_FILE_SIZE_BYTES,
  StreamValidationTransform,
  verifyMagicBytes,
} from '../storage-validation.js';

describe('storage-validation', () => {
  describe('verifyMagicBytes', () => {
    it('validates ZIP, DOCX, and XLSX headers (PK\\x03\\x04)', () => {
      const validZipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(verifyMagicBytes(validZipHeader, '.zip').valid).toBe(true);
      expect(verifyMagicBytes(validZipHeader, '.docx').valid).toBe(true);
      expect(verifyMagicBytes(validZipHeader, '.xlsx').valid).toBe(true);

      const invalidHeader = Buffer.from([0x50, 0x4b, 0x00, 0x00]);
      expect(verifyMagicBytes(invalidHeader, '.zip').valid).toBe(false);
    });

    it('validates gzip/tar.gz headers (1f 8b)', () => {
      const validGzHeader = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
      expect(verifyMagicBytes(validGzHeader, '.tar.gz').valid).toBe(true);

      const invalidGzHeader = Buffer.from([0x1f, 0x00]);
      expect(verifyMagicBytes(invalidGzHeader, '.tar.gz').valid).toBe(false);
    });

    it('validates PDF headers (%PDF-)', () => {
      const validPdf = Buffer.from('%PDF-1.7\n%fake-binary');
      expect(verifyMagicBytes(validPdf, '.pdf').valid).toBe(true);

      const invalidPdf = Buffer.from('NOTPDF-1.7');
      expect(verifyMagicBytes(invalidPdf, '.pdf').valid).toBe(false);
    });

    it('validates PNG 8-byte signature', () => {
      const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      expect(verifyMagicBytes(validPng, '.png').valid).toBe(true);

      const invalidPng = Buffer.from([0x89, 0x50, 0x00]);
      expect(verifyMagicBytes(invalidPng, '.png').valid).toBe(false);
    });

    it('validates JPEG SOI marker (\\xff\\xd8\\xff)', () => {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(verifyMagicBytes(validJpeg, '.jpg').valid).toBe(true);
      expect(verifyMagicBytes(validJpeg, '.jpeg').valid).toBe(true);

      const invalidJpeg = Buffer.from([0xff, 0x00, 0xff]);
      expect(verifyMagicBytes(invalidJpeg, '.jpg').valid).toBe(false);
    });

    it('validates plain text files (.txt, .md, .csv) and rejects null bytes', () => {
      const validText = Buffer.from('Hello world!\nLine 2\tIndent');
      expect(verifyMagicBytes(validText, '.txt').valid).toBe(true);
      expect(verifyMagicBytes(validText, '.md').valid).toBe(true);
      expect(verifyMagicBytes(validText, '.csv').valid).toBe(true);

      const textWithNullByte = Buffer.from('Hello\x00World');
      expect(verifyMagicBytes(textWithNullByte, '.txt').valid).toBe(false);

      const textWithControlChar = Buffer.from('Hello\x03World');
      expect(verifyMagicBytes(textWithControlChar, '.txt').valid).toBe(false);
    });

    it('validates JSON files and rejects malformed syntax', () => {
      const validJson = Buffer.from(JSON.stringify({ score: 100, pass: true }));
      expect(verifyMagicBytes(validJson, '.json', validJson).valid).toBe(true);

      const malformedJson = Buffer.from('{ score: 100,');
      expect(verifyMagicBytes(malformedJson, '.json', malformedJson).valid).toBe(false);
    });
  });

  describe('StreamValidationTransform', () => {
    it('computes streaming SHA-256 digest accurately', async () => {
      const content = Buffer.from('Stream content to hash with sha256!');
      const expectedSha256 = crypto.createHash('sha256').update(content).digest('hex');

      const validator = new StreamValidationTransform(MAX_FILE_SIZE_BYTES);
      const chunks: Buffer[] = [];

      validator.on('data', (chunk) => chunks.push(chunk));
      await pipeline(Readable.from([content]), validator);

      expect(validator.getBytesRead()).toBe(content.length);
      expect(validator.getDigest()).toBe(expectedSha256);
      expect(Buffer.concat(chunks).toString('utf8')).toBe(content.toString('utf8'));
    });

    it('passes exactly 50MB (52,428,800 bytes) without throwing', async () => {
      const chunkSize = 1024 * 1024; // 1 MB
      const totalChunks = 50; // exactly 50 MB
      let sentBytes = 0;

      async function* generate50MB() {
        for (let i = 0; i < totalChunks; i++) {
          const chunk = Buffer.alloc(chunkSize, 0x41);
          sentBytes += chunk.length;
          yield chunk;
        }
      }

      const validator = new StreamValidationTransform(MAX_FILE_SIZE_BYTES);
      validator.resume(); // Consume transform output to prevent backpressure hang
      await pipeline(Readable.from(generate50MB()), validator);

      expect(validator.getBytesRead()).toBe(52_428_800);
      expect(sentBytes).toBe(52_428_800);
    });

    it('aborts stream immediately when 50MB + 1 byte is reached', async () => {
      const chunkSize = 1024 * 1024; // 1 MB
      const totalChunks = 50;

      async function* generate50MBPlus1Byte() {
        for (let i = 0; i < totalChunks; i++) {
          yield Buffer.alloc(chunkSize, 0x41);
        }
        // Exceed limit by 1 single byte
        yield Buffer.alloc(1, 0x42);
      }

      const validator = new StreamValidationTransform(MAX_FILE_SIZE_BYTES);
      validator.resume(); // Consume transform output to prevent backpressure hang

      await expect(pipeline(Readable.from(generate50MBPlus1Byte()), validator)).rejects.toThrow(
        FileTooLargeException,
      );

      expect(validator.getBytesRead()).toBe(52_428_801);
    });

    it('aborts stream on first chunk if magic bytes do not match expectedExtension', async () => {
      const badHeader = Buffer.from('NOT_A_ZIP_HEADER');
      const validator = new StreamValidationTransform(MAX_FILE_SIZE_BYTES, '.zip');

      await expect(pipeline(Readable.from([badHeader]), validator)).rejects.toThrow(
        InvalidFileContentException,
      );
    });
  });
});
