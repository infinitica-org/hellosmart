# Timing, Boundary Expiry & Disconnect Logic Tests (BR-08, BR-09)

> **Document Status**: Production QA Spec & Acceptance Framework (Task 10.2)  
> **Target Branch**: `test/10.2-timing-boundary` (base: `origin/dev` at `8c84a46`)  
> **Requirements**: BR-08, BR-09, CA-008..012, CA-018, CO-028..031, NF-011, NF-013, T-021..023, T-047  
> **Test Suites**:
>
> - `apps/api/test/timing/timing.spec.ts`
> - `apps/api/test/jobs/auto-submit.spec.ts`
> - `apps/api/test/timing/helpers/` (`timing-pure-logic.ts`, `timing-contract-stubs.ts`, `timing-test-app.ts`, `index.ts`)

---

## 1. Specification & Requirements Traceability

| Requirement ID | Domain             | Invariant / Specification                                                                                                                                                                                        | Verified In Test Suite                                                            |
| :------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **BR-08**      | Timing Enforcement | Timing is strictly server-enforced across duration, window, and combined modes. All stored timestamps are UTC. Client countdown is cosmetic; the server decides access and expiry. Auto-submit occurs at expiry. | `Part A.1`, `Part A.2`, `Part A.3`, `Part B.1`, `Part B.2`, `auto-submit.spec.ts` |
| **BR-09**      | Disconnect Logic   | Timer keeps running while disconnected. `pause_timer_on_disconnect` exists per assessment and defaults to `false`. Consent screen explicitly states this.                                                        | `Part A.1`, `Part A.4`, `Part A.5`, `Part A.7`, `Part B.2`                        |
| **CA-008**     | Fullscreen         | Cloud connect requests full-screen mode.                                                                                                                                                                         | Traceability noted in `timing-contract-stubs.ts`                                  |
| **CA-009**     | Fullscreen Exit    | Exiting fullscreen triggers a disconnect event, logs `fullscreen_exit`, and stops active interaction.                                                                                                            | `Part B.2` contract stubs                                                         |
| **CA-010**     | Autosave           | Files, terminal history, and chat persist continuously (RPO <= 30s) and restore on resume.                                                                                                                       | `Part B.2`, `auto-submit.spec.ts`                                                 |
| **CA-011**     | Resume             | Candidate can reconnect and resume session until duration or window ends.                                                                                                                                        | `Part B.2` contract stubs                                                         |
| **CA-012**     | Timing Access      | Candidate workspace access strictly follows timing rules; access outside window returns HTTP 403.                                                                                                                | `Part A.2`, `Part B.1`                                                            |
| **CA-018**     | Submission         | Candidate submits work; timeout mid-work triggers automatic auto-submission at deadline.                                                                                                                         | `Part A.1`, `auto-submit.spec.ts`                                                 |
| **CO-028**     | Time-bound         | Candidate gets $N$ minutes (15 to 480 min) from first connect.                                                                                                                                                   | `Part A.1`, `Part A.5`, `Part A.7`                                                |
| **CO-030**     | Window-bound       | Candidate may start only between window start and window end; combined mode enforces both rules.                                                                                                                 | `Part A.2`, `Part A.3`                                                            |
| **CO-031**     | Extension          | Company admin can extend time or window for a candidate (`extended_minutes`).                                                                                                                                    | `Part A.1`, `Part A.3`                                                            |
| **NF-011**     | Launch Time        | Workspace launch latency benchmarks and connection tracking.                                                                                                                                                     | `timing-contract-stubs.ts`                                                        |
| **NF-013**     | No Work Loss       | Continuous state capture ensuring candidate work is safely snapshot upon auto-submission.                                                                                                                        | `auto-submit.spec.ts`                                                             |
| **T-021**      | Backlog Task       | Candidate launch & connect endpoint.                                                                                                                                                                             | `timing-contract-stubs.ts`                                                        |
| **T-022**      | Backlog Task       | Candidate autosave, disconnect & resume lifecycle.                                                                                                                                                               | `Part B.2` contract stubs                                                         |
| **T-023**      | Backlog Task       | Candidate time tracking & window rules engine.                                                                                                                                                                   | `Part A.1`, `Part A.2`, `Part A.3`                                                |
| **T-047**      | Backlog Task       | QA: submit, auto-submit, review, release.                                                                                                                                                                        | `auto-submit.spec.ts`                                                             |

---

## 2. Timing Boundary Decisions

All boundary conditions have been codified in `timing-pure-logic.ts` and verified with millisecond-precision tests:

1. **Window Start Boundary (Inclusive)**:

   - $t < \text{window\_start\_utc}$: Status is `'window_not_open'`. HTTP 403 Forbidden with problem code `WINDOW_NOT_OPEN`.
   - $t = \text{window\_start\_utc}$: Status is `'ready'`. HTTP 200 OK.
   - $t > \text{window\_start\_utc}$: Status is `'ready'`. HTTP 200 OK.

2. **Window End Boundary (Inclusive)**:

   - $t < \text{window\_end\_utc}$: Status is `'ready'`. HTTP 200 OK.
   - $t = \text{window\_end\_utc}$: Status is `'ready'`. HTTP 200 OK.
   - $t > \text{window\_end\_utc}$: Status is `'expired'`. HTTP 403 Forbidden with problem code `WINDOW_EXPIRED`.

3. **Submission Timeliness Boundary (Inclusive)**:

   - $\text{submitted\_at} \le \text{deadline\_at}$: Timely submission (`isSubmissionTimely = true`). A submission arriving at the exact millisecond of the deadline is accepted.
   - $\text{submitted\_at} > \text{deadline\_at}$: Untimely submission (`isSubmissionTimely = false`). At $t \ge \text{deadline\_at}$, the auto-submit background sweeper transitions the assignment.

4. **Combined Mode Ceiling Formula (CO-030)**:
   $$\text{effective\_deadline} = \min(\text{first\_connect\_at} + \text{duration\_minutes}, \text{window\_end\_utc}) + \text{extended\_minutes}$$
   If an assessment has a 90-minute duration but the window closes in 45 minutes, the candidate gets only 45 minutes. Extensions granted by the company admin add to this calculated base ceiling.

5. **Pause on Disconnect Calculation (BR-09)**:

   - If `pause_timer_on_disconnect = false` (default):
     $$\text{adjusted\_deadline} = \text{current\_deadline}$$
     The timer never stops during disconnects. Disconnecting and reconnecting does not shift the deadline.
   - If `pause_timer_on_disconnect = true`:
     $$\text{disconnect\_duration} = \max(0, \text{resumed\_at} - \text{disconnected\_at})$$
     $$\text{adjusted\_deadline} = \min(\text{current\_deadline} + \text{disconnect\_duration}, \text{window\_end\_utc} + \text{extended\_minutes})$$
     The deadline shifts forward by the disconnect duration, bounded by any hard window ceiling.

6. **Clock Skew & Backward Time Travel**:
   If the system clock leaps backwards ($\text{resumed\_at} \le \text{disconnected\_at}$), the disconnect duration evaluates to 0, preventing fraudulent deadline extensions.

---

## 3. Product & Engineering Open Decisions

During test suite design against `AGENTS.md` and `openapi.yaml`, the following decisions were identified and recorded:

1. **Launch Outside Window Problem Code**:
   - Before window opens: Confirmed HTTP 403 with `code: "WINDOW_NOT_OPEN"` (`openapi.yaml:386`).
   - After window closes: Proposal is HTTP 403 with `code: "WINDOW_EXPIRED"`. (Alternative suggested in some notes was `ASSIGNMENT_EXPIRED`). Staged for sign-off.
2. **Candidate Disconnect Grace Period**:
   - Confirmed: No grace period exists for candidate sessions. The candidate timer keeps running continuously. (Grace period semantics in the spec apply exclusively to commercial payment renewal dunning under `EX-13`).
3. **Auto-Submit Concurrency & Locking**:
   - When multiple API or worker instances run concurrently, background auto-submit sweeps MUST acquire a PostgreSQL advisory lock (e.g. `pg_try_advisory_xact_lock(...)`) or Redis distributed lock to prevent duplicate submissions or race conditions with manual submissions.
4. **Worker Testability & PostgreSQL `now()` Limitation**:
   - Vitest fake timers (`vi.useFakeTimers()`, `vi.setSystemTime()`) mock Node.js `Date`, but cannot alter PostgreSQL's internal transaction timestamp `now()`.
   - **Mandatory Pattern for Stream 2**: All background workers (including `AutoSubmitWorker`) MUST accept an optional injectable reference timestamp:
     ```ts
     async sweepExpiredAssignments(referenceTime: Date = new Date()): Promise<SweepResult>
     ```
     This allows automated integration suites to execute simulated time travel with fake timers deterministically.

---

## 4. Test Suite Structure & Architecture

The test implementation is divided into two distinct parts:

```
apps/api/test/
├── timing/
│   ├── timing.spec.ts               # Part A (Real) + Part B (Skipped Contract Tests)
│   └── helpers/
│       ├── timing-pure-logic.ts     # Pure mathematical timing calculations & boundaries
│       ├── timing-contract-stubs.ts # Throwing contract stubs documenting Stream 2 contracts
│       ├── timing-test-app.ts       # Fastify test harness, DB probe & session helpers
│       └── index.ts                 # Re-export barrel
└── jobs/
    └── auto-submit.spec.ts          # Auto-submit background sweeper contracts (BR-08, CA-018)
```

### Part A: Real Tests (Executed & Passing)

- **Part A.1**: Simulated time travel duration calculations (15m, 90m, 480m), admin time extension (CO-031), millisecond submission boundaries.
- **Part A.2**: Window boundary state transitions (`window_not_open`, `ready`, `expired`) with 1ms precision before and after window boundaries.
- **Part A.3**: Combined timing mode ceilings (`min(duration, window_end)`).
- **Part A.4**: Calendar and clock irregularities: Daylight Saving Time (DST) fallback preserving exact 5,400s elapsed time in UTC, leap day (Feb 29) rollover, year-end rollover, and backward clock safety.
- **Part A.5**: `TimingConfigSchema` Zod validation: default values (`duration`, 90m, `pauseTimerOnDisconnect: false`, UTC), 15-480m range enforcement, rejection of invalid types.
- **Part A.6**: `FakeAssignmentOwnershipAdapter` time-travel verification: valid 1ms before deadline, invalid at deadline and after deadline.
- **Part A.7**: Database-backed assessment timing persistence on `hellosmart_test`: verifying that `POST /api/v1/company/assessments` correctly stores `pauseTimerOnDisconnect: false` by default, stores custom timing JSONB, and cleans up all rows with zero leftovers.
- **Part A.8**: Fake timer hygiene verification: asserting that real system time is restored in `afterEach`.

### Part B: Skipped Contract Tests (Stream 2 Acceptance Checklist)

- **Candidate Launch Window Contract**:
  - Launch before window opens returns 403 `WINDOW_NOT_OPEN`.
  - Launch after window closes returns 403 `WINDOW_EXPIRED`.
  - 1ms before window start fails with 403; exactly at start succeeds (200 OK).
  - Exactly at window end succeeds (200 OK); 1ms after window end fails with 403.
  - Server-enforced clock overrides client-supplied timestamp.
  - Launch idempotency (reconnecting in_progress does not reset deadline).
  - Cross-tenant / cross-candidate isolation returns 404 (BR-01).
  - Suspended user or suspended organization returns 403 (`USER_SUSPENDED`, `ORGANIZATION_SUSPENDED`).
- **Disconnect & Resume Contract (BR-09)**:
  - Disconnect with `pauseTimerOnDisconnect = false`: deadline remains unchanged after 1s, 10m, and past deadline.
  - Disconnect with `pauseTimerOnDisconnect = false`: rapid disconnect/reconnect storm leaves deadline unchanged.
  - Disconnect with `pauseTimerOnDisconnect = true`: deadline shifts forward by exact disconnect duration on resume.
  - Disconnect with `pauseTimerOnDisconnect = true`: cannot extend past `window_end_utc + extended_minutes` ceiling.
  - Client-supplied disconnect timestamp is ignored.
- **Auto-Submit Background Worker Contract**:
  - Boundary: 1ms before deadline leaves assignment `in_progress`.
  - Boundary: at deadline transitions to `status = 'submitted'`, `auto_submitted = true`.
  - Workspace final snapshot recorded as submission artifact (NF-013).
  - Tamper-evident audit log event written with action `'assignment.auto_submitted'` without candidate PII (BR-31).
  - Worker idempotency: running sweeper multiple times on submitted assignment is a no-op.
  - Concurrency race between manual submit and auto-submit yields exactly one submission.
  - Worker fault tolerance: failure on one assignment rolls back cleanly and resumes batch.
  - Tenant isolation: background queries scoped per organization under RLS (`withOrg`).
  - Results release flag: auto-submitted assignment results remain unreleased by default (`release_results_default = false`, BR-20).

---

## 5. Acceptance Checklist for Stream 2 Developers

When implementing Stream 2 (Candidate Runtime & Background Jobs), follow this checklist to activate the skipped test contracts:

1. [ ] **Database Migration**:
   - Create migration for `app.assignments` with columns: `id`, `org_id`, `assessment_id`, `candidate_id`, `status` (`invited`, `window_not_open`, `ready`, `in_progress`, `disconnected`, `submitted`, `expired`, `revoked`), `invited_at`, `first_connect_at`, `deadline_at`, `extended_minutes`, `submitted_at`, `auto_submitted`.
   - Add foreign keys, RLS policies (`tenant_isolation`), and indexes matching `0013_indexes_and_triggers.sql`.
2. [ ] **Candidate Connect Controller**:
   - Implement `POST /candidate/assignments/:id/connect`.
   - Enforce window status check using `checkWindowStatus()`.
   - Calculate `deadline_at` using `calculateEffectiveDeadline()` on first connect.
3. [ ] **Workspace Events Controller**:
   - Implement `POST /candidate/workspaces/:id/events`.
   - Handle `'disconnect'` and `'resume'` events.
   - If `pause_timer_on_disconnect = true`, adjust `deadline_at` using `calculateResumeDeadline()`.
4. [ ] **AutoSubmitWorker (BullMQ / Scheduler)**:
   - Implement `AutoSubmitWorker` sweeping assignments where `status IN ('in_progress', 'disconnected') AND deadline_at <= now()`.
   - Accept injectable `referenceTime: Date = new Date()` in worker sweep method for testability.
   - Wrap transitions in transaction with `SELECT ... FOR UPDATE SKIP LOCKED` or advisory locks.
   - Emit audit log event `assignment.auto_submitted` using `appendAuditEvent()`.
5. [ ] **Unskip Test Contracts**:
   - In `apps/api/test/timing/timing.spec.ts`, remove `.skip` from `Part B.1` and `Part B.2`.
   - In `apps/api/test/jobs/auto-submit.spec.ts`, remove `.skip` from the worker contract tests.
   - Replace calls to `TimingContractStubs` with real service/HTTP calls.
   - Run `pnpm --filter @hs/api exec vitest run --project timing` to confirm all 50 tests pass green.
