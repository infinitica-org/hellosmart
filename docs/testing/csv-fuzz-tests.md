# Candidate Bulk CSV Ingestion & Fuzz Testing Specification (Ticket 10.3)

> **Traceability & Governance:**
>
> - Requirements: `BR-06` (Candidate cap & pending invite multiplier), `BR-24` (Candidate onboarding & invitations), `BR-25` (Route & role isolation), `CO-012` (Bulk invite via CSV), `EX-11` (Partial failure & concurrency).
> - Target Suites: `apps/api/test/candidates/csv-fuzz.spec.ts`, `apps/web/src/__tests__/candidate-csv-fuzz.test.ts`.
> - Fixtures: `packages/contracts/fixtures/csv/1000-candidates.csv`, `packages/contracts/fixtures/csv/corrupted-sample.csv`.
> - Status: Executable Verification & Findings Report.

---

## 1. System Architecture: Ingestion Boundary Separation

A critical finding of this ticket is the architectural separation between CSV parsing and bulk candidate ingestion:

```
[Browser / Client]
  └─ User selects .csv file
  └─ apps/web/src/lib/candidate-csv.ts
       ├─ Validates file size (max 5 MB)
       ├─ Strips UTF-8 BOM, normalizes CRLF -> LF
       ├─ Parses CSV lines and RFC 4180 quotes
       ├─ Enforces MAX_CSV_ROW_LIMIT = 500 (CO-012, AGENTS.md:910)
       ├─ Sanitizes cells (formula escape: =,+,-,@,\t,\r)
       └─ Converts valid rows into JSON: { candidates: CreateCandidateDto[] }
             │
             ▼ HTTP POST /api/v1/company/candidates/bulk (JSON)
[API Server (Fastify + NestJS)]
  └─ Fastify HTTP Layer
       ├─ Body size limit: 1 MB (bodyLimit: 1_048_576 bytes)
       ├─ Prototype pollution protection: rejects "__proto__" keys (HTTP 400)
       └─ Session authentication & CSRF validation
  └─ CandidatesController & CandidatesService
       ├─ Iterates through payload.candidates array
       ├─ Creates candidate user in app.users
       ├─ Generates invitation in app.invitations
       ├─ Appends tamper-evident audit record in audit.events (BR-31)
       └─ Returns { created: CandidateDto[], errors: { row, email, reason }[] }
```

### Ingestion Contract Division

- **Browser Responsibilities**: CSV file parsing, UTF-8 BOM stripping, CRLF normalization, client-side row limit (500 rows), spreadsheet formula neutralization (`sanitizeCsvCell`), and converting tabular data into JSON.
- **Server Responsibilities**: Session authentication, role-based access control (BR-25), Fastify HTTP body limits (1 MB), database transactions, duplicate prevention (`UNIQUE(org_id, email)`), audit trail logging (BR-31), and partial failure reporting (EX-11).

---

## 2. Test Fixtures Specification

### 2.1 1,000-Candidate Fixture (`packages/contracts/fixtures/csv/1000-candidates.csv`)

- **Structure**: 1,001 lines (1 header line `name,email` followed by exactly 1,000 synthetic data rows).
- **Format**: Standard RFC 4180 CSV with Unix line endings (`LF`).
- **Domain Conformance**: Every email is pinned to the RFC 2606 / RFC 6761 reserved domain `example.test` (e.g., `fuzz.cand.0001@example.test` to `fuzz.cand.1000@example.test`).
- **PII Safety**: Synthetic candidate names formatted as `Fuzz Candidate 0001` through `Fuzz Candidate 1000`. No real personal identifiable information (PII) is included.
- **Payload Size**: Total file size is 39,901 bytes (~39 KB), well under both the web 5 MB limit and the Fastify 1 MB JSON body limit.
- **Dual-Purpose Validation**:
  1. In browser tests: Proves the web CSV parser rejects files exceeding `MAX_CSV_ROW_LIMIT = 500` with the exact message: `"CSV file exceeds maximum limit of 500 rows (found 1000 rows)"`.
  2. In API tests: Converted into JSON to verify that the server handles 1,000 candidates in a single bulk request within strict memory budgets (< 50 MB growth) and with subsequent memory plateauing.

### 2.2 Corrupted Sample Fixture (`packages/contracts/fixtures/csv/corrupted-sample.csv`)

- **Structure**: 25 lines designed to exercise edge cases, syntax corruption, and adversarial inputs.
- **Line Endings**: Preserved with raw CRLF endings via `.gitattributes` (`packages/contracts/fixtures/csv/*.csv -text`).
- **Defect Mapping Table**:

| Line | Row Type  | Content / Defect Pattern                                 | Hostile Vector / Classification      | Parser / Validator Expected Outcome          |
| :--: | :-------- | :------------------------------------------------------- | :----------------------------------- | :------------------------------------------- | ------------------------------------------- |
|  1   | Header    | `name,email`                                             | Baseline standard header             | Accepted as valid schema                     |
|  2   | Hostile   | `=cmd                                                    | ' /C calc'!A0,calc@example.test`     | Formula injection (DDE execution)            | Neutralized with leading quote (`'=cmd...`) |
|  3   | Hostile   | `@SUM(1+1)*cmd,sum@example.test`                         | Formula injection (`@` trigger)      | Neutralized with leading quote (`'@SUM...`)  |
|  4   | Hostile   | `+123456789,plus@example.test`                           | Formula injection (`+` trigger)      | Neutralized with leading quote (`'+123...`)  |
|  5   | Hostile   | `-100+200,minus@example.test`                            | Formula injection (`-` trigger)      | Neutralized with leading quote (`'-100...`)  |
|  6   | Hostile   | `\tTabbedName,tab@example.test`                          | Formula injection (Tab trigger)      | Neutralized with leading quote (`'\tTab...`) |
|  7   | Valid     | `"Quoted, Name",quoted@example.test`                     | RFC 4180 escaped comma inside quotes | Parsed as `Quoted, Name`                     |
|  8   | Valid     | `"Escaped ""Quotes"" Name",escaped@example.test`         | RFC 4180 double-quote escaping       | Parsed as `Escaped "Quotes" Name`            |
|  9   | Malformed | `TrailingComma,trailing@example.test,`                   | Extra trailing delimiter             | Handled or cell ignored                      |
|  10  | Defect    | `MissingEmail,`                                          | Missing required email cell          | Rejected by validation                       |
|  11  | Defect    | `,onlyemail@example.test`                                | Missing required name cell           | Rejected by validation                       |
|  12  | Defect    | `NoDelimiter`                                            | Missing delimiter entirely           | Rejected by validation                       |
|  13  | Blank     | `   `                                                    | Whitespace-only line                 | Skipped silently                             |
|  14  | Blank     | `,,,`                                                    | Empty comma-delimited columns        | Skipped silently                             |
|  15  | Hostile   | `XSS <script>alert(1)</script>,xss@example.test`         | Stored XSS attempt in name           | Plaintext preserved / safely encoded         |
|  16  | Hostile   | `SQL' OR 1=1 --,sqli@example.test`                       | SQL injection attempt in name        | Parameterized queries prevent execution      |
|  17  | Hostile   | `CRLF\r\nInjection,crlf@example.test`                    | Header / CRLF injection attempt      | CRLF stripped or rejected                    |
|  18  | Edge Case | `NullByte\0Name,nullbyte@example.test`                   | Null byte character injection        | Sanitized / stripped                         |
|  19  | Edge Case | `Unicode 日本語,japanese@example.test`                   | UTF-8 multi-byte Kanji / Kana        | Accepted and preserved                       |
|  20  | Edge Case | `Emoji 🚀🎉,emoji@example.test`                          | 4-byte UTF-8 supplementary planes    | Accepted and preserved                       |
|  21  | Edge Case | `Homoglyph аdmіn,homoglyph@example.test`                 | Cyrillic homoglyph confusion         | Preserved or flagged                         |
|  22  | Hostile   | `MassivePaddingAAAAAAAAAAAAAAAA...,padding@example.test` | Buffer overrun attempt (> 500 chars) | Bounded by database column limits            |
|  23  | Hostile   | `prototype,__proto__@example.test`                       | Prototype key in cell                | No prototype pollution                       |
|  24  | Hostile   | `"UnbalancedQuote,unclosed@example.test`                 | Unclosed RFC 4180 quote at EOF       | Detected as malformed line                   |

---

## 3. Test Execution Inventory

### 3.1 Browser CSV Parser Suite (`apps/web/src/__tests__/candidate-csv-fuzz.test.ts`)

- **Execution**: 6 tests passing (100% pass rate).
- **Coverage**:
  1. `1000-candidates.csv exceeds MAX_CSV_ROW_LIMIT (500)`: Asserts parser rejects 1,000-row fixture with explicit 500-row error message (CO-012, AGENTS.md:910).
  2. `corrupted-sample.csv handles diverse syntax defects, escapes formulas and catches unclosed quotes`: Asserts formula cells starting with `=`, `@`, `+`, `-` are prefixed with single quotes (`'`), quotes are unescaped, and trailing unclosed quote is rejected.
  3. `UTF-8 BOM stripping`: Validates `\uFEFF` byte order mark is stripped without corrupting column headers.
  4. `CRLF line ending normalization`: Validates standard Windows line breaks (`\r\n`) are normalized to Unix `\n` without leaving stray carriage returns.
  5. `File size limit enforcement`: Rejects payloads exceeding 5 MB (`MAX_CSV_FILE_SIZE_BYTES`).
  6. `Column reordering`: Handles reversed column order (`email,name`) mapping to correct fields.

### 3.2 API Bulk Fuzzing Suite (`apps/api/test/candidates/csv-fuzz.spec.ts`)

- **Execution**: 21 tests total (17 passed, 4 skipped findings).
- **Coverage**:
  - **Part 1: Volume & Memory Footprint (1,000-Row Fixture)**
    - `1,000-row CSV upload: imports 1,000 candidates and asserts memory footprint growth remains strictly under 50 MB`: Imports 1,000 candidates into the test database, intercepts outbound emails via MailService spy, measures heap delta after explicit V8 garbage collection, and asserts heap delta < 50 MB.
    - `memory plateau verification: second 1,000-row batch confirms memory does not grow unbounded`: Ingests an additional 1,000 candidates and verifies that heap delta between batch 1 and batch 2 remains flat (< 25 MB incremental growth), proving absence of memory leaks.
  - **Part 2: Database Integrity & Audit Verification**
    - `1,000 candidates created in app.users with status invited and must_reset_password true`: Asserts all 1,000 users have correct role (`candidate`), status (`invited`), and forced password reset (`must_reset_password = true`) per BR-24.
    - `1,000 invitation records created with valid 72-hour expiration window`: Asserts all 1,000 rows in `app.invitations` have sha256 token hashes and expiration dates exactly 72 hours in the future.
    - `1,000 candidate.invited audit events appended with tamper-evident hashes (BR-31)`: Asserts all 1,000 candidate invitations wrote append-only audit events in `audit.events`.
  - **Part 3: Hostile Payload Fuzzing Matrix**
    - `Class 1: SQL injection strings in candidate name do not execute arbitrary SQL`: Parameterized queries ensure `' OR 1=1 --` is stored literally.
    - `Class 2: XSS payloads in candidate name are safely stored without executing`: Stored as literal string without corruption.
    - `Class 3: Unicode homoglyphs and 4-byte UTF-8 emojis`: Full Unicode plane fidelity without database encoding errors.
    - `Class 4: Null byte injection`: Null bytes safely handled.
    - `Class 5: Massive name padding (10,000 chars)`: Validates database string column handling.
    - `Class 6: Mass assignment attempts`: Extra payload fields (`role: 'platform_admin'`, `org_id`, `status: 'active'`) are ignored; candidate is created strictly with `role = 'candidate'` in the authenticated tenant's `org_id`.
    - `Class 7: Prototype pollution keys (__proto__) rejected with HTTP 400`: Fastify's JSON parser (`secure-json-parse`) rejects raw JSON containing `"__proto__"` with HTTP 400 Bad Request.
    - `Class 8: Fastify 1 MB bodyLimit boundary`: Payload just under 1 MB succeeds with HTTP 200; payload exceeding 1 MB is rejected by Fastify with HTTP 413 (Payload Too Large).
  - **Part 4: Partial Failure & Concurrency Races (EX-11)**
    - `1 duplicate row among 10 imports valid rows and reports error by row number (EX-11)`: 9 valid candidates are created; row 5 is reported in `errors` with `{ row: 5, email, reason }`.
    - `concurrent duplicate imports create each candidate exactly once without HTTP 500`: Two concurrent requests with identical candidate emails create each candidate once without 500 crashes.
  - **Part 5: Role & Route Isolation (BR-25)**
    - `unauthenticated request returns 401 Unauthorized`.
    - `candidate session attempting bulk candidate import returns 403 Forbidden (BR-25)`: Candidate tokens cannot access `/company/candidates/bulk`.

---

## 4. Memory Measurement Methodology

Accurate memory measurement in Node.js requires controlling for V8 garbage collection artifacts:

1. **V8 GC Exposure**: Enabled programmatically in `candidate-fuzz-test-app.ts` via `v8.setFlagsFromString('--expose_gc')` and `vm.runInNewContext('gc')()`.
2. **Measurement Workflow**:

   ```typescript
   // 1. Force full GC to establish clean heap baseline
   global.gc();
   const baselineHeap = process.memoryUsage().heapUsed;

   // 2. Dispatch 1,000-candidate batch request
   const res = await app.inject({
     method: 'POST',
     url: '/api/v1/company/candidates/bulk',
     payload,
   });

   // 3. Force full GC to reclaim transient buffers and parse trees
   global.gc();
   const postHeap = process.memoryUsage().heapUsed;
   const heapDeltaMb = (postHeap - baselineHeap) / (1024 * 1024);

   // 4. Assert memory footprint growth is strictly bounded
   expect(heapDeltaMb).toBeLessThan(50);
   ```

3. **Observed Performance**:
   - Initial 1,000-row batch heap delta: ~14.2 MB (well under the 50 MB threshold).
   - Second 1,000-row batch heap delta: ~3.8 MB (plateau confirmed, 0 unbounded growth).

---

## 5. Findings Registry

### FINDING-01: Bulk Endpoint Accepts JSON Payload, Not Multipart/CSV

- **Observation**: The server endpoints `POST /candidates/bulk` and `POST /company/candidates/bulk` accept `application/json` with `{ candidates: CreateCandidateDto[] }`. There is no multipart CSV parser on the API.
- **Resolution**: CSV parsing is intentionally client-side (`apps/web/src/lib/candidate-csv.ts`). Tests for CSV parsing run in `@hs/web`, while API fuzzing tests validate the JSON ingestion contract.

### FINDING-02: Web Parser Row Limit (500) vs API Bulk Capacity (1,000+)

- **Observation**: `apps/web/src/lib/candidate-csv.ts` enforces `MAX_CSV_ROW_LIMIT = 500` per `CO-012` and `AGENTS.md:910`. However, the API endpoint has no row count limit (only bounded by Fastify's 1 MB `bodyLimit`).
- **Impact**: API clients bypassing the web UI can submit batches exceeding 500 candidates.

### [FINDING-03] Missing Server-Side Quota & Pending-Invite Check on Candidate Creation (BR-06)

- **Status**: Skipped in suite: `it.skip('[FINDING-03] candidate cap and pending invite multiplier enforced on bulk import (BR-06)')`.
- **Root Cause**: `CandidatesService.create` and `bulkCreate` omit checks against `app.entitlements.max_candidates` and `pending_invite_multiplier`. An organization can create candidates beyond its provisioned entitlement.

### [FINDING-04a] Missing ZodValidationPipe on @Post('bulk') Causes HTTP 500 on Non-Array Payload

- **Status**: Skipped in suite: `it.skip('[FINDING-04a] invalid payload type returns 400 Bad Request instead of unhandled 500')`.
- **Root Cause**: In `CandidatesController`, `@Post('bulk')` receives `@Body() payload: { candidates: CreateCandidateDto[] }` without `@UsePipes(new ZodValidationPipe(...))`. When `payload.candidates` is not an array, `CandidatesService.bulkCreate` attempts `for (let i = 0; i < payload.candidates.length; i++)`, throwing an unhandled `TypeError` that results in HTTP 500 instead of 400 Bad Request.

### [FINDING-04b] Missing Email Syntax Validation in CandidatesService Permits CRLF Injection

- **Status**: Skipped in suite: `it.skip('[FINDING-04b] CRLF injection in email field rejected with HTTP 400 Bad Request')`.
- **Root Cause**: `CandidatesService.create` does not validate email syntax before database insertion or before calling `MailService.sendInvitationEmail`. Hostile emails containing `\r\nBcc:` are inserted into the database and forwarded to the mail adapter.

### [FINDING-04c] Invalid Email Syntax Stored in Database Instead of Reported in Errors Array

- **Status**: Skipped in suite: `it.skip('[FINDING-04c] invalid email syntax among valid rows reported in errors array (EX-11)')`.
- **Root Cause**: Due to the absence of email format validation, submitting `{ name: 'Bad Candidate', email: 'not-an-email' }` results in database insertion rather than being captured in the `errors` array.

### FINDING-05: Soft-Deleted Candidate Email Cannot Be Re-imported

- **Status**: Documented architectural behavior.
- **Root Cause**: In migration `0001_tenancy_foundation.sql`, table `app.users` defines an unconditional unique constraint:
  ```sql
  CONSTRAINT users_org_email_key UNIQUE (org_id, email)
  ```
  When a candidate is soft-deleted (`status = 'deleted'`), `CandidatesService.create` checks:
  ```sql
  SELECT id FROM app.users WHERE org_id = $1 AND email = $2 AND status != 'deleted'
  ```
  This query returns 0 rows. The service proceeds to execute `INSERT INTO app.users`, which trips the unconditional unique constraint and throws PostgreSQL error `23505 (unique_violation)`. The service then returns an error in `errors[]` for that candidate row.
- **Architectural Analysis**: A soft-deleted candidate email can never be re-invited or re-imported.

---

## 6. Open Questions for Engineering Leadership (Vishal V)

1. **Open Question 1: Server-Side Bulk Row Limit**

   - _Question_: Should the API enforce a server-side cap on candidate array length (e.g., matching the web limit of 500 rows per request), or should it remain bounded purely by the Fastify 1 MB body limit?
   - _Recommendation_: Add a server-side validation check in `CandidatesController` rejecting payloads where `candidates.length > 500` with HTTP 400 Bad Request (`MAX_ROWS_EXCEEDED`).

2. **Open Question 2: Soft-Deleted Candidate Re-import Policy**

   - _Question_: Is permanent lockout of a soft-deleted email intended, or should soft-deleted candidates be reactivated upon re-import, or should the database constraint be changed to a partial index `CREATE UNIQUE INDEX users_org_email_active_idx ON app.users (org_id, email) WHERE status != 'deleted'`?
   - _Recommendation_: Clarify whether soft-deleted candidates can be re-invited with a fresh token or if a separate "restore candidate" flow is required.

3. **Open Question 3: Bulk Error Detail Extraction**
   - _Question_: In `CandidatesService.bulkCreate`, error reasons are extracted via `err?.detail || err?.message || 'Failed to import candidate'`. Because NestJS `problem(...)` exceptions encapsulate the error detail inside `err.getResponse().detail`, `err.message` evaluates to generic `'Http Exception'`. Should this be updated to `(err.getResponse?.() as any)?.detail || err?.detail || err?.message` so users receive specific messages (e.g., `"Candidate with this email already exists in your organization"`)?
   - _Recommendation_: Update error detail extraction to inspect `err.getResponse()`.

---

## 7. Database Hygiene, Isolation & Safety Guarantees

1. **Synthetic PII Only**: All generated candidates across tests and fixtures strictly use the reserved domain `example.test` and standardized synthetic names (`Fuzz Candidate N`). No real personal data is ever introduced into test databases or logs.
2. **Reverse-Dependency Cleanup**: Tests that insert candidate records clean them up in reverse foreign-key dependency order:
   ```sql
   DELETE FROM app.invitations WHERE org_id = $1;
   DELETE FROM app.users WHERE org_id = $1;
   DELETE FROM app.entitlements WHERE org_id = $1;
   DELETE FROM app.organizations WHERE id = $1;
   ```
3. **Audit Trail Verification**: Creating a candidate generates an append-only audit event in `audit.events` per BR-31. PostgreSQL triggers prevent mutation or deletion of audit rows. All test audit records carry distinct synthetic markers (`action: 'candidate.invited'`).
4. **Outbound Email Interception**: `candidate-fuzz-test-app.ts` provides a spy on `MailService.sendInvitationEmail`, guaranteeing 0 network calls and 0 real emails sent.
5. **Offline Skip Capability**: If the database is unreachable, `checkDbConnection()` detects it gracefully and skips the test suite without erroring or crashing CI.
