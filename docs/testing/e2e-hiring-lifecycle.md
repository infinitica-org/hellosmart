# E2E UI Journey: Company Setup to Candidate Submission

> **Ticket**: [10.4] Playwright E2E UI Journey: Company Setup to Candidate Submission  
> **Test Suite**: `apps/web/e2e/hiring-lifecycle.spec.ts`  
> **Configuration**: `apps/web/playwright.config.ts`  
> **Target Database**: `hellosmart_test` ONLY (isolated test database)

---

## 1. Journey Architecture & Step Status

The E2E hiring lifecycle test exercises the complete flow from organization provisioning and template customization to candidate bulk ingestion, email invitation acceptance, password setup, role-based login routing, and route isolation.

### Real vs. Skipped Steps Matrix

| Journey Step                       | Implementation Status | Blocker / Reason                                                                                          | Verified AGENTS.md ID      |
| ---------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Step 1a: Admin Login**           | **REAL (PASS)**       | Authenticates company admin via two-step login on `/login`.                                               | `CO-001`                   |
| **Step 1b: Template Catalog**      | **REAL (PASS)**       | Selects assigned synthetic template card on `/company/templates` and triggers slide-out drawer.           | `CO-003`, `BR-02`          |
| **Step 1c: 3-Step Wizard**         | **REAL (PASS)**       | Configures assessment details, instructions, timing, and confirms creation on `/company/assessments/new`. | `CO-004`, `BR-03`          |
| **Step 1d: Rubric Customizer**     | **REAL (PASS)**       | Adjusts dimension weights on `/company/assessments/:id/rubric` maintaining 100% weight balance.           | `CO-006`, `BR-18`          |
| **Step 1e: Publish Assessment**    | **SKIPPED (fixme)**   | Backend lacks `POST /assessments/:id/publish` on Fastify, and UI has no publish button.                   | `CO-025`                   |
| **Step 2: Candidate Bulk CSV**     | **REAL (PASS)**       | Uploads synthetic CSV (3 valid + 1 invalid), previews, confirms import, verifies database count = 3.      | `CO-012`, `BR-06`, `BR-24` |
| **Step 3a: Read Mailpit Invite**   | **REAL (PASS)**       | Reads real invitation email via Mailpit API (`:8025`), parses token, deletes test message.                | `CA-001`, `BR-24`          |
| **Step 3b: Password Setup**        | **REAL (PASS)**       | Opens `/accept-invite?token=...`, sets compliant password, submits to `/api/auth/invitations/accept`.     | `CA-001`, `BR-24`          |
| **Step 3c: Candidate Login**       | **REAL (PASS)**       | Candidate logs in with new password at `/login`; server redirects to `/candidate`.                        | `CA-002`, `BR-25`          |
| **Step 3c-2: Token Invalidation**  | **REAL (PASS)**       | Re-opening consumed invite link verifies `Invitation Unavailable` alert.                                  | `BR-24`                    |
| **Step 3d: Diagnostic Pre-check**  | **SKIPPED (fixme)**   | Candidate diagnostic pre-check wizard component is unbuilt in web application.                            | `unconfirmed`              |
| **Step 3e: Candidate Consent**     | **SKIPPED (fixme)**   | Candidate mode-based consent view and `POST /candidate/assignments/:id/consent` unbuilt.                  | `CA-007`, `BR-12`          |
| **Step 4: Workspace Simulation**   | **SKIPPED (fixme)**   | Cloud VM / container runtime orchestrator and `POST /candidate/workspaces/:id/submit` unbuilt.            | `CA-005`, `CA-018`         |
| **Step 5: Submission Review**      | **SKIPPED (fixme)**   | Candidate review card and presigned download URL require completed workspace submission.                  | `CO-042`                   |
| **Step 6: Route & Role Isolation** | **REAL (PASS)**       | Guest redirected to `/login`; candidate denied `/company` and `/admin`; admin denied `/admin`.            | `BR-25`                    |

---

## 2. Environment Prerequisites & Browser Installation

### 2.1 Chromium Browser Installation

Install the headless Chromium browser binary and necessary Linux shared libraries in WSL:

```bash
# 1. Install Chromium browser binary (takes ~30-60s)
timeout 600 pnpm --filter @hs/web exec playwright install chromium

# 2. Install Linux shared library dependencies (if missing, requires root/sudo)
# Note: In WSL Ubuntu, execute with root elevation if sudo prompts for password:
wsl -u root -d Ubuntu -e bash -c "cd /home/vedika/hellosmart && pnpm exec playwright install-deps chromium"
```

Verified Chromium Version: `156.0.8078.4` (Playwright version `1.64.1`).

---

## 3. How to Start the Stack

The test requires Mailpit (email capture), PostgreSQL (`hellosmart_test`), Redis, the NestJS Fastify API, and the Next.js web application.

### 3.1 Start Docker Infrastructure

```bash
docker compose up -d postgres redis mailpit
```

- PostgreSQL container listens on ports `5432` and `5434` (both map to the same database engine).
- Mailpit UI / API: `http://127.0.0.1:8025`.
- Redis: `127.0.0.1:6379`.

### 3.2 Build API Distribution (if missing or stale)

```bash
timeout 600 pnpm --filter @hs/api build
```

### 3.3 Start the API Server

Start the API in the background pointing exclusively at `hellosmart_test` with credentials supplied via the command line (never editing `.env`):

```bash
/usr/bin/setsid bash -c '
export NODE_ENV=development
export PORT=4000
export LOG_LEVEL=info
export DATABASE_URL="postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart_test"
export DATABASE_PLATFORM_URL="postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test"
export DATABASE_MIGRATOR_URL="postgres://hs_migrator:hs_migrator_local@127.0.0.1:5432/hellosmart_test"
export SESSION_SECRET="test_session_secret_at_least_32_characters_long_hello"
export CORS_ORIGINS="http://localhost:3000"
export EMAIL_PROVIDER="fake"
export MAILPIT_URL="http://127.0.0.1:8025"
export STORAGE_DRIVER="local"
mkdir -p /tmp/hs_storage
export STORAGE_LOCAL_ROOT="/tmp/hs_storage"
export REDIS_URL="redis://:hs_redis_local@127.0.0.1:6379"
export APP_BASE_URL="http://localhost:3000"
cd /home/vedika/hellosmart/apps/api
exec node dist/main.js
' </dev/null > /tmp/e2e-api.log 2>&1 &
```

Health check: `curl -fsS http://127.0.0.1:4000/api/v1/health` (returns `{"status":"ok"}`).

### 3.4 Start the Web Application

```bash
/usr/bin/setsid bash -c '
export NODE_ENV=development
export PORT=3000
export API_BASE_URL="http://localhost:4000"
export APP_BASE_URL="http://localhost:3000"
export NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"
cd /home/vedika/hellosmart/apps/web
exec pnpm dev
' </dev/null > /tmp/e2e-web.log 2>&1 &
```

Warmup check: `curl -fsS http://127.0.0.1:3000/login` (waits for Next.js first-compile).

---

## 4. Running the Tests

### 4.1 Headless Execution (Default)

```bash
pnpm --filter @hs/web test:e2e:journey
```

With single-failure exit while debugging:

```bash
pnpm --filter @hs/web test:e2e:journey -- --max-failures=1
```

### 4.2 Headed Execution

```bash
pnpm --filter @hs/web test:e2e:journey -- --headed
```

### 4.3 Opening the HTML Report

```bash
pnpm --filter @hs/web exec playwright show-report playwright-report
```

---

## 5. Security & Isolation Controls

1. **Local Host Hard Refusal**:
   `apps/web/playwright.config.ts` enforces that `E2E_BASE_URL`, `API_BASE_URL`, and `DATABASE_MIGRATOR_URL` resolve to `localhost` or `127.0.0.1`. Any external host triggers an immediate error before any browser opens or any database queries execute.
2. **Fail-Fast Health Check**:
   `apps/web/e2e/helpers/global-setup.ts` probes `http://localhost:3000/login` and `http://127.0.0.1:4000/api/v1/health` with a 10s timeout, failing fast with an actionable diagnostic message if either service is unreachable.
3. **Database Scoping**:
   All test setup and execution targets `hellosmart_test`. Row counts in `hellosmart` (dev database) are asserted before and after to verify 0 row drift.
4. **Synthetic Data & Reverse Teardown**:
   All test emails use reserved domain `@example.test`. Teardown runs with the admin database role (`hs_owner`) in reverse dependency order:
   `assessments` &rarr; `invitations` &rarr; `users` &rarr; `template_assignments` &rarr; `template_versions` &rarr; `templates` &rarr; `entitlements` &rarr; `organizations`.
5. **No Secret Leakage**:
   `trace: 'off'`, `video: 'off'`, and `screenshot: 'off'` are set by default to prevent leaking session tokens, passwords, or cookies to disk artifacts.

---

## 6. How the Invite Link is Handled

1. Company Admin bulk-uploads a synthetic CSV containing `Alice Smith` with email `candidate1.<id>@example.test`.
2. The Fastify API dispatches an invitation email using the configured Mailpit endpoint (`http://127.0.0.1:8025/api/v1/send`).
3. `getInviteLinkFromMailpit` polls `http://127.0.0.1:8025/api/v1/messages` for candidate recipient.
4. It fetches `/api/v1/message/:id`, regex-matches the accept-invite link (`/accept-invite?token=...`), and deletes the message from Mailpit by ID via `DELETE /api/v1/messages`.
5. The raw token is opened in a new, unauthenticated browser context (`browser.newContext()`) ensuring complete session cookie isolation from the company admin.

---

## 7. Flakiness Risks & Mitigations

1. **Next.js On-Demand Compilation Lag**:
   - _Risk_: First page visit compiles dozens of modules on-demand, causing premature Playwright timeout.
   - _Mitigation_: Stack warmup script curls `/login` prior to running tests, and test timeout is explicitly set to 120s with 30s navigation timeout.
2. **Soft Router Navigation Timing**:
   - _Risk_: `page.waitForURL` with default `'load'` state times out during Next.js `router.push()` soft navigations.
   - _Mitigation_: Tests use `await expect(page).toHaveURL(...)` which polls browser URL without requiring document reload events.
3. **Database RLS & Immutability Triggers**:
   - _Risk_: `prevent_published_template_mutation()` trigger prevents deleting published template versions during teardown.
   - _Mitigation_: Administrative cleanup in `db-helper.ts` executes `SET LOCAL session_replication_role = replica;` inside a transaction to guarantee 100% clean teardown.

---

## 8. Missing Test IDs (Feedback for Web Team)

The journey currently relies on accessible roles, labels, and text locators. Adding the following `data-testid` attributes will improve locator stability:

1. `data-testid="template-card-{templateSlug}"`: In `/company/templates` grid for selecting specific templates without text matching.
2. `data-testid="template-preview-button"`: On template card to open slide-out drawer.
3. `data-testid="bulk-upload-dialog"`: On candidates bulk upload modal container.
4. `data-testid="bulk-upload-file-input"`: On the hidden `<input type="file">`.
5. `data-testid="bulk-upload-submit-btn"`: On the "Import Candidates" confirmation button.
6. `data-testid="candidate-status-badge-{email}"`: On candidate rows to assert status (`Invited`, `Active`).
7. `data-testid="set-password-submit-btn"`: On password setup form.
8. `data-testid="assessment-row-{assessmentId}"`: In `/company/assessments` table (once the assessment table is implemented).

---

## 9. Implementation Checklist for Unbuilt Features

For developers implementing Phase 2 simulation and submission features:

- [ ] **Assessment Publish (`CO-025`)**:
  - Implement `POST /api/v1/company/assessments/:id/publish` on Fastify API.
  - Add "Publish Assessment" button to `/company/assessments/[id]` view.
  - Assert status transitions from `draft` &rarr; `published`.
- [ ] **Candidate Diagnostic Pre-check (`unconfirmed`)**:
  - Build browser capability check (webcam, screen share, network latency) prior to candidate launch.
- [ ] **Mode-based Candidate Consent (`CA-007`, `BR-12`)**:
  - Build candidate consent modal prior to entering workspace simulation.
  - Implement `POST /api/v1/candidate/assignments/:id/consent` recording IP, timestamp, and text version.
- [ ] **Candidate Cloud Workspace & Brief (`CA-005`, `CA-018`)**:
  - Integrate cloud VM container orchestrator launching ephemeral workspace.
  - Build in-workspace candidate brief panel and file explorer.
  - Implement `POST /api/v1/candidate/workspaces/:id/submit` with solution zip packaging.
- [ ] **Company Submission Review (`CO-042`)**:
  - Build `/company/assessments/[id]/candidates/[candidateId]` submission detail view.
  - Render reviewer agent scores, evidence citations, and presigned download URL for candidate artifacts.

---

> **Note on CI**: This ticket intentionally does NOT modify CI workflows or root configuration; it adds the standalone journey test and `test:e2e:journey` script to `@hs/web`.
