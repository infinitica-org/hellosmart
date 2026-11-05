import { Readable } from 'node:stream';
import { problem } from '../../common/errors/app-http.exception.js';

export interface ParsedCsvRow {
  rowNumber: number;
  name?: string | undefined;
  email?: string | undefined;
  assessmentId?: string | undefined;
  error?: {
    code: string;
    message: string;
    field?: string | undefined;
  } | undefined;
}

export interface CsvStreamParserOptions {
  /** Maximum total bytes allowed in the upload (default: 1 MB) */
  maxBytes?: number;
  /** Maximum bytes permitted for a single CSV row (default: 4 KB) */
  maxRowBytes?: number;
}

const DEFAULT_MAX_BYTES = 1_048_576; // 1 MB
const DEFAULT_MAX_ROW_BYTES = 4_096; // 4 KB
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Registers Fastify content-type parsers for streaming CSV uploads idempotently.
 * Passes the raw stream through to the route handler without accumulating chunks into memory.
 */
export function registerCsvContentTypeParsers(fastify: any): void {
  if (fastify && typeof fastify.addContentTypeParser === 'function') {
    const types = ['text/csv', 'application/csv'];
    for (const t of types) {
      if (!fastify.hasContentTypeParser?.(t)) {
        fastify.addContentTypeParser(
          t,
          function (_req: unknown, payload: unknown, done: (err: Error | null, res?: unknown) => void) {
            done(null, payload);
          },
        );
      }
    }
  }
}

/**
 * Streaming RFC 4180 CSV parser implemented as a deterministic state machine
 * over a Node.js Readable stream.
 *
 * Guarantees:
 * - Operates chunk-by-chunk without buffering the whole file in memory.
 * - Strips UTF-8 BOM if present at byte offset 0.
 * - Handles Windows CRLF (\r\n) and Unix LF (\n) seamlessly across chunk boundaries.
 * - Treats escaped quotes ("") inside quoted fields as literal quotes without toggling quote state.
 * - Disambiguates escaped quotes ("") split across chunk boundaries vs closing quotes.
 * - Supports multiline quoted fields with embedded commas and newlines.
 * - Enforces max total bytes (413 Payload Too Large) and max row bytes (422 Malformed Row).
 * - Validates required 'name' and 'email' headers on line 1.
 * - Validates row-level syntax (name required, email format, field length).
 */
export async function* parseCsvStream(
  stream: Readable,
  options: CsvStreamParserOptions = {},
): AsyncGenerator<ParsedCsvRow, void, unknown> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRowBytes = options.maxRowBytes ?? DEFAULT_MAX_ROW_BYTES;

  let totalBytes = 0;
  let isFirstChunk = true;
  let inQuotes = false;
  let afterQuote = false;
  let pendingQuote = false;
  let fieldStarted = false;
  let rowNumber = 0; // 1-based line counter (row 1 is header)
  let headers: string[] | null = null;
  let nameIndex = -1;
  let emailIndex = -1;
  let assessmentIdIndex = -1;
  let currentRowBytes = 0;
  let currentField = '';
  const currentFields: string[] = [];

  for await (const chunk of stream) {
    const chunkBuf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += chunkBuf.length;

    if (totalBytes > maxBytes) {
      throw problem({
        title: 'Payload Too Large',
        status: 413,
        detail: `The uploaded CSV file exceeds the maximum allowed limit of ${maxBytes} bytes (1MB)`,
        code: 'PAYLOAD_TOO_LARGE',
      });
    }

    let text = chunkBuf.toString('utf8');

    // Strip UTF-8 BOM if present on the very first chunk
    if (isFirstChunk) {
      isFirstChunk = false;
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
    }

    let i = 0;

    // Disambiguate pending quote from the end of the previous chunk
    if (pendingQuote) {
      pendingQuote = false;
      if (text.length > 0 && text[0] === '"') {
        // Escaped quote ("") split across chunk boundaries: emit literal quote and remain inside quotes
        currentField += '"';
        i = 1; // consume the second quote character
      } else {
        // The quote was the closing quote of the quoted field
        inQuotes = false;
        afterQuote = true;
      }
    }

    for (; i < text.length; i++) {
      const char = text[i];
      currentRowBytes++;

      if (currentRowBytes > maxRowBytes) {
        rowNumber++;
        yield {
          rowNumber,
          error: {
            code: 'ROW_TOO_LARGE',
            message: `CSV row ${rowNumber} exceeds maximum permitted row size of ${maxRowBytes} bytes`,
          },
        };
        // Skip ahead until the next newline
        while (i < text.length && text[i] !== '\n') {
          i++;
        }
        currentField = '';
        currentFields.length = 0;
        currentRowBytes = 0;
        inQuotes = false;
        afterQuote = false;
        pendingQuote = false;
        fieldStarted = false;
        continue;
      }

      if (afterQuote) {
        if (char === ',') {
          afterQuote = false;
          fieldStarted = false;
          currentFields.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || char === '\r') {
          afterQuote = false;
          fieldStarted = false;
          currentFields.push(currentField.trim());
          currentField = '';

          if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
            i++;
          }

          rowNumber++;
          currentRowBytes = 0;
          const rowResult = processRow(
            rowNumber,
            currentFields,
            headers,
            nameIndex,
            emailIndex,
            assessmentIdIndex,
          );
          currentFields.length = 0;

          if (rowNumber === 1) {
            headers = rowResult.headers!;
            nameIndex = rowResult.nameIndex!;
            emailIndex = rowResult.emailIndex!;
            assessmentIdIndex = rowResult.assessmentIdIndex!;
          } else if (rowResult.row) {
            yield rowResult.row;
          }
        } else if (char === ' ' || char === '\t') {
          // Trailing whitespace between closing quote and delimiter: ignored per RFC 4180
        } else {
          // Additional characters after quote (tolerant append)
          currentField += char;
        }
      } else if (inQuotes) {
        if (char === '"') {
          if (i + 1 < text.length) {
            if (text[i + 1] === '"') {
              // Escaped quote ("") inside quoted field: append single quote without toggling inQuotes
              currentField += '"';
              i++; // consume the second quote character
              currentRowBytes++;
            } else {
              // Closing quote of the field
              inQuotes = false;
              afterQuote = true;
            }
          } else {
            // Quote at the very end of chunk: defer resolution until the next chunk arrives
            pendingQuote = true;
          }
        } else {
          // All characters inside quotes (including commas, newlines, tabs) are literal
          currentField += char;
        }
      } else {
        // Outside quotes
        if (char === '"') {
          if (!fieldStarted || currentField.trim().length === 0) {
            // Opening quote for quoted field
            inQuotes = true;
            fieldStarted = true;
            currentField = ''; // clear any leading whitespace before opening quote
          } else {
            currentField += char;
          }
        } else if (char === ',') {
          fieldStarted = false;
          currentFields.push(currentField.trim());
          currentField = '';
        } else if (char === '\n' || char === '\r') {
          fieldStarted = false;
          currentFields.push(currentField.trim());
          currentField = '';

          if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
            i++;
          }

          rowNumber++;
          currentRowBytes = 0;
          const rowResult = processRow(
            rowNumber,
            currentFields,
            headers,
            nameIndex,
            emailIndex,
            assessmentIdIndex,
          );
          currentFields.length = 0;

          if (rowNumber === 1) {
            headers = rowResult.headers!;
            nameIndex = rowResult.nameIndex!;
            emailIndex = rowResult.emailIndex!;
            assessmentIdIndex = rowResult.assessmentIdIndex!;
          } else if (rowResult.row) {
            yield rowResult.row;
          }
        } else {
          fieldStarted = true;
          currentField += char;
        }
      }
    }
  }

  // Handle pending quote at EOF if stream ended with a quote
  if (pendingQuote) {
    pendingQuote = false;
    inQuotes = false;
    afterQuote = true;
  }

  // Handle final row if file did not end with a newline
  if (inQuotes) {
    rowNumber++;
    yield {
      rowNumber,
      error: {
        code: 'MALFORMED_CSV_ROW',
        message: `CSV row ${rowNumber} contains an unclosed quotation mark at end of file`,
      },
    };
  } else if (currentField.length > 0 || currentFields.length > 0) {
    currentFields.push(currentField.trim());
    currentField = '';
    rowNumber++;

    if (rowNumber === 1 && !headers) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Uploaded CSV file contains no data rows or missing headers',
        code: 'INVALID_CSV_HEADERS',
      });
    } else if (headers) {
      const rowResult = processRow(
        rowNumber,
        currentFields,
        headers,
        nameIndex,
        emailIndex,
        assessmentIdIndex,
      );
      if (rowResult.row) {
        yield rowResult.row;
      }
    }
  }

  // If no rows were processed at all
  if (rowNumber === 0 || !headers) {
    throw problem({
      title: 'Unprocessable Entity',
      status: 422,
      detail: 'Uploaded CSV file is empty or missing headers',
      code: 'INVALID_CSV_HEADERS',
    });
  }
}

interface ProcessRowResult {
  headers?: string[];
  nameIndex?: number;
  emailIndex?: number;
  assessmentIdIndex?: number;
  row?: ParsedCsvRow;
}

function processRow(
  rowNumber: number,
  fields: string[],
  headers: string[] | null,
  nameIndex: number,
  emailIndex: number,
  assessmentIdIndex: number,
): ProcessRowResult {
  // Empty line check (e.g. trailing newlines at end of file)
  const isAllBlank = fields.every((f) => f.length === 0);
  if (isAllBlank) {
    return {};
  }

  if (rowNumber === 1) {
    // Process and validate header row
    const normalizedHeaders = fields.map((h) => h.toLowerCase().trim());
    const nIdx = normalizedHeaders.indexOf('name');
    const eIdx = normalizedHeaders.indexOf('email');
    const aIdx = normalizedHeaders.indexOf('assessment_id');

    if (nIdx === -1 || eIdx === -1) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `CSV headers must include 'name' and 'email' columns. Found: [${fields.join(', ')}]`,
        code: 'INVALID_CSV_HEADERS',
      });
    }

    return {
      headers: normalizedHeaders,
      nameIndex: nIdx,
      emailIndex: eIdx,
      assessmentIdIndex: aIdx,
    };
  }

  // Data row validation
  const rawName = nameIndex >= 0 && nameIndex < fields.length ? fields[nameIndex]?.trim() : '';
  const rawEmail = emailIndex >= 0 && emailIndex < fields.length ? fields[emailIndex]?.trim() : '';
  const rawAssessmentId =
    assessmentIdIndex >= 0 && assessmentIdIndex < fields.length
      ? fields[assessmentIdIndex]?.trim()
      : undefined;

  // 1. Missing name
  if (!rawName || rawName.length === 0) {
    return {
      row: {
        rowNumber,
        error: {
          code: 'REQUIRED_FIELD_MISSING',
          field: 'name',
          message: `Row ${rowNumber}: Candidate name is required and cannot be empty`,
        },
      },
    };
  }

  // 2. Name too long
  if (rawName.length > 120) {
    return {
      row: {
        rowNumber,
        error: {
          code: 'FIELD_TOO_LONG',
          field: 'name',
          message: `Row ${rowNumber}: Candidate name exceeds maximum length of 120 characters`,
        },
      },
    };
  }

  // 3. Missing email
  if (!rawEmail || rawEmail.length === 0) {
    return {
      row: {
        rowNumber,
        error: {
          code: 'REQUIRED_FIELD_MISSING',
          field: 'email',
          message: `Row ${rowNumber}: Candidate email is required and cannot be empty`,
        },
      },
    };
  }

  // 4. Email format & length
  if (rawEmail.length > 254 || !EMAIL_REGEX.test(rawEmail)) {
    return {
      row: {
        rowNumber,
        error: {
          code: 'INVALID_EMAIL_FORMAT',
          field: 'email',
          message: `Row ${rowNumber}: '${rawEmail}' is not a valid email address`,
        },
      },
    };
  }

  return {
    row: {
      rowNumber,
      name: rawName,
      email: rawEmail.toLowerCase(),
      assessmentId: rawAssessmentId || undefined,
    },
  };
}
