# Candidate Invitation API Dependencies & Contract Specification

This document details the API, database, and fixture dependencies for candidate invitations (`CA-001`, `BR-24`), based on codebase implementation and confirmed by the backend engineering team.

---

## 1. Invitation Endpoints & Source Files

The integration test suite (`packages/fixtures/test/invitations.test.ts`) tests the invitation flow implemented in `apps/api`:

| Method | Endpoint Route             | Global Prefix Applied             | Controller & Action                                                                                 | Service Method                                                                                 | Purpose                                                                                                                                            |
| ------ | -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/auth/invitations/:token` | `/api/v1/auth/invitations/:token` | `InvitationsController.validateToken` (`apps/api/src/modules/auth/invitations.controller.ts:41`)    | `InvitationsService.lookupInvitation` (`apps/api/src/modules/auth/invitations.service.ts:80`)  | Validates token and returns non-sensitive recipient details before password entry.                                                                 |
| `POST` | `/auth/invitations/accept` | `/api/v1/auth/invitations/accept` | `InvitationsController.acceptInvitation` (`apps/api/src/modules/auth/invitations.controller.ts:60`) | `InvitationsService.acceptInvitation` (`apps/api/src/modules/auth/invitations.service.ts:120`) | Atomically validates password complexity, consumes token, activates candidate, updates password, logs audit event, and invokes session revocation. |

### Rate Limiting & Test Avoidance

Both endpoints are decorated with `@Public()` (bypass session cookie requirements) and throttled via `@Throttle`:

- **Production**: 10 attempts per hour per IP (`429 RATE_LIMITED`).
- **Development / Test**: 1000 attempts per hour per IP.
- **Test Avoidance Strategy**: The integration test suite avoids HTTP throttling entirely by instantiating and executing `InvitationsService` directly in-process with a PostgreSQL connection pool (`client as any`), rather than sending external HTTP requests through the Fastify network stack.

---

## 2. API Contract Specification (Confirmed by Backend Team)

### 2.1 `GET /auth/invitations/:token`

- **URL Parameter**:
  - `token` (string, required): 64-character lowercase hexadecimal string (32 cryptographically random bytes).
- **Headers**:
  - `x-request-id` (string, optional): Request correlation identifier.
- **Success Response (`200 OK`)**:
  - Content-Type: `application/json`
  - Body:
    ```json
    {
      "email": "candidate.aster-ridge.071@example.com",
      "role": "candidate",
      "orgName": "Aster Ridge Technologies"
    }
    ```
- **Failure Response (`404 Not Found`)**:
  - Content-Type: `application/problem+json` (RFC 9457)
  - Identical generic problem details returned for non-existent, expired, used, empty, or whitespace tokens:
    ```json
    {
      "type": "https://hellosmart.ai/problems/invitation-invalid",
      "title": "Invitation Invalid",
      "status": 404,
      "detail": "The invitation is invalid, has expired, or has already been used.",
      "code": "INVITATION_INVALID",
      "requestId": "req-..."
    }
    ```

### 2.2 `POST /auth/invitations/accept`

- **Request Body (`AcceptInvitationRequest`)**:
  ```json
  {
    "token": "string (min 1, 64-character lowercase hex string)",
    "password": "string (PasswordPolicySchema: 12-128 chars, uppercase, lowercase, digit, symbol)"
  }
  ```
- **Headers**:
  - `x-request-id` (optional): Request tracking ID.
  - `x-forwarded-for` (optional): Client IP parsed for the audit log (falls back to socket IP).
  - `user-agent` (optional): Client User-Agent parsed for the audit log.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "message": "Password set successfully. Please log in."
  }
  ```
- **Error Responses**:
  - **Weak Password (`422 Unprocessable Entity`)**:
    - Returned when password does not satisfy `PasswordPolicySchema`.
    ```json
    {
      "type": "https://hellosmart.ai/problems/weak-password",
      "title": "Weak Password",
      "status": 422,
      "detail": "Password must contain at least one special character",
      "code": "WEAK_PASSWORD",
      "requestId": "req-..."
    }
    ```
  - **Invalid, Expired, Used, or Replayed Token (`404 Not Found`)**:
    - Identical RFC 9457 response as lookup failure (`INVITATION_INVALID`). Never reveals whether the token ever existed or why it failed.

---

## 3. Database Dependencies & Token Storage

The invitation system relies on PostgreSQL migration `packages/contracts/db/migrations/0003_invitations.sql`:

1. **Table `app.invitations`**:

   - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `org_id`: `uuid NOT NULL REFERENCES app.organizations(id)`
   - `user_id`: `uuid NOT NULL REFERENCES app.users(id)`
   - `email`: `citext NOT NULL`
   - `role`: `text NOT NULL CHECK (role IN ('company_admin', 'candidate'))`
   - `token_hash`: `bytea NOT NULL UNIQUE` (32-byte binary SHA-256 digest)
   - `expires_at`: `timestamptz NOT NULL`
   - `used_at`: `timestamptz` (null until single-use redemption)
   - `created_at`: `timestamptz NOT NULL DEFAULT now()`
   - `CONSTRAINT invitation_expiry_window`: `CHECK (expires_at > created_at AND expires_at <= created_at + interval '72 hours')`
   - Row-level security: `FORCE ROW LEVEL SECURITY` with `USING (org_id = app.current_org_id() OR app.is_platform())`.

2. **Security Definer Function `app.lookup_invitation(p_token_hash bytea)`**:

   - Evaluates `p_token_hash` (must be 32 bytes).
   - Elevated lookup bypasses tenant RLS strictly for pre-login validation:
     `SELECT id, org_id, user_id, email, role, org_name, expires_at, used_at FROM app.invitations WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()`.

3. **Security Definer Function `app.accept_invitation(...)`**:

   - Executes single-use consumption in one ACID transaction:
     - Sets `used_at = now()` on `app.invitations` where `token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()`.
     - Updates `app.users`: sets `password_hash = p_password_hash`, `must_reset_password = false`, `status = 'active'`, `email_verified_at = now()`.
     - Appends tamper-evident audit record to `audit.events` using chained SHA-256 event hash with `pg_advisory_xact_lock(hashtext('audit.events'))`.
   - Returns `{ success: true, user_id, org_id, email, role }`.

4. **Cryptographic Token Hashing Rule (Confirmed by Backend Team)**:
   - Raw tokens are 32 random bytes, formatted as 64-character lowercase hexadecimal strings.
   - Only the binary SHA-256 digest `crypto.createHash('sha256').update(rawToken.trim()).digest()` (32-byte `Buffer`) is stored in the database as `bytea`.
   - Raw tokens are never stored, logged, or queried directly.

---

## 4. Fixture & Seed Dependencies

The seed engine (`packages/fixtures`) provides deterministic fixtures for invitation testing:

1. **Seeded Test Scenarios (All in Aster Ridge `org_id`)**:

   - **Valid (`valid`)**: Candidate 071 (`candidate.aster-ridge.071@example.com`), `expires_at = now() + 48h`, `used_at = null`, role `'candidate'`. Raw token is 64 hex characters.
   - **Expired (`expired`)**: Candidate 072 (`candidate.aster-ridge.072@example.com`), `expires_at = now() - 24h`, `used_at = null`, role `'candidate'`. Raw token is 64 hex characters.
   - **Used (`used`)**: Candidate 001 (`candidate.aster-ridge.001@example.com`), `expires_at = now() + 48h`, `used_at = now() - 1h`, role `'candidate'`. Raw token is 64 hex characters.

2. **Valid-Case State Reset & Seed Idempotency**:

   - When integration tests consume candidate 071's valid token, tests restore the user back to `status: 'invited'`, `must_reset_password: true`, `password_hash: null`, and `used_at: null` in test teardown blocks.
   - Re-running `runSafeSeed` idempotently handles candidate 071 resets without error.

3. **Ephemeral In-Memory & Local Token Storage**:
   - Raw tokens generated during seeding are held in memory (`lib/invite-links.ts:setInMemoryTokens`) and persisted to the gitignored file `.seed-tokens.local.json`.
   - The `--show-tokens` CLI flag refuses execution if `CI=true` or `GITHUB_ACTIONS=true` is detected, protecting test outputs from leaking tokens.

---

## 5. Candidate Management & Onboarding Status

The invitation lifecycle features relate to the broader candidate management system as follows:

| Capability / Route           | Planned Requirement / Location                   | Architecture Status                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resend Invitation**        | `CO-017` (`POST /candidates/:id/resend-invite`)  | Company admin action. Issues a fresh 72h token and invalidates previous token. Lives under candidates controller, outside `/auth/invitations`.                                                                 |
| **Revoke Invitation**        | `CO-031`                                         | Candidate and assignment lifecycle action, not a standalone invitation token endpoint.                                                                                                                         |
| **List Invitations**         | `GET /candidates`                                | Scoped by `org_id`. Candidate list surfaces invite status (`invited`, `active`, `suspended`, `deleted`).                                                                                                       |
| **Accept Invitation Web UI** | `apps/web/src/app/(auth)/accept-invite/page.tsx` | Implemented. Next.js client page reads token from URL query, strips token via `history.replaceState`, validates metadata via `validateInvitation`, and renders `SetPasswordForm` with password strength meter. |

_Note: The integration tests in `packages/fixtures/test/invitations.test.ts` intentionally test only the core auth invitation contract (`GET /auth/invitations/:token` and `POST /auth/invitations/accept`). They do not duplicate candidate CRUD routes._

---

## 6. Request Logging & Redaction Verification

### Confirmed by Backend Team

Request logging in `apps/api` includes path redaction specifically designed for invitation routes:

- **Fastify `onResponse` Hook (`apps/api/src/modules/observability/logging.hooks.ts:156-163`)**:
  The logging hook intercepts completed requests and normalizes the URL. If the URL contains `/auth/invitations/`, regex `/auth\/invitations\/(?!accept$)[^/]+/g` replaces the token path parameter with `[REDACTED]`:
  - `GET /api/v1/auth/invitations/<token>` $\rightarrow$ `GET /api/v1/auth/invitations/[REDACTED]`
  - `POST /api/v1/auth/invitations/accept` $\rightarrow$ `POST /api/v1/auth/invitations/accept` (unredacted endpoint name)
- **Logger Configuration (`apps/api/src/modules/observability/logger.config.ts`)**:
  `DEFAULT_REDACT_PATHS` redacts `token`, `invitationToken`, `rawToken`, `token_hash`, and password fields across all JSON bodies and query strings.

### Remaining Notes & Observations

1. **Session Revocation Infrastructure on Accept**:
   In `InvitationsService.acceptInvitation`, `this.revokeUserSessions` checks `if (this.sessionService)`. In development and test runs without `SessionService` injected, it logs `Session revocation hook invoked for user ... (session infrastructure pending)`. Session store revocation will be wired once Redis session management (`CO-001` session infrastructure) is active.
2. **Acceptance Handoff**:
   `POST /auth/invitations/accept` returns `{ success: true, message: "Password set successfully. Please log in." }`. The candidate is directed to `/login` to enter their newly created password, preserving distinct authentication boundaries.
