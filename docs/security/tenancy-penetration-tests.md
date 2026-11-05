# Multi-Tenant Data Isolation & Security Penetration Testing Runbook

> **Scope**: Ticket [10.1] Multi-Tenant Data Isolation & Security Penetration Tests  
> **Requirements**: BR-01 (Tenant Isolation), BR-02 (Template Privacy), BR-03 (Version Pinning), BR-25 (Route Isolation & RBAC Boundaries) [BR-11 unconfirmed for storage download API]  
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
│                    PostgreSQL Row-Level Security                       │
│   • Runtime role: hs_app (NOBYPASSRLS, restricted permissions)         │
│   • Session configuration: app.org_id set via SET LOCAL per request    │
│   • FORCE ROW LEVEL SECURITY on all tenant tables                      │
│   • Fail-closed: Null or unassigned app.org_id returns 0 rows          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 PostgreSQL Row-Level Security (RLS)

- **Runtime Boundary**: The application pool connects exclusively as `hs_app`, which is explicitly forbidden from holding `BYPASSRLS`.
- **Tenant Context**: Every database transaction sets `SET LOCAL app.org_id = '<uuid>'`. RLS policies evaluate `org_id = current_setting('app.org_id', true)::uuid`.
- **Fail-Closed Default**: If a query executes without setting `app.org_id`, `current_setting('app.org_id', true)` returns `NULL`, filtering all tenant-scoped rows and returning zero results.

### 1.2 Application Guards & Authority

- **SessionGuard**: Validates session cookies against Redis/in-memory session store, extracts caller credentials (`userId`, `orgId`, `role`), and checks live database status for suspended or deleted accounts.
- **RolesGuard**: Enforces RBAC boundaries on routes decorated with `@Roles(...)`. For example, all `/api/v1/admin/*` and `/api/v1/auth/mfa/*` endpoints require the `platform_admin` role.
- **CsrfOriginGuard**: Enforces CSRF token presence (`X-HS-CSRF: 1`) and trusted origin matching (`Origin` header matching configured `CORS_ORIGINS`) on all mutating methods (`POST`, `PUT`, `PATCH`, `DELETE`).
- **OrgScopeGuard**: Validates parameterized routes (`/:orgId`) against the authenticated user's `session.orgId`. Foreign organization IDs return `404 Not Found` with code `TENANT_NOT_FOUND`.

### 1.3 Storage Isolation

- **Prefix Scoping**: Objects are stored under `storage/{orgId}/submissions/{assignmentId}/{objectId}-{filename}`.
- **Scoped Lookup**: When generating download URLs, `StorageService.findKeyByObjectId` scans strictly within `storage/${orgId}/submissions/${assignmentId}/`. Foreign object IDs return `404 Not Found` with message `Artifact not found`.
- **Download Token Verification**: For local filesystem storage, `GET /api/v1/storage/download` requires a signed HMAC token containing `{ key, orgId, exp }`. Forged, tampered, or expired tokens return generic `404 Not Found`.

---

## 2. Security Test Methodology

### 2.1 The Control-First Principle

To prevent false negatives (tests passing because an endpoint is broken, misconfigured, or returning 404 for all callers), every cross-tenant attack test is paired with an identical **control-first** test:

1. **Control Test**: The legitimate owner (Tenant B) requests the resource and asserts `HTTP 200 OK` with valid data.
2. **Attack Test**: The attacker (Tenant A) requests the exact same resource ID and asserts `HTTP 404 Not Found`.

### 2.2 No-Oracle Guarantees

An API must never act as an oracle allowing an attacker to determine whether a resource exists in a foreign tenant:

- The HTTP status code, response headers, and response JSON body returned when Tenant A attacks Tenant B's real resource MUST be indistinguishable from the response returned when Tenant A requests a randomly generated, non-existent UUID.
- The error response structure conforms strictly to RFC 9457 Problem Details.

### 2.3 Zero Data Leakage (`assertZeroTenantLeak`)

Every response body, header, and cookie returned to Tenant A during cross-tenant attacks is recursively scanned for Tenant B identifiers:

- Tenant B organization ID, slug, and display name
- Tenant B user IDs, candidate IDs, and emails
- Tenant B template versions, assessment IDs, and assessment names
- Tenant B storage keys, assignment IDs, and object IDs

If any foreign identifier appears in the attacker's response (outside of the attacked target token echoed in the URL path), the test immediately fails.

### 2.4 Test Data Isolation and Teardown

- Test fixtures create isolated organizations (`sec-alpha-...`, `sec-beta-...`, `sec-susp-...`) using a cryptographically random nonce.
- Teardown executes within a database transaction as table owner `hs_owner`, deleting rows in strict foreign-key dependency order.
- To avoid tripping `BR-03` triggers on template versions (`app.prevent_published_template_version_mutation`), test templates are seeded with status `'draft'`.
- Teardown asserts that the database row count for all created entities returns exactly to zero.

---

## 3. Attack Matrix & Verification Results

| Requirement | Attack Scenario                                                   | Target Endpoint                                     | Attacker Role            | Expected Result         | Status     |
| ----------- | ----------------------------------------------------------------- | --------------------------------------------------- | ------------------------ | ----------------------- | ---------- |
| **BR-02**   | Read Tenant B assigned template by UUID                           | `GET /api/v1/company/templates/:id`                 | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-02**   | Read Tenant B assigned template by slug                           | `GET /api/v1/company/templates/:slug`               | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-02**   | Read unassigned template by UUID                                  | `GET /api/v1/company/templates/:id`                 | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-02**   | Read unassigned template by slug                                  | `GET /api/v1/company/templates/:slug`               | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-02**   | Adversarial slug input (UUID-looking, long, encoded)              | `GET /api/v1/company/templates/:slug`               | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-02**   | Template catalog list leakage                                     | `GET /api/v1/company/templates`                     | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Read Tenant B assessment                                          | `GET /api/v1/company/assessments/:id`               | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Mutate Tenant B assessment brief                                  | `PATCH /api/v1/company/assessments/:id/brief`       | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Assessment list leakage                                           | `GET /api/v1/company/assessments`                   | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Candidate list isolation (`/company/candidates` canonical)        | `GET /api/v1/company/candidates?limit=1000`         | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Candidate list isolation (`/candidates` deprecated alias)         | `GET /api/v1/candidates?limit=1000`                 | Tenant A `company_admin` | `200 OK` (Only A items) | **PASSED** |
| **BR-01**   | Cross-tenant delete candidate (`/company/candidates`)             | `DELETE /api/v1/company/candidates/:id`             | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant delete candidate (`/candidates`)                     | `DELETE /api/v1/candidates/:id`                     | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant update candidate (`/company/candidates`)             | `PATCH /api/v1/company/candidates/:id`              | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant update candidate (`/candidates`)                     | `PATCH /api/v1/candidates/:id`                      | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant resend invite (`/company/candidates`)                | `POST /api/v1/company/candidates/:id/resend-invite` | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Cross-tenant resend invite (`/candidates`)                        | `POST /api/v1/candidates/:id/resend-invite`         | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Mass-assignment tenant injection (`orgId` in body)                | `POST /api/v1/company/candidates`                   | Tenant A `company_admin` | `422 Unprocessable`     | **PASSED** |
| **BR-01**   | Mass-assignment tenant injection (`orgId` in body)                | `POST /api/v1/candidates`                           | Tenant A `company_admin` | `422 Unprocessable`     | **PASSED** |
| **BR-01**   | Storage download URL cross-tenant attack                          | `GET /api/v1/storage/download-url/:asgId/:objId`    | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Storage download URL mixed-pair attack                            | `GET /api/v1/storage/download-url/:asgA/:objB`      | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Storage download URL override via `?orgId=`                       | `GET /api/v1/storage/download-url/...`              | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-01**   | Public storage stream with forged/tampered token                  | `GET /api/v1/storage/download?token=...`            | Anonymous / Public       | `404 Not Found`         | **PASSED** |
| **BR-01**   | Header forgery injection (`X-Org-Id`, `X-Tenant-Id`)              | `GET /api/v1/company/templates`                     | Tenant A `company_admin` | `200 OK` (Ignored)      | **PASSED** |
| **BR-01**   | Parameterized route cross-tenant attack                           | `GET /api/v1/_test/org/:orgId/ping`                 | Tenant A `company_admin` | `404 Not Found`         | **PASSED** |
| **BR-25**   | Candidate attacking company templates                             | `GET /api/v1/company/templates`                     | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking company assessments                           | `GET /api/v1/company/assessments`                   | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking candidates management (`/company/candidates`) | `GET /api/v1/company/candidates`                    | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking candidates management (`/candidates`)         | `GET /api/v1/candidates`                            | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking artifact download URLs                        | `GET /api/v1/storage/download-url/...`              | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Candidate attacking admin console routes                          | `GET /api/v1/admin/*`                               | `candidate`              | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin attacking platform admin orgs                       | `GET /api/v1/admin/organizations`                   | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin provisioning organization                           | `POST /api/v1/admin/organizations`                  | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin updating org status                                 | `PATCH /api/v1/admin/organizations/:id/status`      | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin attacking master templates                          | `GET /api/v1/admin/templates`                       | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin viewing platform metrics                            | `GET /api/v1/admin/metrics`                         | `company_admin`          | `403 Forbidden`         | **PASSED** |
| **BR-25**   | Company admin viewing platform MFA status                         | `GET /api/v1/auth/mfa/status`                       | `company_admin`          | `403 Forbidden`         | **PASSED** |

---

## 4. Endpoints with No Router Match (Router Generic 404s)

The following HTTP methods have no handler declared on the controller and return the router's generic 404. These are tracked separately and are **not** counted as tenant isolation proofs:

1. `PATCH /api/v1/company/templates/:id` -> Generic Router 404
2. `DELETE /api/v1/company/templates/:id` -> Generic Router 404
3. `PATCH /api/v1/company/assessments/:id` -> Generic Router 404
4. `DELETE /api/v1/company/assessments/:id` -> Generic Router 404
5. `GET /api/v1/company/candidates/:id` -> Generic Router 404
6. `GET /api/v1/candidates/:id` -> Generic Router 404

---

## 5. Skipped Tests & Blockers

The following test cases are intentionally skipped (`it.skip`) because the corresponding backend features or architecture decisions are pending:

1. **Commercial Quotes & Invoices (`GET /company/quotes`, `GET /company/quotes/:id`)**:
   - _Blocker_: Quoting and billing entities (`app.quotes`, `app.quote_lines`, `app.invoices`) are not yet implemented in backend.
2. **Submission Deliverables & Agent Grading (`GET /company/submissions/:id`)**:
   - _Blocker_: Candidate submission entities (`app.submissions`, `app.agent_runs`) and review aggregator are not yet implemented in backend.
3. **Candidate Assignment & Workspace Session Launch (`POST /company/assignments/:id/start`)**:
   - _Blocker_: Candidate workspace provisioning orchestrator and `app.assignments` are not yet implemented in backend.
4. **Suspended Account Bad-Password Login Order**:
   - _Blocker_: Decision pending on login verification order (`recommended, to be confirmed by Vishal V`).
5. **Suspended Account Correct-Password Login Order**:
   - _Blocker_: Decision pending on login verification order (`recommended, to be confirmed by Vishal V`).
6. **DevTestController Fail-Closed Exclusion**:
   - _Blocker_: Registration condition hardening in `app.module.ts` (`recommended, to be confirmed by Vishal V`).

---

## 6. Security Findings & Recommendations

### Finding 1: `DevTestController` Registration Condition (Fail-Closed Hardening)

- **Severity**: Low (Architectural hardening recommendation)
- **Location**: `apps/api/src/app.module.ts`, Line 39
- **Description**: `DevTestController` (`/_test/*`) is currently registered via:
  ```ts
  const devControllers = process.env.NODE_ENV === 'production' ? [] : [DevTestController];
  ```
- **Risk**: This is a **fail-open** construct. If a deployment starts with `NODE_ENV` undefined, misspelled, or set to `staging`, test controllers (`/_test/ping`, `/_test/mutate`) become reachable in that environment.
- **Recommendation (to be confirmed by Vishal V)**: Invert the condition to fail-closed opt-in:
  ```ts
  const devControllers =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
      ? [DevTestController]
      : [];
  ```

### Finding 2: Suspended Account Status Disclosure via `/auth/login`

- **Severity**: Low / Information Disclosure (Business Logic Clarification)
- **Location**: `apps/api/src/modules/auth/auth.service.ts`, Lines 76, 538–555
- **Description**: In `AuthService.loginWithPassword()`, `assertAccountActive(user)` executes **prior** to password verification. When a suspended user or a user belonging to a suspended organization attempts to log in with an incorrect password, the API immediately returns HTTP 403 `ACCOUNT_SUSPENDED` or `ORG_SUSPENDED`.
- **Risk**: An unauthenticated attacker can probe arbitrary email addresses to enumerate which users and organizations exist and are currently suspended, without possessing valid credentials.
- **Recommendation (to be confirmed by Vishal V)**: Verify the password first, and only return `403 ACCOUNT_SUSPENDED` or `ORG_SUSPENDED` when the password is valid. If the password is incorrect, return generic HTTP 401 `INVALID_CREDENTIALS` identical in timing and schema to an unknown user. (Two skipped tests are ready in `privilege-escalation.spec.ts` once agreed).

### Finding 3: OpenAPI Documentation Drift

- **Severity**: Low (Documentation synchronization)
- **Locations**: `packages/contracts/openapi/openapi.yaml` vs Controller implementations
- **Observations**:
  1. `CandidatesController` serves both `/candidates` and `/company/candidates`, whereas OpenAPI documents only `/company/candidates`.
  2. `AdminTemplatesController` registers `POST /admin/templates/:id/assign/bulk`, `POST /admin/templates/:id/clone`, and `POST /admin/templates/:id/versions/:version/publish`, which are not documented in `openapi.yaml`.
  3. `GET /company/templates/:id` returns `id: template.slug` rather than a UUID in its response DTO.
- **Recommendation (to be confirmed by Vishal V)**: Update `openapi.yaml` to include missing endpoints and deprecate the `/candidates` root prefix.

### Finding 4: Template Lookup by UUID vs Slug

- **Severity**: Informational / Architecture Consistency
- **Location**: `apps/api/src/modules/templates/templates.repository.ts`, Line 131
- **Description**: `CompanyTemplatesController.getTemplateById` queries PostgreSQL with `WHERE (t.id::text = $2 OR t.slug = $2) AND ta.org_id = $1`. It accepts both a UUID or a slug string (e.g. `sec-tpl-b-...` or `tpl_fs_01`).
- **Verification**: Tests confirm that Tenant A cannot access Tenant B templates by either UUID or slug, and cannot access unassigned templates by either form.
- **Recommendation (to be confirmed by Vishal V)**: Update the OpenAPI schema for `GET /company/templates/{id}` parameter description to state `idOrSlug: string` to avoid caller confusion.

### Finding 5: `/candidates` Alias Deprecation

- **Severity**: Low (API consistency)
- **Location**: `apps/api/src/modules/candidates/candidates.controller.ts`
- **Description**: `CandidatesController` is decorated with `@Controller(['candidates', 'company/candidates'])`.
- **Recommendation (to be confirmed by Vishal V)**: Formally deprecate `/candidates` in favor of `/company/candidates`. In our test helpers, both prefixes are defined in `CANDIDATE_ROUTE_PREFIXES` so that removing the alias in the future is a single-line edit.

---

## 7. Local Runbook

### 7.1 Running Tenancy Security Tests Locally

Ensure the test database and Redis services are active:

```bash
# Execute the full tenancy and security test suite
pnpm test:tenancy
```

_Expected Output_: `Test Files: 3 passed (3)`, `Tests: 105 passed | 6 skipped (111)`.

### 7.2 Verifying Graceful Skip on Offline Database

To confirm that test suites skip cleanly without unhandled rejections when the database is unavailable:

```bash
# Point to an unreachable database port (e.g., 5439)
DATABASE_URL=postgres://hs_app:hs_app_local@127.0.0.1:5439/hellosmart_test pnpm --dir apps/api vitest run --project tenancy
```

_Expected Output_: `Test Files: 3 skipped (3)`, `Tests: 111 skipped (111)`.

### 7.3 Adding New Routes to the Security Matrix

Whenever a new controller or route is introduced into `apps/api/src`:

1. Add the normalized route key (`METHOD /api/v1/path`) and its access classification (`public`, `platform_admin`, `company_admin`, `candidate`, `authenticated`) to `EXPECTED_ROUTE_MATRIX` in `apps/api/test/security/helpers/route-matrix-builder.ts`.
2. Add corresponding control-first and cross-tenant attack cases to `apps/api/test/security/tenancy.spec.ts` or `apps/api/test/security/privilege-escalation.spec.ts`.
3. Run `pnpm test:tenancy` to confirm 100% matrix coverage.

---

## 8. Open Questions for Vishal V

1. **Suspended Account Login Disclosure**: During `/auth/login`, should suspended users receive HTTP 403 `ACCOUNT_SUSPENDED` before password verification (current behavior), or should bad passwords return HTTP 401 `INVALID_CREDENTIALS` regardless of account status to prevent user enumeration? (Recommended: verify password first).
2. **Dual Candidate Route Prefixes**: `CandidatesController` currently serves both `/candidates` and `/company/candidates`. Should `/candidates` be deprecated in favor of `/company/candidates` for OpenAPI consistency, or should both remain permanently supported? (Recommended: deprecate `/candidates`).
3. **Template ID vs Slug in Company Portal**: `CompanyTemplatesController.getTemplateById` returns `id: template.slug` (e.g. `tpl_fs_01`), matching the static template catalog keys, while the database primary key is a UUID. Should the response DTO expose both `id` (UUID) and `slug` (string) explicitly? (Recommended: expose both).
4. **DevTestController Registration**: In `app.module.ts`, `DevTestController` is excluded only when `NODE_ENV === 'production'`. Should this be inverted to fail-closed opt-in for `development` and `test`? (Recommended: fail-closed opt-in).
5. **OpenAPI Route Completeness**: `AdminTemplatesController` registers several bulk and publish endpoints not yet in `openapi.yaml`. Should these be added to the OpenAPI contract? (Recommended: sync `openapi.yaml`).
