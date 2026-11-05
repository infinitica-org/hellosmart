import { describe, it, expect } from 'vitest';
import {
  validateCandidateCsv,
  parseRawCsvLines,
  sanitizeCsvCell,
  escapeCsvField,
  generateSampleCsvTemplate,
  exportErrorsToCsv,
  MAX_CSV_ROW_LIMIT,
} from '../lib/candidate-csv';

describe('Candidate CSV Utility & Parsing (CO-012, EX-11)', () => {
  it('parses a standard valid CSV with name and email headers', () => {
    const csv = `name,email\nJane Doe,jane.doe@example.com\nJohn Smith,john.smith@example.com`;
    const result = validateCandidateCsv(csv);

    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(2);
    expect(result.preview.invalidRows).toHaveLength(0);
    expect(result.preview.duplicateRows).toHaveLength(0);
    expect(result.preview.validRows[0]).toEqual({
      rowNumber: 2,
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
    });
    expect(result.preview.validRows[1]).toEqual({
      rowNumber: 3,
      name: 'John Smith',
      email: 'john.smith@example.com',
    });
  });

  it('normalizes case-insensitive headers like "Candidate Name" and "Candidate Email"', () => {
    const csv = `Candidate Name,Candidate Email\nAlice Walker,alice@example.com`;
    const result = validateCandidateCsv(csv);

    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(1);
    expect(result.preview.validRows[0]?.name).toBe('Alice Walker');
    expect(result.preview.validRows[0]?.email).toBe('alice@example.com');
  });

  it('returns failure when CSV is completely empty', () => {
    const result = validateCandidateCsv('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('empty');
  });

  it('returns failure when required columns are missing', () => {
    const csv = `first_name,last_name\nJane,Doe`;
    const result = validateCandidateCsv(csv);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required columns');
  });

  it('enforces maximum 500 rows limit', () => {
    const header = 'name,email\n';
    const rows = Array.from({ length: 501 }, (_, i) => `User ${i},user${i}@example.com`).join('\n');
    const result = validateCandidateCsv(header + rows);

    expect(result.success).toBe(false);
    expect(result.error).toContain(`exceeds maximum limit of ${MAX_CSV_ROW_LIMIT} rows`);
  });

  it('identifies invalid rows (malformed email, missing name)', () => {
    const csv = [
      'name,email',
      'Valid User,valid@example.com',
      ',missingname@example.com',
      'Invalid Email,not-an-email',
      '   ,   ',
    ].join('\n');

    const result = validateCandidateCsv(csv);
    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(1);
    expect(result.preview.invalidRows).toHaveLength(2);

    expect(result.preview.invalidRows[0]?.reason).toContain('Name is required');
    expect(result.preview.invalidRows[1]?.reason).toContain('Invalid email');
  });

  it('detects duplicate emails inside the uploaded CSV file', () => {
    const csv = [
      'name,email',
      'User One,duplicate@example.com',
      'User Two,DUPLICATE@example.com',
    ].join('\n');

    const result = validateCandidateCsv(csv);
    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(1);
    expect(result.preview.duplicateRows).toHaveLength(1);
    expect(result.preview.duplicateRows[0]?.reason).toContain('Duplicate email in uploaded file');
  });

  it('detects duplicate emails against existing organization candidates', () => {
    const existing = new Set(['existing@company.com']);
    const csv = [
      'name,email',
      'Existing User,existing@company.com',
      'Fresh User,fresh@company.com',
    ].join('\n');

    const result = validateCandidateCsv(csv, { existingEmails: existing });
    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(1);
    expect(result.preview.validRows[0]?.email).toBe('fresh@company.com');
    expect(result.preview.duplicateRows).toHaveLength(1);
    expect(result.preview.duplicateRows[0]?.reason).toContain('already exists in organization');
  });

  it('handles UTF-8 BOM smoothly without corrupting header keys', () => {
    const csvWithBom = `\uFEFFname,email\nBob Marley,bob@example.com`;
    const result = validateCandidateCsv(csvWithBom);

    expect(result.success).toBe(true);
    expect(result.preview.validRows).toHaveLength(1);
    expect(result.preview.validRows[0]?.name).toBe('Bob Marley');
  });

  it('handles quoted fields with commas and carriage returns (RFC 4180)', () => {
    const csv = `name,email\r\n"Doe, Jane",jane.doe@example.com\r\n"Smith, John",john.smith@example.com\r\n`;
    const lines = parseRawCsvLines(csv);

    expect(lines).toHaveLength(3);
    expect(lines[1]?.[0]).toBe('Doe, Jane');
    expect(lines[2]?.[0]).toBe('Smith, John');
  });

  it('sanitizes cells to protect against CSV formula injection (CWE-1236)', () => {
    expect(sanitizeCsvCell('=1+1')).toBe(`'=1+1`);
    expect(sanitizeCsvCell('+cmd|')).toBe(`'+cmd|`);
    expect(sanitizeCsvCell('-5')).toBe(`'-5`);
    expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe(`'@SUM(A1:A10)`);
    expect(sanitizeCsvCell('Normal Name')).toBe('Normal Name');
  });

  it('generates a valid sample CSV template', () => {
    const sample = generateSampleCsvTemplate();
    const result = validateCandidateCsv(sample);

    expect(result.success).toBe(true);
    expect(result.preview.validRows.length).toBeGreaterThanOrEqual(3);
  });

  it('exports errors to an Excel-compatible CSV with UTF-8 BOM', () => {
    const errors = [
      { rowNumber: 3, name: 'Invalid User', email: 'bad-email', reason: 'Invalid email address format' },
      { rowNumber: 5, name: '=FormulaUser', email: 'test@example.com', reason: 'Duplicate' },
    ];

    const csvOutput = exportErrorsToCsv(errors);
    expect(csvOutput.startsWith('\uFEFFRow Number,Name,Email,Error Reason')).toBe(true);
    expect(csvOutput).toContain(`3,Invalid User,bad-email,Invalid email address format`);
    expect(csvOutput).toContain(`5,'=FormulaUser,test@example.com,Duplicate`);
  });
});

