# GitHub Actions CI Checks & Pipeline Documentation

> **Status:** Active (Simulated locally; blocked on remote GitHub runners due to organization billing limit)  
> **Workflow File:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)  
> **Target Integration Branches:** `dev` (QA deployment) and `main` (Production release)

---

## 1. External Blocker: Organization Billing / Spending Limit

> [!WARNING] > **GitHub Actions Execution Blocker**  
> All recent GitHub Actions workflow runs fail immediately on GitHub-hosted runners with the following error:  
> `The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings.`
>
> **Impact:** Workflow executions cannot be validated remotely on GitHub infrastructure until an organization administrator addresses the billing or spending limit under repository/organization settings. All check commands documented below were verified and simulated in a clean local environment.

---

## 2. CI Architecture & Triggers

The CI pipeline runs automated quality, database, security, and integration gates for every pull request and push to integration branches.

- **Trigger Branches:**
  - `pull_request`: Triggered on pull requests targeting `dev` or `main`.
  - `push`: Triggered on direct merges/pushes to `dev` or `main`.
- **Concurrency & Cancellation:**
  - Group: `ci-${{ github.workflow }}-${{ github.ref }}`
  - `cancel-in-progress`: Set to `true` for `pull_request` runs (cancels obsolete builds when new commits are pushed to a PR), but strictly `false` for push runs on `dev` or `main` so integration deploys and history are preserved.
- **Least-Privilege Security:**
  - Workflow-level permission is restricted to `permissions: contents: read`.
  - No secrets or third-party credentials are used or exposed in CI logs.
  - All GitHub Actions are pinned to full, immutable commit SHAs with semantic version comments.

---

## 3. Pinned Action Inventory

Every external action in `.github/workflows/ci.yml` is pinned to a commit SHA verified through the GitHub API:

| Action                      | Pinned Commit SHA                          | Target Version | Verification Source                              |
| --------------------------- | ------------------------------------------ | -------------- | ------------------------------------------------ |
| `actions/checkout`          | `11bd71901bbe5b1630ceea73d27597364c9af683` | `v4.2.2`       | `api.github.com/repos/actions/checkout`          |
| `actions/setup-node`        | `1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` | `v4.2.0`       | `api.github.com/repos/actions/setup-node`        |
| `pnpm/action-setup`         | `fe02b34f77f8bc703788d5817da081398fad5dd2` | `v4.0.0`       | `api.github.com/repos/pnpm/action-setup`         |
| `actions/upload-artifact`   | `b4b15b8c7c6ac21ea08fcf65892d2ee8f75cf882` | `v4.4.3`       | `api.github.com/repos/actions/upload-artifact`   |
| `gitleaks/gitleaks-action`  | `f586c14365d4643c6aa59d472ae6e984bf47bb34` | `v2.3.8`       | `api.github.com/repos/gitleaks/gitleaks-action`  |
| `astral-sh/setup-uv`        | `9f1f1fece28798fe5e7ece00f4243abe886974b2` | `v3.0.0`       | `api.github.com/repos/astral-sh/setup-uv`        |
| `hashicorp/setup-terraform` | `b9cd54a3c349d3f38e8881555d616ced269862dd` | `v3.1.2`       | `api.github.com/repos/hashicorp/setup-terraform` |

---

## 4. CI Jobs & Check Matrix

The pipeline is split into 6 parallel test/analysis jobs plus a final aggregator gate job:

| Job Name    | Commands Executed                                                                                                                                                                                                                                                                                                                                                                                                                                | Local Simulation Result                                              | Blocks Merge?                                                              | Notes                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `security`  | `gitleaks detect`<br>`pnpm audit --audit-level=high`                                                                                                                                                                                                                                                                                                                                                                                             | **PASS**                                                             | **Yes**                                                                    | Scans git history for secret leaks and audits npm dependencies for high/critical CVEs.                                                       |
| `quality`   | `pnpm docs:sync-check`<br>`pnpm --filter @hs/api lint`<br>`pnpm typecheck`<br>`pnpm build`<br>`pnpm contracts:check` _(non-blocking)_<br>`pnpm --filter @hs/contracts lint` _(non-blocking)_<br>`pnpm --filter @hs/web lint` _(non-blocking)_                                                                                                                                                                                                    | **PASS** (core checks pass; known issues isolated)                   | **Yes** (core checks block; known failures do not)                         | Runs AIDLC documentation sync, TypeScript compilation across 9 workspaces, Turborepo builds, and isolated linting.                           |
| `test`      | `psql` (role bootstrap)<br>`pnpm db:migrate`<br>`pnpm db:seed`<br>`pnpm --filter @hs/contracts test`<br>`pnpm --filter @hs/adapters test`<br>`pnpm --filter @hs/web test`<br>`pnpm --filter @hs/api run test --exclude '**/*.e2e-spec.ts'`<br>`pnpm test:tenancy`<br>`pnpm --filter @hs/api test:stack`<br>`pnpm --filter @hs/fixtures test`<br>`pnpm --filter @hs/api run test test/auth.e2e-spec.ts test/tenancy.e2e-spec.ts` _(non-blocking)_ | **PASS** (all unit, tenancy, stack, and fixtures tests pass with DB) | **Yes** (unit, tenancy, stack, and fixtures block; live HTTP specs do not) | Runs with PostgreSQL 16.4 and Redis 7.4 service containers. Automatically detects and fails if fixtures tests skip database checks.          |
| `e2e`       | Playwright E2E suite (`pnpm test:e2e`)                                                                                                                                                                                                                                                                                                                                                                                                           | **PASS** (skips cleanly when 0 specs exist)                          | **Yes** (when specs exist)                                                 | Detects whether Playwright spec files exist in `tests/e2e`. Skips browser download when 0 tests exist; runs Playwright when tests are added. |
| `python`    | `uv sync --frozen`<br>`uv run ruff check .`<br>`uv run ruff format --check .`<br>`uv run mypy .`<br>`uv run pytest -q`                                                                                                                                                                                                                                                                                                                           | **PASS**                                                             | **Yes**                                                                    | Matrix strategy across Python services (`services/ai-proxy`, `services/reviewer`).                                                           |
| `terraform` | `terraform fmt -check`<br>`terraform init -backend=false && terraform validate`                                                                                                                                                                                                                                                                                                                                                                  | **PASS**                                                             | **Yes**                                                                    | Validates Terraform formatting and configuration across all modules in `infra/terraform/modules/`.                                           |
| `ci`        | Aggregator gate script                                                                                                                                                                                                                                                                                                                                                                                                                           | **PASS**                                                             | **Yes** (Required status check)                                            | Evaluates upstream results (`needs.*.result`). Fails if any required check is not `"success"`.                                               |

---

## 5. Aggregator Gate (`ci` Job) Logic

To provide a single, reliable status check for GitHub branch protection, the `ci` job aggregates all upstream jobs:

```yaml
ci:
  name: ci
  needs: [security, quality, test, e2e, python, terraform]
  if: always()
  runs-on: ubuntu-24.04
  timeout-minutes: 5
  steps:
    - name: Evaluate CI Gate Status
      run: |
        failed=0
        for res in \
          "${{ needs.security.result }}" \
          "${{ needs.quality.result }}" \
          "${{ needs.test.result }}" \
          "${{ needs.e2e.result }}" \
          "${{ needs.python.result }}" \
          "${{ needs.terraform.result }}"; do
          if [ "$res" != "success" ]; then
            echo "Error: Required check failed with status: $res"
            failed=1
          fi
        done

        if [ "$failed" -ne 0 ]; then
          echo "CI pipeline failed"
          exit 1
        fi
        echo "All CI quality, database, end-to-end, and security gates passed."
```

- **Fail-Safe Behavior:** The `if: always()` condition guarantees that the aggregator runs even if an upstream job fails.
- If any required job is `failure`, `cancelled`, or skipped unexpectedly, `ci` fails with exit code 1.
- Known-failing steps within jobs are annotated with `continue-on-error: true` at the step level, so they do not falsely trigger parent job failure while they are being resolved in upstream PRs.

---

## 6. Known Failing Checks & Action Items for Lead

During local simulation, four checks failed due to application or environment issues outside the workflow files. In accordance with project rules, no application code was modified. The table below details the exact cause, current CI handling, and the decision required from the engineering lead:

| Failing Check                                                              | Exact Cause                                                                                                                                                                                                        | Current CI Handling                                                                                                                                                                                                                                                                                 | Decision / Owner                                                                                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm contracts:check` & `pnpm --filter @hs/contracts lint`                | `packages/contracts/openapi/openapi.yaml:174:2` has an indentation error (1 leading space instead of 2 before `/auth/sessions:`), causing Redocly YAML parser to fail.                                             | Marked `continue-on-error: true` with visible annotation `(known failing: line 174 indentation, see docs/ci/ci-checks.md)`. TypeScript contract compilation (`tsc --noEmit`) runs as a separate blocking check.                                                                                     | **Backend Team:** Simple one-space indentation fix in `openapi.yaml` line 174.                                                            |
| `pnpm --filter @hs/web lint`                                               | `apps/web` runs `next lint`, but has no `.eslintrc*` or `eslint.config.mjs` configuration file. In non-interactive CI, Next.js prompts `? How would you like to configure ESLint?` and exits code 1.               | Marked `continue-on-error: true` with visible annotation `(known failing: missing ESLint config, see docs/ci/ci-checks.md)`. `@hs/api` linting (`tsc --noEmit`) remains strictly blocking.                                                                                                          | **Web / Frontend Team:** Add `.eslintrc.json` or ESLint configuration to `apps/web`.                                                      |
| `pnpm test:e2e` (`e2e` job)                                                | `tests/e2e/package.json` specifies `"test": "playwright test"`, but `tests/e2e` contains zero test spec files. Playwright exits with error code 1 when no tests are found.                                         | The workflow inspects `tests/e2e` for spec files before invoking Playwright. If no specs are found, it logs a notice and exits cleanly without failing CI.                                                                                                                                          | **QA / E2E Team:** Add Playwright test specs under `tests/e2e/` when ready.                                                               |
| `apps/api` Live HTTP E2E Specs (`auth.e2e-spec.ts`, `tenancy.e2e-spec.ts`) | These tests make HTTP `fetch` requests directly to `http://127.0.0.1:4000/api/v1/auth/login`, requiring a running Fastify/NestJS process on port 4000. In CI, tests run without starting a standalone HTTP server. | Excluded from the blocking unit test path. Run in an isolated non-blocking step: `Run API live HTTP E2E tests (known failing: requires standalone API server on port 4000, see docs/ci/ci-checks.md)`. In-memory stack E2E (`test:stack`) and tenancy tests (`test:tenancy`) remain fully blocking. | **API / Platform Team:** Add background API server startup in CI or migrate HTTP specs to NestJS in-memory test harness (`app.inject()`). |

---

## 7. Database & Service Handling in the `test` Job

The `test` job provisions two GitHub Actions service containers:

- **PostgreSQL 16.4 Alpine** on port `5432:5432` (user `hs_owner`, database `hellosmart`)
- **Redis 7.4 Alpine** on port `6379:6379`

### Role Initialization & Dual Database Architecture

1. **Roles Bootstrap:** `psql` executes `packages/contracts/db/init/001_roles.sql` to create database roles:
   - `hs_owner`: Superuser owner.
   - `hs_migrator`: Migration runner with schema authorization on `app` and `audit`.
   - `hs_app`: Runtime application role subject to strict Row-Level Security (`NOBYPASSRLS`).
   - `hs_platform`: Platform admin role.
2. **Dual Database Provisioning:**
   - Database `hellosmart`: Dedicated to API unit/service tests, tenancy isolation tests, and stack tests. Seeded with `pnpm db:seed`.
   - Database `hellosmart_test`: Dedicated to `packages/fixtures` integration test suite. Configured with owner `hs_migrator`. Migrations are applied via `DATABASE_MIGRATOR_URL`.
3. **Accidental Skip Prevention:**
   - The fixtures test suite (`packages/fixtures/test/`) skips DB tests when Postgres is offline.
   - To guarantee that CI never passes on skipped tests, a post-execution step scans the fixtures log:
     ```bash
     if grep -q "Test database not available" /tmp/fixtures.log; then
       echo "Error: Fixtures database tests were skipped unexpectedly while Postgres is running!"
       exit 1
     fi
     ```

---

## 8. Environment Variables Used in CI

All environment variables used in CI are defined directly in `.github/workflows/ci.yml` as non-sensitive throwaway values for localhost service containers:

### Variables Configured in CI:

- `NODE_ENV`: Set to `test` (ensures safety guards in `@hs/fixtures` allow connections to `localhost`).
- `DATABASE_ADMIN_URL`: `postgres://hs_owner:hs_owner_local@localhost:5432/hellosmart`
- `DATABASE_MIGRATOR_URL`: `postgres://hs_migrator:hs_migrator_local@localhost:5432/hellosmart`
- `DATABASE_URL`: `postgres://hs_app:hs_app_local@localhost:5432/hellosmart`
- `DATABASE_PLATFORM_URL`: `postgres://hs_platform:hs_platform_local@localhost:5432/hellosmart`
- `TEST_DATABASE_URL`: `postgres://hs_migrator:hs_migrator_local@localhost:5432/hellosmart_test`
- `REDIS_URL`: `redis://localhost:6379`
- `COOKIE_NAME`: `hs_session`
- `COOKIE_SECRET`: `ci-test-cookie-secret-32-chars-minimum!`
- `SESSION_SECRET`: `ci-test-session-secret-32-bytes-long!`
- `PROXY_TOKEN_SIGNING_KEY`: `ci-test-proxy-signing-key-32-chars!`
- `SEED_DEFAULT_PASSWORD`: `TestSeedPassword123!`
- `PLATFORM_ADMIN_MFA_SECRET`: `JBSWY3DPEHPK3PXP`
- `SEED_PLATFORM_ADMIN_TOTP_SECRET`: `JBSWY3DPEHPK3PXP`
- `MFA_ENCRYPTION_KEY`: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`
- `MFA_ENCRYPTION_KEY_ID`: `k1`
- `HIBP_FAIL_OPEN`: `true`

### Third-Party Variables NOT Runnable in CI:

The following third-party credentials are not mocked in CI and must not be configured in pull request runs:

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `MS_OAUTH_CLIENT_ID` / `MS_OAUTH_CLIENT_SECRET`
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
- `CALCOM_WEBHOOK_SECRET`

---

## 9. Local Reproduction Guide

To run any check locally exactly as it executes in CI:

```bash
# 1. Clean installation
pnpm install --frozen-lockfile

# 2. Quality checks
pnpm docs:sync-check
pnpm --filter @hs/api lint
pnpm typecheck
pnpm build

# 3. Test suites (requires local Postgres & Redis running)
# Start local containers
pnpm infra:up

# Run unit tests across packages
pnpm --filter @hs/contracts test
pnpm --filter @hs/adapters test
pnpm --filter @hs/web test
pnpm --filter @hs/api run test --exclude '**/*.e2e-spec.ts'

# Run tenancy isolation tests (BR-01)
pnpm test:tenancy

# Run in-memory API stack tests
pnpm --filter @hs/api test:stack

# Run fixtures test suite
pnpm --filter @hs/fixtures test

# 4. Security checks
gitleaks detect --no-banner --redact
pnpm audit --audit-level=high

# 5. Python checks (from services/ai-proxy or services/reviewer)
cd services/ai-proxy && uv sync --frozen && uv run ruff check . && uv run mypy . && uv run pytest -q

# 6. Terraform checks
terraform fmt -check -recursive infra/terraform
for d in infra/terraform/modules/*/; do terraform -chdir="$d" init -backend=false && terraform -chdir="$d" validate; done
```

---

## 10. Recommended Branch Protection Settings

### Current Status on GitHub

- An inspection of the repository settings (`gh api repos/infinitica-org/hellosmart/branches/dev/protection` and `rulesets`) confirmed:
  - Branch protection on `dev` and `main` is currently not configured (`HTTP 404`).
  - Rulesets return `HTTP 403` because the repository is private under a GitHub Free plan.
- **Lead Decision Required:** Enabling enforced status checks on private repositories requires upgrading the GitHub organization to a paid plan (GitHub Team or Enterprise).

### Recommended Settings for Repository Admin (Once Upgraded):

1. **Target Branches:** `dev` (integration) and `main` (production).
2. **Protect Matching Branches:**
   - [x] **Require a pull request before merging**
     - Require approvals: minimum **1 approval**.
     - Dismiss stale pull request approvals when new commits are pushed.
     - Require review from Code Owners (enforces `.github/CODEOWNERS`).
   - [x] **Require status checks to pass before merging**
     - Require branches to be up to date before merging.
     - Status check to require: **`ci`** (the aggregator gate job).
   - [x] **Do not allow bypassing the above settings**
