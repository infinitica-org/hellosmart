# Sprint 0 Security Verification Checklist

**Ticket:** S0-T15-2 — Security Verification Checklist & Sprint 0 Sign-Off  
**Branch:** `feat/stream-15-sprint-0-exit-gate`  
**Purpose:** Record reproducible evidence for the Sprint 0 authentication and authorization security controls.  
**Status:** **NOT SIGNED OFF — verification remains incomplete.**  
**Last updated:** 2026-10-29

## Status and evidence rules

- **PASS** means the check was executed against the relevant runtime or database and its evidence is linked.
- **FAIL** means the observed implementation or result does not meet the requirement.
- **BLOCKED** means the check could not run because a required service, fixture, permission, or tool was unavailable.
- **PENDING** means there is not yet sufficient execution evidence.
- Source-code inspection alone is not proof of a runtime security control. Do not change a status to PASS without attaching the command/result, CI run, sanitized log, screenshot, or database query output.
- Never include credentials, live tokens, MFA secrets, session cookies, personal data, or raw `.env` contents in this document or its evidence.

## Verification summary

| # | Control | Current status | Evidence / next action |
|---|---|---|---|
| 1 | Session cookie flags and JavaScript access | PENDING | Source: [auth.cookies.ts](../apps/api/src/modules/auth/auth.cookies.ts). Verify production `Set-Cookie` headers and prove `document.cookie` cannot read `hs_session`. |
| 2 | Security headers and CORS | PENDING | Source: [API main.ts](../apps/api/src/main.ts), [web middleware.ts](../apps/web/src/middleware.ts). Probe both live services and verify exact headers and allow-origin behavior. |
| 3 | Password brute-force protection and 15-minute lockout | PENDING | Source: [login-lockout.service.ts](../apps/api/src/modules/auth/login-lockout.service.ts). Run live test: five invalid passwords result in HTTP 429; verify unlock after 15 minutes using a controlled test/clock. |
| 4 | Cookie tampering, role boundaries, safe redirect | PENDING | Run live API and web tests for forged/modified cookie (401), Candidate `/admin/*` (403 at API), and external `from` URL ignored. |
| 5 | Cross-tenant isolation / RLS | BLOCKED — live DB evidence required | Execute cross-tenant queries using the `hs_app` database role and capture sanitized query/results showing zero unauthorized rows. |
| 6 | MFA encryption, log redaction, Git secret scan | PENDING | Source: [logger.config.ts](../apps/api/src/modules/observability/logger.config.ts). The earlier repository secret scan exited non-zero; investigate whether findings or scanner failure caused this before marking clean. Verify stored `mfa_secret` is ciphertext and scan logs/audit/Git history without exposing secret values. |
| 7 | Audit event coverage and redaction | PENDING | Source: [audit-log.service.ts](../apps/api/src/common/audit/audit-log.service.ts). Verify login, organization creation, and organization status-change records in `app.audit_logs`; confirm no secret fields/values are present. |
| 8 | Session lifecycle and Redis key protection | FAIL / PENDING | Source: [session.service.ts](../apps/api/src/modules/session/session.service.ts), [redis-session.store.ts](../apps/api/src/modules/session/redis-session.store.ts). Session IDs are UUIDs and the service refreshes a 12-hour TTL, but an absolute timeout and concurrent-session cap are not yet evidenced. **Potential implementation gap:** Redis keys are constructed as `hs:session:${sessionId}`, which appears to expose the raw session ID in the key; confirm and remediate by storing a hash-derived key if this is the active implementation. Test new token per login, idle/absolute expiry, session cap, logout-all, organization suspension revocation, and key hashing. |
| 9 | Server-side password policy and history | PENDING | Source: [password.ts](../apps/api/src/modules/auth/password.ts), [auth schema](../packages/contracts/src/schemas/auth.ts). Verify weak/common/breached/user-information passwords are rejected server-side, last-five password reuse is blocked, and changing a password revokes other sessions. |
| 10 | Findings review and Product Owner sign-off | PENDING | Attach evidence for all checks, assign owners/severity to findings, confirm no open High/Critical findings, and record the Product Owner's name/decision/date. |

## Detailed test record

### 1. Session cookie

- [ ] Production `Set-Cookie` includes `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/`.
- [ ] Browser test confirms `document.cookie` does not contain `hs_session`.
- [ ] Cookie is absent until password and required MFA verification both succeed.
- [ ] Sanitized evidence: **PENDING** — attach CI run or test output.

### 2. HTTP security headers and CORS

- [ ] Production web response includes a restrictive CSP.
- [ ] API and web responses include HSTS where HTTPS is terminated/configured for that service.
- [ ] `X-Frame-Options` is present, or the security owner explicitly accepts and documents CSP `frame-ancestors 'none'` as the frame-embedding control.
- [ ] `Referrer-Policy` is present.
- [ ] CORS uses an explicit allowlist; no `Access-Control-Allow-Origin: *` for credentialed/private APIs.
- [ ] Evidence from live `curl -sS -D - -o NUL <URL>` probes: **PENDING**.

### 3. Brute-force protection

- [ ] Five consecutive invalid passwords produce HTTP 429 for the test account.
- [ ] The account remains locked before the 15-minute lockout expires.
- [ ] The account can attempt login after the lockout expires.
- [ ] Verify behavior with Redis enabled (production-like configuration); do not rely only on the in-memory fallback.
- [ ] Evidence: **PENDING**.

### 4. Tampering, authorization, and redirects

- [ ] Missing, forged, and modified `hs_session` values receive HTTP 401 from a protected API.
- [ ] Candidate requests to protected Admin APIs receive HTTP 403.
- [ ] `?from=https://evil.com` cannot redirect the user to the external origin after login.
- [ ] Evidence: **PENDING** — link the exact automated test names and successful CI output.

### 5. Tenant isolation / RLS

- [ ] Connect using the application database role `hs_app`, not a superuser or table owner that bypasses RLS.
- [ ] Query tenant A's protected data while scoped to tenant B; result contains zero rows and no cross-tenant data is returned through the API.
- [ ] Confirm relevant tables have RLS enabled and policies are enforced for the application role.
- [ ] Evidence: **BLOCKED** — live database execution and sanitized output required.

### 6. MFA and secret handling

- [ ] Stored `mfa_secret` values are encrypted at rest; evidence demonstrates ciphertext without revealing the underlying secret or key.
- [ ] Logger redaction tests cover password, cookie, session token, access/refresh token, API key, MFA secret, and authorization fields.
- [ ] Audit records redact secret fields and values.
- [ ] Secret scanner completes successfully against the intended scope; review findings privately and rotate any exposed credential if necessary.
- [ ] Earlier secret scan returned exit code 1; root cause and final clean result: **PENDING**.

### 7. Audit trail

- [ ] Successful and failed login events are recorded according to the audit policy.
- [ ] Organization creation and organization status changes are recorded in `app.audit_logs`.
- [ ] Audit records contain no passwords, tokens, cookies, TOTP/MFA secrets, or other credentials.
- [ ] Evidence: **PENDING** — attach sanitized query output or test/CI link.

### 8. Session lifecycle

- [ ] Each successful login creates a new unpredictable session token.
- [ ] Idle timeout is enforced.
- [ ] Absolute maximum session lifetime is enforced independently of rolling activity.
- [ ] Concurrent session limit is enforced.
- [ ] Logout-all revokes every session for the user.
- [ ] Organization suspension revokes every affected session.
- [ ] Redis session keys do not contain raw session tokens; verify key derivation and stored values.
- [ ] Evidence: **PENDING**. Source inspection identified a possible raw-session-ID Redis key and did not establish absolute timeout or session cap.

### 9. Password controls

- [ ] Weak and common passwords are rejected by the server, not only by the UI.
- [ ] Known breached passwords are rejected by the server.
- [ ] Passwords containing disallowed user-specific information are rejected, where required by the approved policy.
- [ ] Reuse of each of the last five passwords is rejected.
- [ ] Password change revokes all other active sessions.
- [ ] Evidence: **PENDING**.

### 10. Findings and sign-off

| Finding | Severity | Owner | Status | Evidence / resolution |
|---|---|---|---|---|
| Raw session ID may be present in Redis key | To be triaged | TBD | Open pending confirmation | [redis-session.store.ts](../apps/api/src/modules/session/redis-session.store.ts) |
| Absolute timeout and concurrent-session cap not evidenced | To be triaged | TBD | Open pending verification | [session.service.ts](../apps/api/src/modules/session/session.service.ts) |
| Repository secret scan exited non-zero | To be triaged | TBD | Open pending diagnosis | Attach sanitized scanner summary |

**Product Owner sign-off**

- Product Owner: **TBD**
- Decision: **NOT APPROVED — verification incomplete**
- Date: **TBD**
- Evidence / approval link: **TBD**

## Execution record

Record the actual date, command, exit code, and artifact path for every run. Do not paste secret-bearing output into this file.

| Check | Command / method | Result | Evidence |
|---|---|---|---|
| API unit tests | `pnpm --filter @hs/api test` (or targeted test command) | Not recorded here | TBD |
| Web unit tests | `pnpm --filter @hs/web test` | Not recorded here | TBD |
| API authentication integration | `apps/api/test/auth.e2e-spec.ts` against running API + seeded DB | Previously reported blocked/failed; rerun required | TBD |
| Tenant integration | `apps/api/test/tenancy.e2e-spec.ts` against running API + seeded DB | Previously reported blocked/failed; rerun required | TBD |
| Live headers and cookies | `curl` probes + browser cookie test | Not run here | TBD |
| Secret scan | Repository-approved secret scanner | Exited non-zero; cause unknown | TBD |
| Docs sync | `pnpm docs:sync-check` | Not recorded for this document | TBD |

## Sprint 0 exit decision

**Current decision: NOT READY FOR SECURITY SIGN-OFF.** This is a truthful interim record, not a declaration that the ticket's done criteria have been met. Revisit after all checks have runtime evidence, all findings have been triaged and resolved, the secret scan has a known clean result, and the Product Owner has approved the evidence.
