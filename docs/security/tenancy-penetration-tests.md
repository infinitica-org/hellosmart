# Multi-Tenant Data Isolation & Security Penetration Testing Runbook

> **Scope**: Ticket [10.1] Multi-Tenant Data Isolation & Security Penetration Tests  
> **Requirements**: BR-01 (Tenant Isolation), BR-02 (Template Privacy), BR-03 (Version Pinning), BR-11 (No Work Loss / State Restoration), BR-25 (Route Isolation & RBAC Boundaries)  
> **Target Environment**: Automated in-process Fastify test harness against PostgreSQL test database (`hellosmart_test`)  
> **Test Suites**: `apps/api/test/security/tenancy.spec.ts`, `apps/api/test/security/privilege-escalation.spec.ts`

---

## 1. Architectural Security Overview

HelloSmart.ai employs a strict **defense-in-depth** multi-tenancy security model. Multi-tenant isolation and role-based access control are enforced concurrently across three distinct layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HTTP / Application Layer                        │
│   • CsrfOriginGuard (Strict X-HS-CSRF & Trusted Origin Validation)     │
│   • SessionGuard (Cookie-only __Host-hs_session / hs_session)         │
│   • Live DB Status Check (Fail-closed: suspended user/org check)       │
│   • RolesGuard (Role-based metadata: candidate, company_admin, etc.)   │
│   • OrgScopeGuard (Route parameter :orgId validation against session)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Storage Isolation Layer                          │
│   • Prefix-scoped keys: storage/{orgId}/submissions/{assignmentId}/... │
│   • Stateless key lookup: findKeyByObjectId prefix scan                │
│   • Cross-tenant requests return generic 404 (Zero metadata leak)      │
│   • Signed HMAC-SHA256 download tokens for local filesystem driver     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                      PostgreSQL RLS Data Layer                         │
│   • Non-superuser connection (hs_app with NOBYPASSRLS)                 │
│   • Session-level variable setting: app.set_tenant(org_id)             │
│   • Row-Level Security policies active on tenant tables                │
│   • Cross-tenant reads return 0 rows; writes violate RLS checks        │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 PostgreSQL Row-Level Security (RLS)

- All tenant-owned tables (`app.organizations`, `app.entitlements`, `app.users`, `app.invitations`, `app.templates`, `app.template_versions`, `app.template_assignments`, `app.assessments`, `app.password_history`, `app.mfa_backup_codes`) enforce tenant boundaries.
- The application executes queries through dedicated database roles (`hs_app`, `hs_platform`, `hs_owner`), ensuring that application traffic has `NOBYPASSRLS` and `NOSUPERUSER` privileges.
- Every tenant transaction sets `SET LOCAL app.org_id = '<org-uuid>'`.

### 1.2 Application Guards & Authority

- **SessionGuard**: Validates session authenticity strictly from ambient HTTP cookies (`__Host-hs_session` in production, `hs_session` in dev/test). Queries `app.find_user_by_id` on every authenticated request to verify live account and organization status. If an account or organization is suspended or deleted, requests fail-closed immediately with HTTP 403 (`USER_SUSPENDED`, `USER_DELETED`, `ORGANIZATION_SUSPENDED`).
- **RolesGuard**: Enforces RBAC boundaries based on `@Roles(...)` decorators. Restricts candidates from accessing company and platform surfaces, and restricts company admins from accessing platform administration endpoints.
- **OrgScopeGuard**: Evaluates parameterized routes (e.g. `/:orgId/*`). Confirms that the caller's authenticated `orgId` matches the route parameter; cross-tenant attempts return a generic HTTP 404 (`TENANT_NOT_FOUND`).
- **CsrfOriginGuard**: Protects all state-changing HTTP requests (`POST`, `PUT`, `PATCH`, `DELETE`) carrying ambient session cookies. Requires the custom `X-HS-CSRF` header and verifies that the `Origin` or `Referer` header strictly matches `config.CORS_ORIGINS`.

### 1.3 Storage Isolation

- Candidate submission deliverables and artifacts are stored under strict organization prefixes:
  `storage/{orgId}/submissions/{assignmentId}/{objectId}-{filename}`
- Presigned download URL generation (`GET /api/v1/storage/download-url/:assignmentId/:objectId`) looks up artifacts using stateless prefix scans (`findKeyByObjectId`) scoped strictly to the caller's `orgId`.
- If Tenant A requests an artifact belonging to Tenant B, or attempts to override the target organization via `?orgId=<tenant-b>`, the storage service fails to locate the key under Tenant A's prefix and returns a generic HTTP 404 (`Artifact not found`) with zero metadata leakage.

---

## 2. Security Test Methodology

### 2.1 The Control-First Principle

A security test that only tests negative outcomes (e.g., asserting that an attacker gets a 404) can produce **false positives** if the underlying route is broken, the resource was never seeded, or the endpoint URL has a typo.
To eliminate false positives, all penetration tests in `test/security/tenancy.spec.ts` strictly enforce the **Control-First Principle**:

1. **Positive Control**: Execute the request as the owning tenant (Tenant B) to prove that the resource exists, the route is functional, and an authorized caller receives HTTP 200/201.
2. **Adversarial Attack**: Execute the exact same request using the attacking tenant's credentials (Tenant A) and assert that the attack is rejected with HTTP 404.

### 2.2 No-Oracle Guarantees

An attacker must never be able to determine whether a resource exists in another organization by observing differences in status codes, error payloads, headers, or execution timing:

- Foreign tenant resources and non-existent random UUIDs return **identical** HTTP 404 status codes, error codes, and problem detail payloads.
- No timing discrepancies or diagnostic clues are leaked in error responses.

### 2.3 Zero Data Leakage (`assertZeroTenantLeak`)

Every adversarial attack response (status, body, headers, and cookies) is parsed by the `assertZeroTenantLeak` verification helper. The helper asserts zero occurrences of any of Tenant B's private identifiers:

- Organization ID, slug, and display name
- User IDs, administrator emails, and candidate emails
- Template IDs, slugs, and manifest titles
- Assessment IDs and assessment names
- Storage assignment IDs, object IDs, and storage keys

### 2.4 Test Data Isolation and Teardown

All test resources are created in `hellosmart_test` using randomly generated nonces. At test completion, `teardownSecurityTestData()` executes a single atomic transaction on `adminPool` (`hs_owner`) that removes all created rows in dependency order and asserts that `COUNT(*) === 0` across all affected tables.

---

## 3. Attack Matrix & Verification Results

| Requirement | Attack Vector                                         | Method & Route                                      | Attacking Role           | Expected Status         | Result     |
| :---------- | :---------------------------------------------------- | :-------------------------------------------------- | :----------------------- | :---------------------- | :--------- |
| **BR-02**   | Read Tenant B assigned template                       | `GET /api/v1/company/templates/:id`                 | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-02**   | Template catalog list leakage                         | `GET /api/v1/company/templates`                     | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Read Tenant B assessment                              | `GET /api/v1/company/assessments/:id`               | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Mutate Tenant B assessment brief                      | `PATCH /api/v1/company/assessments/:id/brief`       | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Assessment list leakage                               | `GET /api/v1/company/assessments`                   | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Candidate list isolation (`/candidates`)              | `GET /api/v1/candidates?limit=1000`                 | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Candidate list isolation (`/company/candidates`)      | `GET /api/v1/company/candidates?limit=1000`         | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Cross-tenant delete candidate (`/candidates`)         | `DELETE /api/v1/candidates/:id`                     | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant delete candidate (`/company/candidates`) | `DELETE /api/v1/company/candidates/:id`             | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant update candidate (`/candidates`)         | `PATCH /api/v1/candidates/:id`                      | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant update candidate (`/company/candidates`) | `PATCH /api/v1/company/candidates/:id`              | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant resend invite (`/candidates`)            | `POST /api/v1/candidates/:id/resend-invite`         | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant resend invite (`/company/candidates`)    | `POST /api/v1/company/candidates/:id/resend-invite` | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Mass-assignment tenant injection (`orgId` in body)    | `POST /api/v1/candidates`                           | Tenant A `company_admin` | `422 Unprocessable`     | **PASSED** |
| **BR-01**   | Mass-assignment tenant injection (`orgId` in body)    | `POST /api/v1/company/candidates`                   | Tenant A `company_admin` | `422 Unprocessable`     | **PASSED** |
| **BR-01**   | Storage download URL cross-tenant attack              | `GET /api/v1/storage/download-url/:asgId/:objId`    | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Storage download URL mixed-pair attack                | `GET /api/v1/storage/download-url/:asgA/:objB`      | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Storage download URL override via `?orgId=`           | `GET /api/v1/storage/download-url/...`              | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-11**   | Public storage stream with forged/tampered token      | `GET /api/v1/storage/download?token=...`            | Anonymous / Public       | `404 Not Found`         | **PASSED** |
| **BR-01**   | Header forgery injection (`X-Org-Id`, `X-Tenant-Id`)  | `GET /api/v1/company/templates`                     | Tenant A `company_admin` | `200 OK` (Ignored)      | **PASSED** |
| **BR-01**   | Parameterized route cross-tenant attack               | `GET /api/v1/_test/org/:orgId/ping`                 | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-25**   | Candidate attacking company templates                 | `GET /api/v1/company/templates`                     | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking company assessments               | `GET /api/v1/company/assessments`                   | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking candidates management             | `GET /api/v1/candidates`                            | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking candidates management             | `GET /api/v1/company/candidates`                    | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking artifact download URLs            | `GET /api/v1/storage/download-url/...`              | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking admin console routes              | `GET /api/v1/admin/*`                               | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin attacking platform admin orgs           | `GET /api/v1/admin/organizations`                   | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin provisioning organization               | `POST /api/v1/admin/organizations`                  | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin updating org status                     | `PATCH /api/v1/admin/organizations/:id/status`      | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin attacking master templates              | `GET /api/v1/admin/templates`                       | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin viewing platform metrics                | `GET /api/v1/admin/metrics`                         | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin viewing platform MFA status             | `GET /api/v1/auth/mfa/status`                       | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **Auth**    | Unauthenticated access to protected routes            | Protected routes                                    | Anonymous                | `401 Unauthorized`      | **PASSED** |
| **Auth**    | Tampered session cookie token                         | Protected routes                                    | Attacker                 | `401 Unauthorized`      | **PASSED** |
| **CSRF**    | Ambient session request missing `X-HS-CSRF`           | State-changing routes                               | Authenticated caller     | `403 Forbidden`         | **PASSED** |
| **CSRF**    | Ambient session request missing `Origin`/`Referer`    | State-changing routes                               | Authenticated caller     | `403 Forbidden`         | **PASSED** |
| **CSRF**    | Ambient session request with untrusted `Origin`       | State-changing routes                               | Authenticated caller     | `403 Forbidden`         | **PASSED** |
| **Status**  | Session for suspended user                            | Protected routes                                    | Suspended user           | `403 Forbidden`         | **PASSED** |
| **Status**  | Session for soft-deleted user                         | Protected routes                                    | Deleted user             | `403 Forbidden`         | **PASSED** |
| **Status**  | Session for user in suspended organization            | Protected routes                                    | User in suspended org    | `403 Forbidden`         | **PASSED** |
| **Status**  | Session for removed/nonexistent database user         | Protected routes                                    | Ghost user               | `401 Unauthorized`      | **PASSED** |
| **Status**  | Password login attempt for suspended user             | `POST /api/v1/auth/login`                           | Suspended user           | `403 Forbidden`         | **PASSED** |
| **Status**  | Password login attempt for user in suspended org      | `POST /api/v1/auth/login`                           | User in suspended org    | `403 Forbidden`         | **PASSED** |
| **Matrix**  | Dynamic route matrix verification against Fastify     | All registered routes                               | System                   | Full match (100%)       | **PASSED** |

---

## 4. Endpoints with No Router Match (Router Generic 404s)

The following HTTP methods and paths do not have registered endpoints in the NestJS controllers:

- `PATCH /api/v1/company/templates/:id`
- `DELETE /api/v1/company/templates/:id`
- `PATCH /api/v1/company/assessments/:id` (only `:id/brief` exists)
- `DELETE /api/v1/company/assessments/:id`
- `GET /api/v1/company/candidates/:id`
- `GET /api/v1/candidates/:id`

> **Security Note**: These requests return Fastify's generic HTTP 404 router response for any identifier. They are tested in a separate, explicitly named describe block (`Endpoints with no router match`) and are **never** counted as tenant isolation proofs, nor are they evaluated against the control-first rule.

---

## 5. Skipped Tests & Blockers

The following test cases are intentionally skipped (`describe.skip`) due to pending upstream streams:

1. **Quotes & Billing Isolation (`GET /company/quotes`, `GET /company/quotes/:id`)**:
   - _Blocker_: Quoting engine and commercial pricing entities are scheduled for **Stream 8**.
2. **Submission Grading Isolation (`GET /company/submissions/:id`)**:
   - _Blocker_: Submission deliverables entity and AI review aggregator are scheduled for **Stream 5**.
3. **Candidate Assignment Launch (`POST /company/assignments/:id/start`)**:
   - _Blocker_: Candidate workspace provisioning orchestrator is scheduled for **Stream 2**.

---

## 6. Security Findings & Recommendations

### Finding 1: `DevTestController` Registration Condition

- **Severity**: Low (Architectural hardening recommendation)
- **Location**: `apps/api/src/app.module.ts`, Line 39
- **Description**: `DevTestController` (`/_test/*`) is registered via `const devControllers = process.env.NODE_ENV === 'production' ? [] : [DevTestController];`.
- **Risk**: If a production deployment starts with `NODE_ENV` undefined or misconfigured as `development` or `test`, dev test routes (`/_test/ping`, `/_test/mutate`) become reachable in production.
- **Recommendation**: Invert the condition to fail closed (`NODE_ENV === 'development' || NODE_ENV === 'test' ? [DevTestController] : []`), or exclude `DevTestController` from the production build entirely.

### Finding 2: Suspended Account Disclosure via `/auth/login`

- **Severity**: Informational / Business Logic Clarification
- **Location**: `apps/api/src/modules/auth/auth.service.ts`, Lines 76, 538–555
- **Description**: `assertAccountActive(user)` is executed **before** password verification. When a suspended user or a user belonging to a suspended organization attempts to log in with an incorrect password, the API responds with HTTP 403 `ACCOUNT_SUSPENDED` or `ORG_SUSPENDED`.
- **Risk**: An unauthenticated attacker can probe email addresses to identify whether an account exists and is currently suspended without needing valid credentials.
- **Recommendation / Question for Vishal V**: Confirm whether this disclosure is acceptable for candidate UX or if password verification should occur prior to account suspension checks (or return generic `INVALID_CREDENTIALS` on bad passwords).

### Finding 3: OpenAPI Documentation Drift

- **Severity**: Low (Documentation synchronization)
- **Locations**: `packages/contracts/openapi/openapi.yaml` vs Controller implementations
- **Observations**:
  1. `CandidatesController` serves both `/candidates` and `/company/candidates`, whereas OpenAPI documents only `/company/candidates`.
  2. `AdminTemplatesController` registers `POST /admin/templates/:id/assign/bulk`, `POST /admin/templates/:id/clone`, and `POST /admin/templates/:id/versions/:version/publish`, which are not documented in `openapi.yaml`.
  3. `GET /company/templates/:id` returns `id: template.slug` rather than a UUID in its response DTO.

---

## 7. Local Runbook

### 7.1 Running Tenancy Security Tests Locally

Ensure the test database and Redis services are active:

```bash
# Execute the full tenancy and security test suite
pnpm test:tenancy
```

### 7.2 Verifying Graceful Skip on Offline Database

To confirm that test suites skip cleanly without unhandled rejections when the database is unavailable:

```bash
# Point to an unreachable database port (e.g., 5439)
DATABASE_URL=postgres://hs_app:hs_app_local@127.0.0.1:5439/hellosmart_test pnpm --dir apps/api vitest run --project tenancy
```

_Expected Output_: `Test Files: 3 skipped (3)`, `Tests: 92 skipped (95)`.

### 7.3 Adding New Routes to the Security Matrix

Whenever a new controller or route is introduced into `apps/api/src`:

1. Add the normalized route key (`METHOD /api/v1/path`) and its access classification (`public`, `platform_admin`, `company_admin`, `candidate`, `authenticated`) to `EXPECTED_ROUTE_MATRIX` in `apps/api/test/security/helpers/route-matrix-builder.ts`.
2. Add corresponding control-first and cross-tenant attack cases to `apps/api/test/security/tenancy.spec.ts` or `apps/api/test/security/privilege-escalation.spec.ts`.
3. Run `pnpm test:tenancy` to confirm 100% matrix coverage.

---

## 8. Open Questions for Vishal V

1. **Suspended Account Login Disclosure**: During `/auth/login`, should suspended users receive HTTP 403 `ACCOUNT_SUSPENDED` before password verification (current behavior), or should bad passwords return HTTP 401 `INVALID_CREDENTIALS` regardless of account status to prevent user enumeration?
2. **Dual Candidate Route Prefixes**: `CandidatesController` currently serves both `/candidates` and `/company/candidates`. Should `/candidates` be deprecated in favor of `/company/candidates` for OpenAPI consistency, or should both remain permanently supported?
3. **Template ID vs Slug in Company Portal**: `CompanyTemplatesController.getTemplateById` returns `id: template.slug` (e.g. `tpl_fs_01`), matching the static template catalog keys, while the database primary key is a UUID. Should the response DTO expose both `id` (UUID) and `slug` (string) explicitly?
