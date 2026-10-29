# Candidate Invitation API Dependencies & Contract Specification

This document details the API, database, and fixture dependencies for candidate invitations (`S0-T08`, `BR-24`), as read directly from the codebase. It records the active contracts, verified security postures, missing/unavailable endpoints, and open questions for backend engineering.

---

## 1. Invitation Endpoints & Source Files

The integration test suite (`packages/fixtures/test/invitations.test.ts`) depends on the following endpoints implemented in `apps/api`:

| Method | Endpoint Route             | Global Prefix Applied             | Controller & Action                                                                                 | Service Method                                                                                 | Purpose                                                                                                                                            |
| ------ | -------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/auth/invitations/:token` | `/api/v1/auth/invitations/:token` | `InvitationsController.validateToken` (`apps/api/src/modules/auth/invitations.controller.ts:41`)    | `InvitationsService.lookupInvitation` (`apps/api/src/modules/auth/invitations.service.ts:80`)  | Validates token and returns non-sensitive recipient details before password entry.                                                                 |
| `POST` | `/auth/invitations/accept` | `/api/v1/auth/invitations/accept` | `InvitationsController.acceptInvitation` (`apps/api/src/modules/auth/invitations.controller.ts:60`) | `InvitationsService.acceptInvitation` (`apps/api/src/modules/auth/invitations.service.ts:120`) | Atomically validates password complexity, consumes token, activates candidate, updates password, logs audit event, and invokes session revocation. |

Both endpoints are decorated with `@Public()` (bypass session cookie requirements) and rate-limited via `@Throttle`:

- Production: 10 attempts per hour per IP.
- Development / Test: 1000 attempts per hour per IP.

---

## 2. API Contract Specification (Read from Code)

### 2.1 `GET /auth/invitations/:token`

- **URL Parameter**:
  - `token` (string, required): The raw 32-byte cryptographic token (e.g. 64-character hexadecimal or base64url string).
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
  - Returned identically for: non-existent token, expired token, or already-used token.
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
    "token": "string (min 1)",
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

## 3. Database Dependencies

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

4. **Cryptographic Token Hashing Rule**:
   - Raw tokens are 32 random bytes (64 hexadecimal characters).
   - Only the SHA-256 digest `crypto.createHash('sha256').update(rawToken.trim()).digest()` (32-byte `Buffer`) is stored as `bytea`.
   - Raw tokens are never stored, logged, or queried directly.

---

## 4. Fixture & Seed Dependencies

The seed engine (`packages/fixtures`) provides deterministic fixtures for invitation testing:

1. **Seeded Test Scenarios (All in Aster Ridge `org_id`)**:

   - **Valid (`valid`)**: Candidate 071 (`candidate.aster-ridge.071@example.com`), `expires_at = now() + 48h`, `used_at = null`, role `'candidate'`.
   - **Expired (`expired`)**: Candidate 072 (`candidate.aster-ridge.072@example.com`), `expires_at = now() - 24h`, `used_at = null`, role `'candidate'`.
   - **Used (`used`)**: Candidate 001 (`candidate.aster-ridge.001@example.com`), `expires_at = now() + 48h`, `used_at = now() - 1h`, role `'candidate'`.

2. **Valid-Case State Reset & Seed Idempotency**:

   - When integration tests consume candidate 071's valid token, tests restore the user back to `status: 'invited'`, `must_reset_password: true`, `password_hash: null`, and `used_at: null` in test teardown blocks.
   - Re-running `runSafeSeed` idempotently handles candidate 071 resets without error.

3. **Ephemeral In-Memory & Local Token Storage**:
   - Raw tokens generated during seeding are held in memory (`lib/invite-links.ts:setInMemoryTokens`) and persisted to the gitignored file `.seed-tokens.local.json`.
   - The `--show-tokens` CLI flag refuses execution if `CI=true` or `GITHUB_ACTIONS=true` is detected, protecting test outputs from leaking tokens.

---

## 5. Missing / Unavailable Endpoints (Out of Scope for Fixtures)

The following invitation lifecycle capabilities do **not** exist in the backend codebase (`apps/api` and `packages/contracts/openapi/openapi.yaml`):

| Capability / Endpoint                         | Status          | Impact on Test Suite                                                                                             |
| --------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/candidates/:id/resend-invite`   | Not implemented | Cannot test candidate invite resending via HTTP API; seed creates raw tokens once.                               |
| `DELETE /api/v1/invitations/:id` (Revocation) | Not implemented | Cannot test explicit manual revocation of an active invitation; only expiration and consumption exist.           |
| `GET /api/v1/invitations` (List invitations)  | Not implemented | Company admin invitation listing cannot be tested via API.                                                       |
| Web UI Candidate Onboarding Page              | Not implemented | There is no frontend accept-invite page; tests directly execute backend `InvitationsService` and HTTP contracts. |

---

## 6. Open Questions & Findings for Vishal V

> [!NOTE]
> The following items are unconfirmed architectural/security questions flagged for confirmation:

1. **Request URL Logging of Raw Token in Path**:

   - **Finding**: In `apps/api/src/common/logger/pino-redact.ts:4-23`, `PINO_REDACT_PATHS` redacts object properties such as `*.token`, `*.invitationToken`, etc. However, Fastify request logging logs `req.url`.
   - For `GET /api/v1/auth/invitations/:token`, the raw token is in the URL path. Without a path parameter redaction hook or Fastify URL serializer, incoming request logs will record the raw invitation token.
   - _Question_: Should we introduce a Fastify request logging hook or URL serializer to censor `:token` path parameters in access logs?

2. **Session Revocation Infrastructure on Accept**:

   - **Finding**: In `InvitationsService.acceptInvitation`, `this.revokeUserSessions` checks `if (this.sessionService)`. In development and test runs without `SessionService` injected, it logs `Session revocation hook invoked for user ... (session infrastructure pending)`.
   - _Question_: Will session store revocation be integrated across all nodes when Redis session management (`S0-T03`) is wired to `InvitationsService`?

3. **Acceptance Flow Login Handoff**:
   - **Finding**: `POST /auth/invitations/accept` returns `{ success: true, message: "Password set successfully. Please log in." }`. It does not set a session cookie or return user authentication tokens.
   - _Question_: Is the candidate always expected to navigate to `/login` to enter their newly configured password, or will auto-login / session cookie issuance on accept be implemented in a future ticket?
