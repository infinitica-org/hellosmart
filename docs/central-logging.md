# Central Logging Framework — HelloSmart.ai

## 1. Overview & Architecture

HelloSmart API (`apps/api`) implements a production-ready, centralized structured logging framework built natively on **Fastify** and **Pino**.

### Architectural Rationale
- **Native Integration:** Fastify is built natively on top of Pino. `@nestjs/platform-fastify` exposes Fastify's native logger options and lifecycle hooks.
- **Zero Redundant Dependencies:** Avoids installing `pino-http` or Express middleware adapters. Reuses the existing `pino` dependency (v9.5.0) and Fastify's built-in child logger per-request isolation.
- **Single Completion Log:** Fastify's default `disableRequestLogging: true` is configured to suppress noisy and unformatted internal request/completion pairs. Instead, an `onResponse` hook deterministically emits exactly one structured log entry per completed HTTP transaction.
- **Unified NestJS Logging:** `AppLoggerService` implements Nest's `LoggerService` interface, bridging NestJS internal lifecycle events and custom application logs into the same structured Pino output stream with context attribution.

---

## 2. Structured Log Schema

Every completed HTTP request emits a JSON log record to `stdout` conforming to the following structure:

```json
{
  "level": 30,
  "time": 1792995301402,
  "pid": 3856,
  "hostname": "api-task-worker-1",
  "name": "hellosmart-api",
  "reqId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "method": "POST",
  "url": "/api/v1/auth/login",
  "statusCode": 200,
  "responseTime": 12.45,
  "msg": "request completed"
}
```

### Standard Fields
| Field | Type | Description |
|---|---|---|
| `time` | `number` | Unix epoch timestamp in milliseconds (`epochTime`). |
| `level` | `number` | Numeric log level (10 = trace, 20 = debug, 30 = info, 40 = warn, 50 = error, 60 = fatal). |
| `name` | `string` | Service identifier: always `hellosmart-api`. |
| `reqId` | `string` | Correlated request ID (UUIDv4 or validated client correlation ID). |
| `method` | `string` | HTTP verb (`GET`, `POST`, `PUT`, `DELETE`, etc.). |
| `url` | `string` | Normalized route or URL path without query parameters. |
| `statusCode` | `number` | HTTP status code returned to the client. |
| `responseTime`| `number` | Response duration in milliseconds (`reply.elapsedTime`). |
| `msg` | `string` | Fixed action summary: `"request completed"`. |
| `err` | `object` | Optional error diagnostic payload when request status is $\ge 400$. |

When a request encounters an error, safe diagnostic metadata is captured:
```json
{
  "level": 40,
  "time": 1792995301420,
  "name": "hellosmart-api",
  "reqId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "method": "POST",
  "url": "/api/v1/assessments",
  "statusCode": 400,
  "responseTime": 5.12,
  "err": {
    "message": "Validation failed: organization ID is required",
    "code": "BAD_REQUEST"
  },
  "msg": "request completed"
}
```

---

## 3. Log Level Policy

| Request Outcome | Log Level | Pino Level Value | Description |
|---|---|---|---|
| Successful requests (2xx, 3xx) | `info` | `30` | Standard completed API operations. |
| Client errors (4xx) | `warn` | `40` | Validation failures, unauthenticated/unauthorized attempts, resource not found. |
| Server errors (5xx) | `error` | `50` | Unhandled exceptions, database connection drops, upstream gateway failures. |
| Health-checks (2xx) | `debug` | `20` | Routine health and readiness probes (`/health`, `/healthz`, `/api/v1/health`) to prevent aggregation noise. |
| Lifecycle events | `info` | `30` | Application bootstrap, port binding, and graceful shutdown. |

---

## 4. Request Correlation & IDs

1. **Generation:** Each request is assigned a unique UUIDv4 by default via `crypto.randomUUID()`.
2. **Client Correlation Header:** Clients or upstream gateways may supply `x-request-id` or `x-correlation-id`.
   - Input is strictly validated using regex `^[a-zA-Z0-9_-]{1,64}$`.
   - If missing, invalid, or containing unsafe characters, a fresh UUIDv4 is generated.
3. **Response Header:** The resolved request ID is always returned in the `x-request-id` response header via Fastify's `onSend` hook.
4. **Context Association:** Fastify attaches the resolved ID as `reqId` to the request's child logger (`req.log`), ensuring all logs during the request lifecycle share the identical correlation ID.

---

## 5. Security & Sensitive Data Redaction

Adhering to HelloSmart Security Policies and BRD compliance:

- **Redacted Headers:** `authorization`, `cookie`, `x-api-key`, and `session-secret` are censored as `[REDACTED]` in Pino.
- **Redacted Properties:** Wildcards redact sensitive keys in logged objects:
  - `password`, `*.password`
  - `secret`, `*.secret`
  - `token`, `*.token`
  - `apiKey`, `*.apiKey`
  - `access_token`, `refresh_token`
  - `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`
- **Request Bodies:** HTTP request bodies are **never** logged.
- **Query Parameters:** Query strings are stripped from the logged `url` to prevent tokens, API keys, or personal information in query strings from reaching logs.
- **Error Obfuscation:** Internal error stack traces are never exposed to API clients or placed in public response payloads.

---

## 6. Environment Configuration

Configuration is managed via `apps/api/src/config/config.ts` validated with Zod:

```ts
LOG_LEVEL: z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info'),
```

| Environment | Recommended `LOG_LEVEL` | Behavior |
|---|---|---|
| `development` | `info` or `debug` | Logs structured JSON with full diagnostics. |
| `test` | `info` or `silent` | Test suites pass custom in-memory streams without polluting terminal test output. |
| `staging` | `info` | Production-identical structured JSON. |
| `production` | `info` | High-efficiency structured JSON to stdout/stderr. |

---

## 7. Running & Verifying Tests

The automated test suite verifies all logging and redaction invariants using Vitest:

```bash
# Run API tests
pnpm --filter @hs/api test

# Run typecheck
pnpm --filter @hs/api typecheck

# Run build
pnpm --filter @hs/api build
```

### Test Coverage
- `test/logging.spec.ts`:
  - Structured log generation for successful requests with duration, ID, method, and status.
  - Client errors (4xx) logged at warning level with diagnostic info.
  - Server errors (5xx) logged at error level with diagnostic info.
  - Header redaction (`authorization`, `cookie`, `x-api-key`).
  - Request body exclusion.
  - Independent request ID assignment across concurrent requests.
  - Correlation ID validation and sanitization.
  - Health check debug-level noise dampening.
  - URL query parameter stripping.
  - No duplicate log emission.
- `test/logger.service.spec.ts`:
  - `AppLoggerService` NestJS integration methods (`log`, `warn`, `error`, `debug`, `verbose`, `fatal`).
  - Pino redaction rules across nested object fields.
  - Dependency injection into NestJS controllers and services via `ObservabilityModule`.
  - Request ID sanitization helpers.

---

## 8. Log Collection by Deployment Infrastructure

All logs are written to standard output (`process.stdout`), following the Twelve-Factor App specification for logs.

> [!NOTE]
> No hosted log aggregation platform (e.g. AWS CloudWatch, Datadog, Sentry, or Grafana Loki) is currently provisioned or connected in this environment. In production deployment, container runtime collectors (such as AWS ECS log driver or AWS FireLens / Fluent Bit sidecar) will scrape stdout and forward structured JSON events to the designated log store.
