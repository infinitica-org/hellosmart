# HelloSmart.ai — Environment & Secret Management Specification

> **Audience:** Developers, DevOps Engineers, and AI coding agents building HelloSmart.ai.  
> **Status:** Active & Standardized (S0-T12)  
> **Authority:** In accordance with [AGENTS.md](../../AGENTS.md) §8 (BR-13, BR-16, BR-30, BR-31) and Sprint 0 Security Standards.

---

## 1. Core Secret Management Rules (Invariants)

1. **Zero Real Secrets in Version Control:** Never commit real credentials, tokens, API keys, passwords, private keys, or non-local database connection strings to git.
2. **Safe Example Placeholders:** Every `.env.example` file must contain obvious dummy placeholders (for example `change-me-local-only`, `mock-key`, `postgres://hs_app:hs_app_local@localhost:5432/hellosmart`).
3. **CI Throwaway Isolation:** GitHub Actions CI pipelines must define throwaway test values directly as plain workflow `env` variables for ephemeral localhost service containers. Real GitHub Secrets must never be used or referenced for standard test execution.
4. **Production Secret Storage:** Production secrets must be stored in an approved secret store and injected into application containers at runtime. Secrets are never stored in container images, source code, or git repositories.
5. **Strict Client-Side Boundary:** Variables prefixed with `NEXT_PUBLIC_` are inlined into client JavaScript bundles and visible to any user or browser. **`NEXT_PUBLIC_*` variables must NEVER hold secret keys, database credentials, or signing tokens.**

---

## 2. Environment Variable Inventory & Master Catalog

### 2.1 Core Application, BFF, and Service Variables

> [!NOTE]
> For every entry in the **Production Config** column, values are strictly limited to what has been verified in repository files (citing the source file). Where deployment or secret configuration is not committed, the status is explicitly stated as **UNCONFIRMED, owner to confirm**.

| Variable Name                     | Purpose                                                                                    | Scope                | Required / Optional               | Local Config                     | CI Config                          | Production Config                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------ | -------------------- | --------------------------------- | -------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                        | Application environment state (`development`, `test`, `staging`, `production`)             | Server-only          | Required                          | `.env`                           | Workflow `env` (`test`)            | UNCONFIRMED, owner to confirm (`deploy.yml:12` accepts `staging` / `prod` input, but ECS injection is uncommitted)         |
| `LOG_LEVEL`                       | Minimum log severity filter (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`) | Server-only          | Optional (default: `info`)        | `.env`                           | Default (`info`)                   | UNCONFIRMED, owner to confirm                                                                                              |
| `APP_BASE_URL`                    | Frontend web application origin URL (used for CORS and redirect URLs)                      | Server-only          | Required                          | `.env` (`http://localhost:3000`) | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `API_BASE_URL`                    | Backend NestJS service base URL (used for server-side Next.js BFF proxy calls)             | Server-only          | Required                          | `.env` (`http://localhost:4000`) | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `NEXT_PUBLIC_API_URL`             | Browser client API base URL (injected into client JavaScript)                              | **Public** (Browser) | Required                          | `.env` / `apps/web/.env.example` | Injected at build                  | UNCONFIRMED, owner to confirm                                                                                              |
| `NEXT_PUBLIC_APP_URL`             | Browser client application URL origin                                                      | **Public** (Browser) | Optional                          | `.env` (`http://localhost:3000`) | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `NEXT_PUBLIC_APP_ENV`             | Client UI badge environment identifier                                                     | **Public** (Browser) | Optional (default: `development`) | `apps/web/.env.example`          | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `CORS_ORIGINS`                    | Allowed origins for credentialed browser API requests (comma-separated, no wildcards)      | Server-only          | Required outside dev              | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `POSTGRES_USER`                   | Local PostgreSQL container root owner user                                                 | Server-only          | Optional (local dev)              | `.env` (`hs_owner`)              | Workflow `services`                | UNCONFIRMED, owner to confirm                                                                                              |
| `POSTGRES_PASSWORD`               | Local PostgreSQL container root owner password                                             | Server-only (Secret) | Optional (local dev)              | `.env` (`hs_owner_local`)        | Workflow `services`                | UNCONFIRMED, owner to confirm                                                                                              |
| `POSTGRES_DB`                     | PostgreSQL primary database name                                                           | Server-only          | Optional (local dev)              | `.env` (`hellosmart`)            | Workflow `services`                | UNCONFIRMED, owner to confirm                                                                                              |
| `POSTGRES_PORT`                   | PostgreSQL database connection port                                                        | Server-only          | Optional (local dev)              | `.env` (`5432`)                  | Workflow `services`                | UNCONFIRMED, owner to confirm                                                                                              |
| `DATABASE_URL`                    | Application runtime connection URL (uses `hs_app` role with strict RLS)                    | Server-only (Secret) | Required                          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `DATABASE_MIGRATOR_URL`           | Schema migration connection URL (uses `hs_migrator` DDL role)                              | Server-only (Secret) | Required for migrations           | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm (`deploy.yml:64` invokes `./infra/scripts/run-migrations.sh`; script is uncommitted)         |
| `DATABASE_PLATFORM_URL`           | Platform admin connection URL (uses `hs_platform` cross-tenant role)                       | Server-only (Secret) | Optional (derived in app)         | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `DATABASE_OWNER_URL`              | Database root owner connection URL (bootstrap/DDL only)                                    | Server-only (Secret) | Optional                          | `.env`                           | Omitted in CI                      | UNCONFIRMED, owner to confirm                                                                                              |
| `DATABASE_ADMIN_URL`              | Local dev database admin URL (used by migration fallback if schema missing)                | Server-only (Secret) | Optional                          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `TEST_DATABASE_URL`               | Fixtures test suite connection URL override                                                | Server-only (Secret) | Optional (test only)              | `.env.local` / CLI               | Workflow `env` (`hellosmart_test`) | Not deployed to production (test suite only)                                                                               |
| `SEED_DATABASE_URL`               | Seed CLI connection URL override                                                           | Server-only (Secret) | Optional                          | CLI flag / `.env`                | Omitted in CI                      | Not deployed to production (seed CLI only)                                                                                 |
| `REDIS_PORT`                      | Local Redis container port                                                                 | Server-only          | Optional (local dev)              | `.env` (`6379`)                  | Workflow `services`                | UNCONFIRMED, owner to confirm                                                                                              |
| `REDIS_PASSWORD`                  | Local Redis authentication password                                                        | Server-only (Secret) | Optional (local dev)              | `.env` (`hs_redis_local`)        | Omitted (local Redis)              | UNCONFIRMED, owner to confirm                                                                                              |
| `REDIS_URL`                       | Redis connection URL for session storage & rate-limiting                                   | Server-only (Secret) | Required                          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `COOKIE_NAME`                     | Session cookie identifier name                                                             | Server-only          | Optional (hardcoded in API)       | `.env` (`hs_session`)            | Workflow `env` (`hs_session`)      | UNCONFIRMED, owner to confirm (hardcoded in `apps/api/src/modules/session/session.service.ts`; changing env has no effect) |
| `COOKIE_SECRET`                   | Session cookie HMAC signature secret (min 32 chars)                                        | Server-only (Secret) | Required                          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `SESSION_SECRET`                  | Session encryption & token verification secret (min 32 bytes)                              | Server-only (Secret) | Required                          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `SESSION_TTL_SECONDS`             | Session duration limit in seconds                                                          | Server-only          | Optional (hardcoded in API)       | `.env` (`86400`)                 | Omitted                            | UNCONFIRMED, owner to confirm (hardcoded in `apps/api/src/modules/session/session.service.ts`; changing env has no effect) |
| `PROXY_TOKEN_SIGNING_KEY`         | Workspace AI proxy short-lived JWT signing key                                             | Server-only (Secret) | Required                          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm                                                                                              |
| `PLATFORM_ADMIN_MFA_SECRET`       | Base32 seed TOTP secret for superadmin account                                             | Server-only (Secret) | Optional (dev/test only)          | `.env.local`                     | Workflow `env`                     | Not deployed to production (dev/test only per `apps/api/src/config/config.ts:23`)                                          |
| `SEED_DEFAULT_PASSWORD`           | Shared password for active loginable seed accounts                                         | Server-only (Secret) | Required for seed                 | `.env.local`                     | Workflow `env`                     | Not deployed to production (seed fixtures only)                                                                            |
| `SEED_PLATFORM_ADMIN_TOTP_SECRET` | Alias for platform admin seed TOTP secret                                                  | Server-only (Secret) | Optional                          | `.env.local`                     | Workflow `env`                     | Not deployed to production (seed fixtures only)                                                                            |
| `SEED_ALLOWED_DB_HOSTS`           | Safety guard comma-separated host allowlist for seed CLI                                   | Server-only          | Optional                          | `.env`                           | Default (`localhost`)              | Not deployed to production (seed CLI only)                                                                                 |
| `MFA_ENCRYPTION_KEY`              | 32-byte AES-256-GCM encryption key for MFA secrets at rest (hex)                           | Server-only (Secret) | Required in staging/prod          | `.env`                           | Workflow `env`                     | UNCONFIRMED, owner to confirm (required in staging/prod per `apps/api/src/config/config.ts:25`; store unconfirmed)         |
| `MFA_ENCRYPTION_KEY_ID`           | Identifier for current MFA key version (default: `k1`)                                     | Server-only          | Optional                          | `.env` (`k1`)                    | Workflow `env` (`k1`)              | UNCONFIRMED, owner to confirm (defaults to `k1` per `apps/api/src/config/config.ts:28`)                                    |
| `MFA_PREVIOUS_ENCRYPTION_KEYS`    | Mapping of retired MFA encryption keys for zero-downtime rotation                          | Server-only (Secret) | Optional (rotation only)          | `.env`                           | Omitted in CI                      | UNCONFIRMED, owner to confirm (`apps/api/src/config/config.ts:29`)                                                         |
| `HIBP_FAIL_OPEN`                  | Have I Been Pwned breach check timeout behavior (fail-open toggle)                         | Server-only          | Optional (default: `true`)        | `.env` (`true`)                  | Workflow `env` (`true`)            | UNCONFIRMED, owner to confirm                                                                                              |
| `PAYMENT_GATEWAY`                 | Payment provider adapter selection (`fake`, `razorpay`)                                    | Server-only          | Required                          | `.env` (`fake`)                  | Default (`fake`)                   | UNCONFIRMED, owner to confirm                                                                                              |
| `EMAIL_PROVIDER`                  | Transactional email provider adapter (`fake`, `ses`)                                       | Server-only          | Required                          | `.env` (`fake`)                  | Default (`fake`)                   | UNCONFIRMED, owner to confirm                                                                                              |
| `MAILPIT_URL`                     | Local Mailpit UI and SMTP server endpoint                                                  | Server-only          | Optional (local dev)              | `.env` (`http://localhost:8025`) | Default                            | Not deployed to production (local dev only)                                                                                |
| `LLM_PROVIDER`                    | AI proxy LLM backend provider (`fake`, `openai`, `anthropic`)                              | Server-only          | Required                          | `.env` (`fake`)                  | Default (`fake`)                   | UNCONFIRMED, owner to confirm                                                                                              |
| `WORKSPACE_RUNTIME`               | Workspace container orchestrator adapter (`fake`, `sysbox`)                                | Server-only          | Required                          | `.env` (`fake`)                  | Default (`fake`)                   | UNCONFIRMED, owner to confirm                                                                                              |
| `EMAIL_FROM_DOMAIN`               | Origin domain for outbound transactional emails                                            | Server-only          | Optional                          | `.env` (`mail.hellosmart.local`) | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `AWS_REGION`                      | Target AWS deployment region                                                               | Server-only          | Required                          | `.env` (`ap-south-1`)            | Workflow `env`                     | `ap-south-1` (verified in `.github/workflows/deploy.yml:32, 62`)                                                           |
| `AWS_ENDPOINT_URL`                | LocalStack mock cloud endpoint (local S3/SQS/KMS)                                          | Server-only          | Optional (local dev)              | `.env` (`http://localhost:4566`) | Default                            | Not deployed to production (localstack mock only)                                                                          |
| `OBJECT_STORE_BUCKET`             | S3 bucket name for session recordings and artifacts                                        | Server-only          | Optional                          | `.env` (`hs-local-artifacts`)    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `QUEUE_URL`                       | SQS queue endpoint for background async job processing                                     | Server-only          | Optional                          | `.env` (`hs-local-jobs`)         | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `KMS_KEY_ID`                      | KMS encryption key ID or alias for artifact encryption                                     | Server-only          | Optional                          | `.env` (`alias/hs-local`)        | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `GOOGLE_OAUTH_CLIENT_ID`          | Google SSO OAuth 2.0 client ID                                                             | Server-only          | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `GOOGLE_OAUTH_CLIENT_SECRET`      | Google SSO OAuth 2.0 client secret                                                         | Server-only (Secret) | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `MS_OAUTH_CLIENT_ID`              | Microsoft Entra SSO client ID                                                              | Server-only          | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `MS_OAUTH_CLIENT_SECRET`          | Microsoft Entra SSO client secret                                                          | Server-only (Secret) | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `RAZORPAY_KEY_ID`                 | Razorpay API key identifier                                                                | Server-only          | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `RAZORPAY_KEY_SECRET`             | Razorpay API secret key                                                                    | Server-only (Secret) | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `RAZORPAY_WEBHOOK_SECRET`         | Razorpay webhook signature verification secret                                             | Server-only (Secret) | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `CALCOM_WEBHOOK_SECRET`           | Cal.com meeting booking webhook verification secret                                        | Server-only (Secret) | Optional                          | `.env` (mock)                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `ENABLE_DEV_ACCOUNTS`             | Web BFF bypass for local mock accounts                                                     | Server-only          | Development only                  | `apps/web/.env.example`          | Omitted                            | Not deployed to production (verified blocked in code when `NODE_ENV=production`; see §5)                                   |
| `ALLOW_DEV_LOGIN_BFF`             | Alias for `ENABLE_DEV_ACCOUNTS` in BFF route handlers                                      | Server-only          | Development only                  | Code fallback                    | Omitted                            | Not deployed to production (verified blocked in code when `NODE_ENV=production`; see §5)                                   |
| `ALLOW_DEV_LOGIN`                 | Alias for `ENABLE_DEV_ACCOUNTS` in middleware tests                                        | Server-only          | Test only                         | Code fallback                    | Omitted                            | Not deployed to production (verified test-only; see §5)                                                                    |
| `WEB_BASE_URL`                    | Alias for `APP_BASE_URL` in invite links generator                                         | Server-only          | Optional                          | Code fallback                    | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `ENV`                             | Environment identifier in Python services (`services/ai-proxy`, `services/reviewer`)       | Server-only          | Optional                          | Code default                     | Default                            | UNCONFIRMED, owner to confirm                                                                                              |
| `AWS_SHARED_CI_ROLE_ARN`          | IAM Role assumed by GitHub Actions for ECR image publishing                                | CI Pipeline          | Optional                          | Not used locally                 | `vars.AWS_SHARED_CI_ROLE_ARN`      | `vars.AWS_SHARED_CI_ROLE_ARN` (verified in `.github/workflows/deploy.yml:31`)                                              |
| `AWS_DEPLOY_ROLE_ARN`             | IAM Role assumed by GitHub Actions for ECS deployment                                      | CI Pipeline          | Optional                          | Not used locally                 | `vars.AWS_DEPLOY_ROLE_ARN`         | `vars.AWS_DEPLOY_ROLE_ARN` (verified in `.github/workflows/deploy.yml:61`)                                                 |

---

### 2.2 Test Runner & Fixture Override Variables

The following variables are utilized as optional runtime overrides by the integration and E2E test suites (`apps/api/test/` and `apps/web/tests/e2e/`). When unset, all test suites fall back to deterministic seeded constants from `@hs/fixtures`:

| Variable Name                  | Purpose                                                   | Scope                | Test Scope                                |
| ------------------------------ | --------------------------------------------------------- | -------------------- | ----------------------------------------- |
| `AUTH_ACTIVE_EMAIL`            | Override email for active user integration tests          | Server-only          | `apps/api/test/auth.e2e-spec.ts`          |
| `AUTH_ACTIVE_PASSWORD`         | Override password for active user integration tests       | Server-only (Secret) | `apps/api/test/auth.e2e-spec.ts`          |
| `AUTH_BRUTE_FORCE_EMAIL`       | Target email for rate-limit / lockout integration tests   | Server-only          | `apps/api/test/auth.e2e-spec.ts`          |
| `AUTH_MOCK_PORT`               | Port for mock authentication server in web E2E tests      | Server-only          | `apps/web/tests/e2e/auth-mock-server.mjs` |
| `AUTH_SUSPENDED_ORG_EMAIL`     | Override email for suspended organization test user       | Server-only          | `apps/api/test/auth.e2e-spec.ts`          |
| `AUTH_SUSPENDED_ORG_PASSWORD`  | Override password for suspended organization test user    | Server-only (Secret) | `apps/api/test/auth.e2e-spec.ts`          |
| `AUTH_SUSPENDED_USER_EMAIL`    | Override email for suspended candidate test user          | Server-only          | `apps/api/test/auth.e2e-spec.ts`          |
| `AUTH_SUSPENDED_USER_PASSWORD` | Override password for suspended candidate test user       | Server-only (Secret) | `apps/api/test/auth.e2e-spec.ts`          |
| `E2E_BASE_URL`                 | Target base URL for Playwright web browser E2E tests      | Server-only          | `apps/web/tests/e2e/`                     |
| `E2E_CANDIDATE_EMAIL`          | Candidate login credential for browser E2E tests          | Server-only          | `apps/web/tests/e2e/`                     |
| `E2E_CANDIDATE_PASSWORD`       | Candidate password for browser E2E tests                  | Server-only (Secret) | `apps/web/tests/e2e/`                     |
| `E2E_COMPANY_ADMIN_EMAIL`      | Company admin login credential for browser E2E tests      | Server-only          | `apps/web/tests/e2e/`                     |
| `E2E_COMPANY_ADMIN_PASSWORD`   | Company admin password for browser E2E tests              | Server-only (Secret) | `apps/web/tests/e2e/`                     |
| `E2E_SUPER_ADMIN_EMAIL`        | Platform superadmin credential for browser E2E tests      | Server-only          | `apps/web/tests/e2e/`                     |
| `E2E_SUPER_ADMIN_PASSWORD`     | Platform superadmin password for browser E2E tests        | Server-only (Secret) | `apps/web/tests/e2e/`                     |
| `TENANCY_ORG_A_EMAIL`          | Org A company admin email for cross-tenant API tests      | Server-only          | `apps/api/test/tenancy.e2e-spec.ts`       |
| `TENANCY_ORG_A_PASSWORD`       | Org A password for cross-tenant API tests                 | Server-only (Secret) | `apps/api/test/tenancy.e2e-spec.ts`       |
| `TENANCY_ORG_B_CANDIDATE_ID`   | Org B candidate UUID for cross-tenant isolation assertion | Server-only          | `apps/api/test/tenancy.e2e-spec.ts`       |

---

### 2.3 Internal Documentation Portal Passwords (`apps/docs`)

`apps/docs` (Fumadocs) implements an internal passkey-gated role-switcher (`apps/docs/lib/auth.server.ts`). These server-side variables are never sent to the browser:

| Variable Name   | Purpose                                                  | Scope                | Default Value    |
| --------------- | -------------------------------------------------------- | -------------------- | ---------------- |
| `DOCS_PASSWORD` | Master unlock passkey for all internal documentation     | Server-only (Secret) | `hs-master-2026` |
| `SITE_PASSWORD` | Alias for `DOCS_PASSWORD`                                | Server-only (Secret) | `hs-master-2026` |
| `SDE_PASSWORD`  | Unlock passkey for Software Engineering playbooks        | Server-only (Secret) | `hs-sde-2026`    |
| `AI_PASSWORD`   | Unlock passkey for AI & ML playbook documentation        | Server-only (Secret) | `hs-ai-2026`     |
| `QA_PASSWORD`   | Unlock passkey for Quality Assurance & Testing playbooks | Server-only (Secret) | `hs-qa-2026`     |
| `MGMT_PASSWORD` | Unlock passkey for Management & Leadership playbooks     | Server-only (Secret) | `hs-mgmt-2026`   |

---

### 2.4 QA Environment VPS Variables (`infra/qa-vps`)

Variables configured in `/srv/hellosmart/.env.qa` on the QA EC2 instance (`infra/qa-vps/env.qa.example`):

| Variable Name     | Purpose                                                               | Scope                | Configuration Source                                                               |
| ----------------- | --------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `REGISTRY`        | Container registry host for QA image pulls (`ghcr.io/infinitica-org`) | Server-only          | Configured in `env.qa` (verified in `infra/qa-vps/env.qa.example:8`)               |
| `TAG`             | Image tag for deployment (`latest` or git commit SHA)                 | Server-only          | Configured in `env.qa` (verified in `infra/qa-vps/qa.sh:15`)                       |
| `QA_BASIC_USER`   | HTTP Basic Auth username for Caddy reverse proxy on QA host           | Server-only          | Configured in `env.qa` (verified in `infra/qa-vps/env.qa.example:15`)              |
| `QA_BASIC_HASH`   | Bcrypt password hash for QA HTTP Basic Auth                           | Server-only (Secret) | Generated via `caddy hash-password` (verified in `infra/qa-vps/env.qa.example:19`) |
| `QA_ALLOWED_IPS`  | CIDR allowlist of authorized IPs for QA environment access            | Server-only          | Configured in `env.qa` (verified in `infra/qa-vps/env.qa.example:26`)              |
| `QA_COMPOSE_FILE` | Docker Compose file path on QA host                                   | Server-only          | Default: `docker-compose.qa.yml` (verified in `infra/qa-vps/qa.sh:9`)              |
| `QA_LOG_DIR`      | Host directory for log archives (`/var/log/hellosmart`)               | Server-only          | Configured in `qa-archive.sh` (verified in `infra/qa-vps/qa-archive.sh:6`)         |

---

## 3. Terraform Inputs (Not Environment Variables)

The following inputs are declared as HCL variables in Terraform modules (`infra/terraform/modules/`). They are configured via Terraform `.tfvars` files or module blocks, **not** as process environment variables:

| Variable Name                      | Module                             | Type           | Purpose                                                        | Source File                                               |
| ---------------------------------- | ---------------------------------- | -------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| `env`                              | `observability`                    | `string`       | Target deployment environment name                             | `infra/terraform/modules/observability/variables.tf:1`    |
| `aws_region`                       | `observability`                    | `string`       | Target AWS region for log groups and metrics                   | `infra/terraform/modules/observability/variables.tf:6`    |
| `services`                         | `observability`                    | `list(string)` | List of ECS microservices monitored by observability module    | `infra/terraform/modules/observability/variables.tf:12`   |
| `retention_in_days`                | `observability`                    | `number`       | CloudWatch log group retention period (days)                   | `infra/terraform/modules/observability/variables.tf:18`   |
| `kms_key_arn`                      | `observability`                    | `string`       | KMS Key ARN for CloudWatch log group encryption                | `infra/terraform/modules/observability/variables.tf:24`   |
| `s3_kms_key_arn`                   | `observability`                    | `string`       | KMS Key ARN for S3 archive bucket encryption                   | `infra/terraform/modules/observability/variables.tf:30`   |
| `archive_retention_days`           | `observability`                    | `number`       | S3 log archive lifecycle total retention (days)                | `infra/terraform/modules/observability/variables.tf:36`   |
| `archive_transition_glacier_days`  | `observability`                    | `number`       | S3 log archive transition to Glacier Flexible Retrieval (days) | `infra/terraform/modules/observability/variables.tf:42`   |
| `archive_storage_class`            | `observability`                    | `string`       | Target cold storage class (`GLACIER`)                          | `infra/terraform/modules/observability/variables.tf:48`   |
| `s3_bucket_name_override`          | `observability`                    | `string`       | Custom bucket name override for log archival                   | `infra/terraform/modules/observability/variables.tf:54`   |
| `firehose_buffer_size_mb`          | `observability`                    | `number`       | Kinesis Firehose delivery stream buffer size                   | `infra/terraform/modules/observability/variables.tf:60`   |
| `firehose_buffer_interval_seconds` | `observability`                    | `number`       | Kinesis Firehose delivery stream buffer interval               | `infra/terraform/modules/observability/variables.tf:66`   |
| `alerts_topic_arn`                 | `observability`, `workspace-hosts` | `string`       | SNS Topic ARN for operational CloudWatch alarms                | `infra/terraform/modules/observability/variables.tf:72`   |
| `tags`                             | All modules                        | `map(string)`  | Common AWS resource tags map                                   | `infra/terraform/modules/observability/variables.tf:78`   |
| `allowed_regions`                  | `org-baseline`                     | `list(string)` | AWS Organization SCP allowed regions list                      | `infra/terraform/modules/org-baseline/variables.tf:1`     |
| `workload_ou_ids`                  | `org-baseline`                     | `list(string)` | AWS Organization OU IDs for workload accounts                  | `infra/terraform/modules/org-baseline/variables.tf:7`     |
| `workspaces_ou_id`                 | `org-baseline`                     | `string`       | AWS Organization OU ID for workspace sandboxes                 | `infra/terraform/modules/org-baseline/variables.tf:13`    |
| `workspace_instance_types`         | `org-baseline`                     | `list(string)` | Allowed EC2 instance types for workspace sandboxes             | `infra/terraform/modules/org-baseline/variables.tf:19`    |
| `host_ami_id`                      | `workspace-hosts`                  | `string`       | AMI ID for workspace host EC2 instances                        | `infra/terraform/modules/workspace-hosts/variables.tf:1`  |
| `host_instance_type`               | `workspace-hosts`                  | `string`       | EC2 instance type for workspace hosts                          | `infra/terraform/modules/workspace-hosts/variables.tf:2`  |
| `ebs_kms_key_arn`                  | `workspace-hosts`                  | `string`       | KMS Key ARN for workspace host EBS volume encryption           | `infra/terraform/modules/workspace-hosts/variables.tf:8`  |
| `vpc_id`                           | `workspace-hosts`                  | `string`       | Target AWS VPC ID for workspace container instances            | `infra/terraform/modules/workspace-hosts/variables.tf:10` |
| `private_subnet_ids`               | `workspace-hosts`                  | `list(string)` | List of private subnet IDs for workspace placement             | `infra/terraform/modules/workspace-hosts/variables.tf:12` |
| `gateway_sg_id`                    | `workspace-hosts`                  | `string`       | Security group ID for workspace gateway                        | `infra/terraform/modules/workspace-hosts/variables.tf:14` |
| `min_hosts`                        | `workspace-hosts`                  | `number`       | Auto-scaling group minimum instance boundary                   | `infra/terraform/modules/workspace-hosts/variables.tf:18` |
| `max_hosts`                        | `workspace-hosts`                  | `number`       | Auto-scaling group maximum instance boundary                   | `infra/terraform/modules/workspace-hosts/variables.tf:24` |
| `monthly_budget_usd`               | `workspace-hosts`                  | `number`       | Monthly AWS spend cap for workspace hosts                      | `infra/terraform/modules/workspace-hosts/variables.tf:30` |

---

## 4. Production Secret Store: UNCONFIRMED

> [!WARNING] > **Production Secret Store Status: UNCONFIRMED (Owner to Confirm)**  
> While `apps/api/src/config/config.ts:3` contains a source code comment stating:
> _"Secrets arrive as env vars injected by ECS from Secrets Manager"_,
> **no production secret storage configuration exists in version control**:
>
> - There are currently no AWS Secrets Manager resource definitions, secret ARN manifests, or SSM Parameter Store templates in `infra/terraform/`.
> - The deployment scripts referenced by `.github/workflows/deploy.yml` (`./infra/scripts/run-migrations.sh` and `./infra/scripts/deploy-ecs.sh`) are not yet committed to the repository.
> - No ECS task definitions with container `secrets` blocks are committed to the repository.
>
> **Action Required for Platform Lead:** Confirm the production secret store (AWS Secrets Manager vs. SSM Parameter Store vs. HashiCorp Vault), document the secret ARN naming convention, and supply the ECS deployment definitions.

---

## 5. Dev Login Production Enforcement: VERIFIED in Code

The repository contains development bypass flags (`ENABLE_DEV_ACCOUNTS`, `ALLOW_DEV_LOGIN_BFF`, and `ALLOW_DEV_LOGIN`) used for offline testing without backend credentials. An audit of all occurrences confirms that **all bypass mechanisms are strictly blocked in code when `NODE_ENV=production`**:

1. **`apps/web/src/app/api/auth/identify/route.ts:8-10`** (**VERIFIED in code**):

   ```typescript
   const allowDevLogin =
     (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
     (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');
   ```

   When `NODE_ENV === 'production'`, `allowDevLogin` evaluates to `false`.

2. **`apps/web/src/app/api/auth/login/route.ts:17-19`** (**VERIFIED in code**):

   ```typescript
   const allowDevLogin =
     (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
     (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');
   ```

   When `NODE_ENV === 'production'`, `allowDevLogin` evaluates to `false`. Furthermore, regression test `apps/web/src/__tests__/auth-login.test.ts:153-174` explicitly asserts that login fails closed when `NODE_ENV === 'staging'` or `'production'` even if `ENABLE_DEV_ACCOUNTS=true` is set.

3. **`apps/web/src/app/api/auth/mfa/verify/route.ts:24-26`** (**VERIFIED in code**):

   ```typescript
   const allowDevLogin =
     (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
     (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.ALLOW_DEV_LOGIN_BFF === 'true');
   ```

   When `NODE_ENV === 'production'`, `allowDevLogin` evaluates to `false`.

4. **`apps/web/src/middleware.ts:252-255`** (**VERIFIED in code**):

   ```typescript
   const allowDevAccounts =
     (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
     process.env.ENABLE_DEV_ACCOUNTS === 'true';
   ```

   When `NODE_ENV === 'production'`, `allowDevAccounts` evaluates to `false`.

5. **`apps/web/src/lib/server-auth.ts:98-106`** (**VERIFIED in code**):

   ```typescript
   const isDevOrTest =
     process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
   const devFallbackEnabled =
     isDevOrTest &&
     (process.env.ENABLE_DEV_ACCOUNTS === 'true' || process.env.NODE_ENV === 'test');

   if (!devFallbackEnabled) {
     return { authorized: false, errorResponse: NextResponse.json(..., { status: 503 }) };
   }
   ```

   When `NODE_ENV === 'production'`, `devFallbackEnabled` evaluates to `false` and fails closed with HTTP 503.

6. **`ALLOW_DEV_LOGIN`** (**VERIFIED in code**):
   Not referenced in application code at all; only appeared as a variable override in a unit test file (`apps/web/src/__tests__/middleware.test.ts:146`).

---

## 6. Client Bundle Boundary & Canary Verification

Variables prefixed with `NEXT_PUBLIC_` are inlined into browser JavaScript bundles at build time. Server-only variables (`DATABASE_URL`, `COOKIE_SECRET`, `SESSION_SECRET`, `PROXY_TOKEN_SIGNING_KEY`, etc.) must never be prefixed with `NEXT_PUBLIC_` or imported in client components.

### 6.1 `@hs/web` Verification: PASSED

A build simulation of `@hs/web` was performed with high-entropy canary secret values:

```bash
COOKIE_SECRET="CANARY_COOKIE_SECRET_XYZ987"
SESSION_SECRET="CANARY_SESSION_SECRET_XYZ987"
PROXY_TOKEN_SIGNING_KEY="CANARY_PROXY_KEY_XYZ987"
DATABASE_URL="postgres://hs_app:CANARY_DATABASE_URL_XYZ987@localhost:5432/hellosmart"
```

A post-build regex scan across all generated client chunks in `apps/web/.next/static/**/*.js` confirmed:
**Zero server canary secrets were found in `@hs/web` client bundles.**

### 6.2 `apps/docs` (Fumadocs) Verification: STATICALLY VERIFIED (Open Item for Container Build)

- **Static Analysis:** An audit of `apps/docs` confirmed that documentation passkey variables (`DOCS_PASSWORD`, `SITE_PASSWORD`, `SDE_PASSWORD`, `AI_PASSWORD`, `QA_PASSWORD`, and `MGMT_PASSWORD`) are referenced solely in `apps/docs/lib/auth.server.ts` (a server-only file). There are **zero `NEXT_PUBLIC_*` secret variables** declared in `apps/docs`.
- **Canary Build Audit Gap:** An empirical canary build of `apps/docs` could not be completed in the local sandbox environment due to Next.js 16 / Turbopack filesystem canonicalization restrictions on OneDrive Windows paths (`Access is denied. (os error 5)`).
- **Open Item:** Run the automated canary string scan on `apps/docs` during Linux CI or Docker container build to empirically confirm zero leakage in documentation client assets.

---

## 7. How to Add a New Environment Variable (Checklist)

Whenever introducing a new configuration variable to any HelloSmart application:

- [ ] **Determine Scope:** Is this variable required by the browser client, or is it server-side only?
  - If required by client JavaScript, prefix with `NEXT_PUBLIC_`. Confirm it contains **no sensitive information**.
  - If required by backend or BFF server routes, keep as a standard name without `NEXT_PUBLIC_`.
- [ ] **Update Documentation & Examples:**
  - Add the variable with a safe placeholder and explanatory comment to root `.env.example`.
  - If specific to `apps/web`, also update `apps/web/.env.example`.
  - If required in QA EC2, add placeholder to `infra/qa-vps/env.qa.example`.
  - Add the variable to the master table in this document (`docs/security/environment-and-secrets.md`).
- [ ] **Define Validation Schema:**
  - In `apps/api/src/config/config.ts`, add the variable to `ConfigSchema` with appropriate type, length, and default constraints.
- [ ] **Update CI Throwaway Environment:**
  - If required for unit or integration tests, add a safe throwaway test value to the `env:` block in `.github/workflows/ci.yml`.
- [ ] **Verify Client Bundle Safety:**
  - Confirm server-side secrets are not imported in any client components or leaked into `.next/static`.
- [ ] **Coordinate Production Secret Configuration:**
  - Coordinate with DevOps / Platform Lead to provision the secret in the designated production secret store.

---

## 8. Secret Rotation Procedures

### 8.1 MFA Encryption Key Rotation (`MFA_ENCRYPTION_KEY`)

The platform supports zero-downtime key rotation for AES-256-GCM encrypted MFA secrets using key identifiers (`apps/api/src/config/config.ts:28-30`):

1. Generate a new 32-byte key: `openssl rand -hex 32`.
2. Assign a new key identifier (for example `k2`).
3. Set `MFA_PREVIOUS_ENCRYPTION_KEYS={"k1":"<old_key_hex>"}` in the production secret store.
4. Set `MFA_ENCRYPTION_KEY=<new_key_hex>` and `MFA_ENCRYPTION_KEY_ID=k2`.
5. Deploy API containers. During reads, the service uses `mfa_encryption_key_id` to decrypt existing secrets using the previous key mapping. During writes, all new secrets are re-encrypted with `k2`.
6. Once all active credentials have been re-encrypted, decommission `k1` and remove it from `MFA_PREVIOUS_ENCRYPTION_KEYS`.

### 8.2 Session and Cookie Secret Rotation (`SESSION_SECRET`, `COOKIE_SECRET`)

- Updating `SESSION_SECRET` or `COOKIE_SECRET` immediately invalidates existing signed cookies.
- Plan rotations during off-peak windows or maintenance periods.
- Users with active sessions will receive a standard 401 redirect to `/login`.

### 8.3 Database Role Password Rotation

- Passwords for `hs_app`, `hs_migrator`, and `hs_platform` must be managed via the approved secret store.
- Use dual-role rotation in PostgreSQL: alter the role password, update the secret, and trigger a rolling service restart.

---

## 9. Security Incident Response: Secret Leak Remediation

If an API key, database credential, or token is accidentally exposed in git, CI logs, or client bundles:

1. **Immediate Revocation:** Immediately revoke the compromised credential at the source provider (e.g., rotate Razorpay API keys in Razorpay dashboard, generate new AWS IAM keys, revoke OAuth credentials).
2. **Deploy Replacement:** Update the production secret store with the newly generated secret and trigger a rolling deployment of application services.
3. **Audit History & Logs:** Inspect logs and audit tables (`app.audit_logs`) for any unauthorized activity originating from the compromised credential's exposure window.
4. **Git History Scrubbing:**
   - If committed to git locally, remove the commit from the branch using `git rebase` before pushing or merging.
   - If pushed to remote, treat the secret as permanently compromised, rotate immediately, and coordinate repository history rewriting with the platform engineering lead.
5. **Session Revocation:** If session keys or cookie secrets were compromised, execute `flushdb` on Redis to force re-authentication across all active tenants.

---

## 10. Audit Findings & Recommendations for Engineering Lead

### Verified Facts (Read-Only Investigation)

- **Zero Secrets in Repository:** A comprehensive scan of all git-tracked files verified that no real credentials, private keys, or cloud access tokens exist in the repository.
- **Client Bundle Isolation Verified:** A build simulation of `apps/web` with canary secrets confirmed that zero server-only variables are leaked into client JavaScript bundles (`.next/static`).
- **GitHub Secrets and Variables Audit:** No repository-level variables or secrets were found with read-only gh commands. Environment-level and organization-level values were not checked.

### Decisions / Action Items for Engineering Lead & Teams:

1. **Production Secret Store Confirmation:**
   - Confirm the approved production secret management service and secret naming conventions (see §4).
   - Supply the missing deployment scripts referenced by `deploy.yml` (`./infra/scripts/run-migrations.sh` and `./infra/scripts/deploy-ecs.sh`).
2. **Backend Architecture Alignment:**
   - `apps/api/src/modules/session/session.service.ts` hardcodes `COOKIE_SESSION_NAME = 'hs_session'` and `SESSION_TTL_SECONDS = 12 * 60 * 60` (12 hours) instead of reading `COOKIE_NAME` and `SESSION_TTL_SECONDS` from `process.env`. The backend team should decide whether to make these dynamically configurable or remove them from `.env.example`.
3. **Web BFF Flag Standardization:**
   - `apps/web` checks both `process.env.ENABLE_DEV_ACCOUNTS` and `process.env.ALLOW_DEV_LOGIN_BFF` / `ALLOW_DEV_LOGIN`. The frontend team should standardize on `ENABLE_DEV_ACCOUNTS`.
4. **Docs Client Bundle CI Check:**
   - Add a canary build check for `apps/docs` in Linux CI to complete empirical bundle verification (see §6.2).
