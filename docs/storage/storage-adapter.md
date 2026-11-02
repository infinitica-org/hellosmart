# Storage Adapter Architecture & Tenant Scoping Specification

> **Requirement Traceability:** `[4.3]` S3/Object Storage Adapter for Submission Artifacts  
> **Relevant Business Rules:** `BR-01` (Tenant Isolation), `BR-18` (Untrusted Candidate Input), `BR-31` (Append-Only Audit Logging)  
> **Candidate Access & Human Review:** `BR-20` (Candidate view after release; candidate download URL access is blocked during MMP submission)  
> **Related Requirements:** `CA-018` (Candidate Work Submission), `CO-042` (Submission Detail View)

---

## 1. Overview & Architectural Boundaries

The HelloSmart storage module (`apps/api/src/common/storage/`) manages candidate submission deliverables and artifacts. It provides a multi-tenant storage abstraction supporting:

- **Local Filesystem Driver (`local`)**: Used during local development and testing. Artifacts are written to `.storage/`, and downloads are served via temporary HMAC-SHA256 signed endpoint URLs.
- **AWS S3 / Cloudflare R2 Driver (`s3`)**: Used in staging and production environments. Downloads are served via 900-second presigned GET URLs generated via `@aws-sdk/s3-request-presigner`.
- **Fake Storage Adapter (`fake`)**: Used for isolated in-memory unit and integration testing without disk or network I/O.

All uploads are handled as untrusted streams (BR-18) subject to strict extension allowlisting, header magic-byte verification, and an enforced 50MB size cap with immediate stream destruction on breach.

---

## 2. Storage Key Layout & Tenancy Scoping (BR-01)

Every file path in object storage is strictly prefixed by the organization UUID (`org_id`):

```
storage/{org_id}/submissions/{assignment_id}/{object_id}-{safe_filename}
```

### Components

1. `storage/`: Top-level namespace.
2. `{org_id}`: Primary tenant partition (UUID v4). Cross-tenant queries return a generic 404 Not Found to prevent existence enumeration.
3. `submissions/`: Logical collection for candidate deliverables.
4. `{assignment_id}`: Target assessment assignment UUID.
5. `{object_id}`: Randomly generated UUID v4 identifying the deliverable artifact.
6. `{safe_filename}`: Sanitized original deliverable filename (e.g. `final_report.pdf`).

> [!NOTE] > **Spec Traceability & Divergence Note:**  
> AGENTS.md §6.3 lists an `artifacts_ref` string field on the proposed `Submission` entity. Our key layout explicitly scopes the path under `storage/{org_id}/...` to guarantee that S3 bucket policies, IAM scoping, and tenant audits remain cryptographically and operationally isolated per `BR-01`.

---

## 3. Allowed Deliverable Formats & Security Policy

Candidate uploads are untrusted user input (BR-18). The platform strictly enforces an allowlist of permitted deliverable file formats:

| Extension             | MIME Type                                                                 | Magic Bytes / Signature | Validation Rules                         |
| --------------------- | ------------------------------------------------------------------------- | ----------------------- | ---------------------------------------- |
| `.zip`                | `application/zip`                                                         | `PK\x03\x04`            | Must match ZIP header                    |
| `.docx`               | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `PK\x03\x04`            | Macro-enabled `.docm` strictly rejected  |
| `.xlsx`               | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | `PK\x03\x04`            | Macro-enabled `.xlsm` strictly rejected  |
| `.tar.gz`             | `application/gzip`                                                        | `1f 8b`                 | Gzip header check                        |
| `.pdf`                | `application/pdf`                                                         | `%PDF-`                 | PDF header check                         |
| `.png`                | `image/png`                                                               | `\x89PNG\r\n\x1a\n`     | 8-byte PNG signature                     |
| `.jpg`, `.jpeg`       | `image/jpeg`                                                              | `\xff\xd8\xff`          | 3-byte JPEG SOI marker                   |
| `.txt`, `.md`, `.csv` | `text/*`                                                                  | UTF-8                   | No null bytes (`0x00`), valid UTF-8 text |
| `.json`               | `application/json`                                                        | UTF-8                   | Valid UTF-8 and valid JSON syntax        |

### Prohibited & Dangerous Extensions

- Executables & Scripts: `.exe`, `.sh`, `.bat`, `.cmd`, `.com`, `.msi`, `.scr`, `.ps1`, `.vbs`, `.js`, `.jar`, `.dll`, `.apk`, `.app`, `.bin`
- Macro formats: `.docm`, `.xlsm`
- **SVG Files (`.svg`)**: Explicitly rejected per Decision 5 due to embedded JavaScript / Stored Cross-Site Scripting (XSS) risks.
- Double extensions: Files like `report.pdf.exe` or `data.csv.sh` are detected and rejected.

---

## 4. Upload Streaming & Size Limits

- **Hard Cap:** `52,428,800` bytes (50 MB).
- **Streaming Pipeline:** Fastify multipart streams directly through `StreamValidationTransform`.
- **Immediate Abort:** If the total byte counter exceeds 50MB, `StreamValidationTransform` destroys the stream and unlinks any partial local files. The request terminates with `413 Payload Too Large`.
- **Hashing:** SHA-256 digest is calculated on the fly as chunks pass through the transform.

---

## 5. Download URLs & Access Control

### Stateless Object Key Resolution (`findKeyByObjectId`)

No in-memory process registry is maintained. To eliminate statefulness and ensure resiliency across process restarts or horizontal replicas:

1. The route `GET /storage/download-url/:assignmentId/:objectId` accepts both `assignmentId` and `objectId`.
2. The storage adapter scans the tenant's exact prefix:
   `storage/{effectiveOrgId}/submissions/{assignmentId}/{objectId}-`
3. In S3: Uses `ListObjectsV2Command` with `MaxKeys: 1`.
4. In Local Filesystem: Scans the directory `${localRoot}/storage/${effectiveOrgId}/submissions/${assignmentId}/` for matching files.
5. In Fake Adapter: Iterates memory keys matching the prefix.
6. If no key matches, or if the resolved key does not belong to `effectiveOrgId`, a generic `404 Not Found` is returned.

### Roles & Permissions

- **Candidate:** Rejected with `403 Forbidden`. Candidates submit work (CA-018); candidate viewing of results/submissions is gated on human release in later tickets (BR-20).
- **Company Admin:** May request download URLs for artifacts within their own organization (`CO-042`). Any attempt to access artifacts of another tenant returns `404 Not Found` (never 403, preventing existence leaks per BR-01).
- **Platform Admin:** May request download URLs across all tenants via an audited exception. The target organization must be supplied via the `orgId` query parameter.

### Presigned URL Flow (Production / S3)

Uses `@aws-sdk/s3-request-presigner` with:

- `expiresIn: 900` (15 minutes).
- `ResponseContentDisposition: attachment; filename="<safe_filename>"`.
- `ResponseContentType: <contentType>`.

### Signed URL Flow (Development / Local Filesystem)

1. Endpoint: `GET /api/v1/storage/download?token=<signedToken>`.
2. Rate Limiting: Protected with `@Throttle({ default: { limit: 30, ttl: 60_000 } })`.
3. Non-local Drivers: If `STORAGE_DRIVER !== 'local'`, this route returns generic `404 Not Found`.
4. Token verification:
   - Evaluates expiration timestamp against `Date.now()`.
   - Uses `crypto.timingSafeEqual` to prevent timing attacks.
   - Any invalid, expired, tampered, wrong-org, or non-existent token returns the exact same generic `404 Not Found` response.
5. Security Headers:
   - `Content-Type: <contentType>`
   - `Content-Disposition: attachment; filename="<safe_filename>"`
   - `X-Content-Type-Options: nosniff`
   - `Cache-Control: no-store`
   - Sets no cookies.

### Access Log Leak Prevention

Access logs in Fastify strip query strings (in `apps/api/src/modules/observability/logging.hooks.ts` line 158: `rawUrl.split('?')`). Therefore, download tokens in the URL query string are never written to access logs.

---

## 6. Audit Logging (BR-31)

Append-only audit logs are recorded via `AuditLogService.log`:

1. `artifact.uploaded`: Emitted upon successful candidate upload. Metadata recorded:
   - `org_id`: Tenant UUID
   - `actor_id`: Candidate User UUID
   - `role`: `'candidate'`
   - `assignment_id`: Assessment assignment UUID
   - `object_id`: Deliverable UUID
   - `size_bytes`: Final byte count
   - `content_type`: MIME type
   - `sha256`: SHA-256 hex digest
   - _Security Rule:_ Filename and user-chosen strings are excluded from the audit payload. Zero presigned URLs or signed tokens are ever logged.
2. `artifact.platform_downloaded`: Emitted when a platform admin requests a download URL for a tenant's artifact:
   - `org_id`: Target tenant UUID
   - `actor_id`: Platform Admin User UUID
   - `role`: `'platform_admin'`
   - `assignment_id`: Assignment UUID
   - `object_id`: Deliverable UUID
   - `target_org_id`: Target tenant UUID

---

## 7. Configuration Reference

| Environment Variable           | Type                        | Default                  | Description                                          |
| ------------------------------ | --------------------------- | ------------------------ | ---------------------------------------------------- |
| `STORAGE_DRIVER`               | `'local' \| 's3' \| 'fake'` | `'local'`                | Active storage engine. Production mandates `'s3'`.   |
| `STORAGE_LOCAL_ROOT`           | `string`                    | `'.storage'`             | Root filesystem directory for local driver.          |
| `STORAGE_SIGNING_SECRET`       | `string` (min 32 chars)     | `SESSION_SECRET`         | Secret key for local download token HMAC signatures. |
| `STORAGE_S3_BUCKET`            | `string`                    | `'hs-local-artifacts'`   | S3 bucket name.                                      |
| `STORAGE_S3_REGION`            | `string`                    | `'us-east-1'`            | AWS region.                                          |
| `STORAGE_S3_ENDPOINT`          | `string` (URL)              | `undefined`              | Custom S3 endpoint for LocalStack / MinIO.           |
| `STORAGE_S3_ACCESS_KEY_ID`     | `string`                    | `undefined`              | AWS Access Key ID (ECS uses IAM task roles).         |
| `STORAGE_S3_SECRET_ACCESS_KEY` | `string`                    | `undefined`              | AWS Secret Access Key.                               |
| `STORAGE_S3_FORCE_PATH_STYLE`  | `boolean`                   | `true` (if endpoint set) | Path style URLs for LocalStack.                      |
