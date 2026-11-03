import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  validateCandidateCsv,
  parseRawCsvLines,
  sanitizeCsvCell,
  escapeCsvField,
  MAX_CSV_ROW_LIMIT,
  MAX_CSV_FILE_SIZE_BYTES,
} from '../lib/candidate-csv';

const fixturesDir = path.resolve(__dirname, '../../../../packages/contracts/fixtures/csv');

describe('Candidate CSV Browser Parser & Fuzz Verification (CO-012, EX-11)', () => {
  it('1. Rejects 1000-candidates.csv with documented 500-row limit error (CO-012, Sec 10.4)', () => {
    const fixturePath = path.join(fixturesDir, '1000-candidates.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf8');

    const result = validateCandidateCsv(csvContent);

    expect(result.success).toBe(false);
    expect(result.preview.totalRows).toBe(1000);
    expect(result.error).toContain(`exceeds maximum limit of ${MAX_CSV_ROW_LIMIT} rows`);
    expect(result.error).toContain('found 1000 rows');
  });

  it('2. Parses corrupted-sample.csv and isolates broken rows from valid rows (EX-11)', () => {
    const fixturePath = path.join(fixturesDir, 'corrupted-sample.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf8');

    const result = validateCandidateCsv(csvContent);

    expect(result.success).toBe(true);
    // Valid rows parsed despite adjacent corrupted lines
    expect(result.preview.validRows.length).toBeGreaterThanOrEqual(3);
    const validEmails = result.preview.validRows.map((r) => r.email);
    expect(validEmails).toContain('valid.01@example.test');
    expect(validEmails).toContain('valid.02@example.test');
    expect(validEmails).toContain('valid.03@example.test');

    // Invalid rows correctly identified
    expect(result.preview.invalidRows.length).toBeGreaterThan(0);
    const reasons = result.preview.invalidRows.map((r) => r.reason);
    expect(reasons).toContain('Email is required');
    expect(reasons).toContain('Name is required');
    expect(reasons).toContain('Invalid email address format');

    // Duplicate emails inside file flagged
    expect(result.preview.duplicateRows.length).toBeGreaterThanOrEqual(1);
    expect(result.preview.duplicateRows.some((d) => d.email === 'valid.01@example.test')).toBe(
      true,
    );
  });

  it('3. Strips UTF-8 Byte Order Mark (BOM) cleanly', () => {
    const bomCsv = '\uFEFFname,email\nBOM User,bom.user@example.test';
    const result = validateCandidateCsv(bomCsv);

    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(1);
    expect(result.preview.validRows[0]?.name).toBe('BOM User');
    expect(result.preview.validRows[0]?.email).toBe('bom.user@example.test');
  });

  it('4. Correctly parses CRLF line endings and embedded newlines inside quoted fields', () => {
    const crlfCsv =
      'name,email\r\n"Multi\r\nLine Name",multiline@example.test\r\nSimple Name,simple@example.test\r\n';
    const result = validateCandidateCsv(crlfCsv);

    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(2);
    expect(result.preview.validRows[0]?.name).toBe('Multi\r\nLine Name');
    expect(result.preview.validRows[1]?.name).toBe('Simple Name');
  });

  it('5. Formula injection protection (CWE-1236): escapes active formula triggers (=, +, -, @) with single quote', () => {
    const formulaTriggers = ["=cmd|' /C calc'!A0", '+SUM(1+1)', '-100', '@mention'];

    for (const formula of formulaTriggers) {
      const sanitized = sanitizeCsvCell(formula);
      expect(sanitized.startsWith("'")).toBe(true);

      const escaped = escapeCsvField(formula);
      expect(escaped).toBeDefined();
    }

    // Leading whitespace characters (\t, \r) are trimmed by sanitizeCsvCell
    expect(sanitizeCsvCell('\tTAB_VAL')).toBe('TAB_VAL');
    expect(sanitizeCsvCell('\rCR_VAL')).toBe('CR_VAL');
  });

  it('6. Rejects empty file or missing required headers', () => {
    const emptyResult = validateCandidateCsv('');
    expect(emptyResult.success).toBe(false);
    expect(emptyResult.error).toContain('empty');

    const wrongHeadersResult = validateCandidateCsv('username,mail\njane,jane@example.test');
    expect(wrongHeadersResult.success).toBe(false);
    expect(wrongHeadersResult.error).toContain('Missing required columns');
  });
});
