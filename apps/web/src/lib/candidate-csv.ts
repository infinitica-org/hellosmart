import { z } from 'zod';
import { LIMITS } from '@/constants';
import type { BulkCandidateError, CsvValidationPreview } from '../components/company/candidates/types';

export const MAX_CSV_ROW_LIMIT = LIMITS.CSV.MAX_ROWS;
export const MAX_CSV_FILE_SIZE_BYTES = LIMITS.CSV.MAX_SIZE_BYTES;

const emailSchema = z.string().email().max(254);
const nameSchema = z.string().min(1).max(120);

/**
 * Sanitizes a cell value to prevent formula injection in spreadsheet applications (CWE-1236).
 */
export function sanitizeCsvCell(value: string): string {
  const trimmed = value.trim();
  if (/^[=+@\-\t\r]/.test(trimmed)) {
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Escapes a cell value for standard CSV RFC 4180 output.
 */
export function escapeCsvField(field: string): string {
  const sanitized = sanitizeCsvCell(field);
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

/**
 * Generates a sample CSV template for candidate bulk upload.
 */
export function generateSampleCsvTemplate(): string {
  return [
    'name,email',
    'Jane Doe,jane.doe@example.com',
    'John Smith,john.smith@example.com',
    'Alex Morgan,alex.morgan@example.com',
  ].join('\n');
}

/**
 * Exports validation or import errors to a downloadable CSV string.
 */
export function exportErrorsToCsv(errors: BulkCandidateError[]): string {
  const headers = ['Row Number', 'Name', 'Email', 'Error Reason'];
  const rows = errors.map((err) => [
    err.rowNumber.toString(),
    escapeCsvField(err.name),
    escapeCsvField(err.email),
    escapeCsvField(err.reason),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  return `\uFEFF${csvContent}`; // UTF-8 BOM for Microsoft Excel compatibility
}

/**
 * Parses raw CSV text into line arrays handling quoted fields and CRLF/LF linebreaks.
 */
export function parseRawCsvLines(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let index = 0;

  // Remove optional UTF-8 BOM
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

  while (index < text.length) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          index += 2;
          continue;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          index++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    index++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Filter out empty rows (all fields whitespace)
  return rows.filter((row) => row.some((field) => field.trim().length > 0));
}

export interface CsvParseOptions {
  existingEmails?: Set<string> | undefined;
}

/**
 * Parses and validates candidate CSV content.
 */
export function validateCandidateCsv(
  csvText: string,
  options?: CsvParseOptions,
): {
  success: boolean;
  preview: CsvValidationPreview;
  error?: string;
} {
  const rows = parseRawCsvLines(csvText);

  if (rows.length === 0) {
    return {
      success: false,
      preview: { validRows: [], invalidRows: [], duplicateRows: [], totalRows: 0 },
      error: 'The uploaded CSV file is empty.',
    };
  }

  const headerRow = rows[0];
  if (!headerRow || headerRow.length < 2) {
    return {
      success: false,
      preview: { validRows: [], invalidRows: [], duplicateRows: [], totalRows: 0 },
      error: 'CSV must contain at least "name" and "email" headers.',
    };
  }

  const normalizedHeaders = headerRow.map((h) => h.trim().toLowerCase());
  const nameIndex = normalizedHeaders.findIndex((h) => h === 'name' || h === 'candidate name');
  const emailIndex = normalizedHeaders.findIndex((h) => h === 'email' || h === 'candidate email');

  if (nameIndex === -1 || emailIndex === -1) {
    return {
      success: false,
      preview: { validRows: [], invalidRows: [], duplicateRows: [], totalRows: 0 },
      error: 'Missing required columns. Please include "name" and "email" in the header row.',
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_CSV_ROW_LIMIT) {
    return {
      success: false,
      preview: { validRows: [], invalidRows: [], duplicateRows: [], totalRows: dataRows.length },
      error: `File exceeds maximum limit of ${MAX_CSV_ROW_LIMIT} rows (found ${dataRows.length} rows).`,
    };
  }

  const validRows: Array<{ rowNumber: number; name: string; email: string }> = [];
  const invalidRows: BulkCandidateError[] = [];
  const duplicateRows: BulkCandidateError[] = [];
  const seenEmailsInFile = new Set<string>();

  dataRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // 1-based, row 1 is header
    const rawName = row[nameIndex] ?? '';
    const rawEmail = row[emailIndex] ?? '';

    const name = rawName.trim();
    const email = rawEmail.trim().toLowerCase();

    // Validate name
    const nameResult = nameSchema.safeParse(name);
    if (!nameResult.success) {
      invalidRows.push({
        rowNumber,
        name: rawName,
        email: rawEmail,
        reason: name.length === 0 ? 'Name is required' : 'Name exceeds maximum length of 120 characters',
      });
      return;
    }

    // Validate email
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      invalidRows.push({
        rowNumber,
        name,
        email: rawEmail,
        reason: email.length === 0 ? 'Email is required' : 'Invalid email address format',
      });
      return;
    }

    // Check duplicate in file
    if (seenEmailsInFile.has(email)) {
      duplicateRows.push({
        rowNumber,
        name,
        email,
        reason: 'Duplicate email in uploaded file',
      });
      return;
    }
    seenEmailsInFile.add(email);

    // Check duplicate against existing org candidates
    if (options?.existingEmails?.has(email)) {
      duplicateRows.push({
        rowNumber,
        name,
        email,
        reason: 'Candidate already exists in organization',
      });
      return;
    }

    validRows.push({
      rowNumber,
      name,
      email,
    });
  });

  return {
    success: true,
    preview: {
      validRows,
      invalidRows,
      duplicateRows,
      totalRows: dataRows.length,
    },
  };
}
