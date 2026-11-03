# Timing, Boundary Expiry & Disconnect Logic Tests (BR-08, BR-09)

> **Document Status**: Production QA Spec & Acceptance Framework (Task 10.2)  
> **Target Branch**: `test/10.2-timing-boundary` (base: `origin/dev` at `8c84a46`)  
> **Requirements**: BR-08, BR-09, CA-005..012, CA-018, CO-011, CO-026, CO-028, CO-031, NF-011, NF-013, T-047  
> **Test Suites**:
>
> - `apps/api/test/timing/timing.spec.ts`
> - `apps/api/test/jobs/auto-submit.spec.ts`
> - `apps/api/test/timing/helpers/` (`timing-pure-logic.ts`, `timing-contract-stubs.ts`, `timing-test-app.ts`, `index.ts`)

---

## 1. Specification & Requirements Verification Matrix

Every requirement ID below has been verified against `AGENTS.md`, `openapi.yaml`, and `zoho/backlog.csv`:

| Requirement ID | Verification Status | Citation (File & Line) | Domain / Invariant Specification                                                                                                   | Test Suite Coverage                                                     |
| :------------- | :------------------ | :--------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **BR-08**      | **VERIFIED**        | `AGENTS.md:339`        | Server-enforced timing across duration, window, and combined modes. UTC storage. Cosmetic client countdown. Auto-submit at expiry. | Part A.1, Part A.2, Part A.3, Part B.1, Part B.2, `auto-submit.spec.ts` |
| **BR-09**      | **VERIFIED**        | `AGENTS.md:340`        | Timer continues while disconnected. `pause_timer_on_disconnect` defaults to `false`. Stated in consent.                            | Part A.1, Part A.4, Part A.5, Part A.7, Part B.2                        |
| **CA-005**     | **VERIFIED**        | `AGENTS.md:582`        | Workspace connect state tracking (`queued` > `provisioning` > `connected`).                                                        | Part B.1 contract stubs                                                 |
| **CA-006**     | **VERIFIED**        | `AGENTS.md:586`        | Task brief, rules, and timing displayed before connect.                                                                            | Part B.1 contract stubs                                                 |
| **CA-007**     | **VERIFIED**        | `AGENTS.md:590`        | Mode-based consent required prior to workspace connect.                                                                            | Part B.1 contract stubs                                                 |
| **CA-008**     | **VERIFIED**        | `AGENTS.md:595`        | Cloud connect requests full-screen mode.                                                                                           | Part B.1 contract stubs                                                 |
| **CA-009**     | **VERIFIED**        | `AGENTS.md:598`        | Fullscreen exit disconnects session, logs `fullscreen_exit`, and stops interaction.                                                | Part B.2 contract stubs                                                 |
| **CA-010**     | **VERIFIED**        | `AGENTS.md:601`        | Continuous work persistence (RPO $\le$ 30s) restoring state on resume.                                                             | Part B.2, `auto-submit.spec.ts`                                         |
| **CA-011**     | **VERIFIED**        | `AGENTS.md:603`        | Candidate reconnect and resume allowed until duration or window ends.                                                              | Part B.2 contract stubs                                                 |
| **CA-012**     | **VERIFIED**        | `AGENTS.md:607`        | Workspace access strictly follows time/window rules; access outside window returns HTTP 403.                                       | Part A.2, Part B.1                                                      |
| **CA-018**     | **VERIFIED**        | `AGENTS.md:631`        | Candidate submits work; timeout mid-work triggers automatic auto-submission.                                                       | Part A.1, `auto-submit.spec.ts`                                         |
| **CO-011**     | **VERIFIED**        | `AGENTS.md:427`        | Add a single candidate (Create candidate account and invite).                                                                      | Verified in test fixtures                                               |
| **CO-026**     | **VERIFIED**        | `AGENTS.md:465`        | Assign candidates to an assessment in bulk.                                                                                        | Traced in assignment flow                                               |
| **CO-028**     | **VERIFIED**        | `AGENTS.md:471`        | Time-bound assessment (duration in minutes/hours from first connect; auto-submit at expiry).                                       | Part A.1, Part A.5, Part A.7                                            |
| **CO-031**     | **VERIFIED**        | `AGENTS.md:477`        | Extend time or window for candidate (`extended_minutes`); revoke access.                                                           | Part A.1, Part A.3                                                      |
| **NF-011**     | **VERIFIED**        | `AGENTS.md:847`        | Workspace launch time benchmark (target p95 < 60s).                                                                                | Part B.1 contract stubs                                                 |
| **NF-013**     | **VERIFIED**        | `AGENTS.md:851`        | No work loss (state autosaved; workspace snapshot saved on destroy/submit).                                                        | `auto-submit.spec.ts`                                                   |
| **T-047**      | **VERIFIED**        | `zoho/backlog.csv:708` | S4 QA: submit, auto-submit, review, release.                                                                                       | `auto-submit.spec.ts`                                                   |

_(Note: T-021, T-022, and T-023 were excluded as timing references because in `zoho/backlog.csv:549-551` they represent workspace orchestrator slot scheduling, WebSocket gateway proxy, and ws-agent snapshot uploads, rather than API timing rules)._

---

## 2. Test Execution Inventory: Product-Code Tests vs Reference-Model Tests vs Skipped Tests

Because candidate runtime timing and background sweeper jobs do not exist on `origin/dev` (scheduled for Stream 2), the test suite comprises **50 tests** structured into: **7 product-code tests**, **1 fake-timer hygiene test**, **16 reference-model tests**, and **26 skipped**:

```
Total Tests: 50
├── 7 product-code tests            (Executed & Passing)
├── 1 fake-timer hygiene test       (Executed & Passing)
├── 16 reference-model tests        (Executed & Passing, Executable Spec)
└── 26 skipped                      (Stream 2 Acceptance Checklist)
```

### 2.1 Product-Code Tests (7 Tests — Executed & Passing)

These tests execute live product code in `@hs/contracts`, `apps/api/src/common/storage`, `apps/api/src/modules/assessments`, and the PostgreSQL test database `hellosmart_test`:

1. **`Part A.5` TimingConfigSchema Contract Validation** (`@hs/contracts/schemas/assessment.ts`):
   - `applies default values for duration, type, tz, and pauseTimerOnDisconnect (BR-09 default false)`
   - `validates duration boundaries: 15 to 480 minutes allowed, outside rejected`
   - `rejects invalid timing type`
   - `CreateAssessmentDtoSchema embeds TimingConfigSchema with pauseTimerOnDisconnect=false default`
2. **`Part A.6` FakeAssignmentOwnershipAdapter Timing Checks** (`apps/api/src/common/storage/assignment-ownership.port.ts`):
   - `validates candidate assignment 1ms before deadline and rejects at/after deadline`
3. **`Part A.7` Database Assessment Timing Persistence on `hellosmart_test`** (`AssessmentsController` + `AssessmentsService` + DB):
   - `POST /api/v1/company/assessments stores timing config with pauseTimerOnDisconnect=false by default (BR-09)`
   - `POST /api/v1/company/assessments persists custom pauseTimerOnDisconnect=true and window timings`

### 2.2 Fake-Timer Hygiene Test (1 Test — Executed & Passing)

- **`Part A.8` Test Environment Fake Timer Hygiene**:
  - `proves fake timers are completely restored and Date uses real system time in subsequent tests`

### 2.3 Reference-Model Tests (16 Tests — Executed & Passing)

These tests execute `timing-pure-logic.ts`, which serves as the **executable mathematical reference specification** for the future Stream 2 candidate runtime:

1. **`Part A.1` Duration Calculations & Simulated Time Travel** (3 tests):
   - Deadline calculation for 15m, 90m, and 480m durations.
   - Deadline extension with `extendedMinutes` (CO-031).
   - Millisecond submission timeliness boundaries (accepted at deadline, rejected 1ms after).
2. **`Part A.2` Window Boundary State Transitions** (3 tests):
   - Window start inclusive boundary (1ms before -> `window_not_open`, at start -> `ready`).
   - Window end inclusive boundary (at end -> `ready`, 1ms after -> `expired`).
   - Pure duration assessments without window bounds always return `ready`.
3. **`Part A.3` Combined Timing Mode Ceilings** (3 tests):
   - Duration applies when duration expires before window end.
   - Window end truncates duration when window closes before duration ends.
   - Extension applied in reference model (flagged with OPEN QUESTION on Readings A, B, and C).
4. **`Part A.4` Calendar & Clock Irregularities** (4 tests):
   - UTC elapsed seconds strictly invariant across Daylight Saving Time (DST) fallback.
   - Leap day (Feb 29) rollover into March 1.
   - Year-end rollover (Dec 31 to Jan 1).
   - Clock skew / backward time travel prevention (disconnect duration $\le$ 0 never extends deadline).
5. **`auto-submit.spec.ts` Pure Logic Auto-Submit Boundaries** (3 tests):
   - 1ms before deadline does not trigger auto-submit.
   - Exactly at deadline triggers auto-submit.
   - Past deadline triggers auto-submit.

### 2.4 Skipped Tests (26 Tests — Stream 2 Specifications)

1. **Candidate Launch Window Contract (`timing.spec.ts` Part B.1, 10 tests)**:
   - Launch before window opens returns HTTP 403 `WINDOW_NOT_OPEN`.
   - Launch after window closes returns HTTP 403 with Problem Details payload (OPEN QUESTION: code `WINDOW_EXPIRED` vs `ASSIGNMENT_EXPIRED`).
   - Launch boundary: 1ms before window start fails with 403.
   - Launch boundary: exactly at window start succeeds (200 OK).
   - Launch boundary: exactly at window end succeeds (200 OK).
   - Launch boundary: 1ms after window end fails with 403.
   - Server clock strictly enforced; client timestamp ignored (BR-08).
   - Launch idempotency (reconnecting `in_progress` does not reset deadline).
   - Cross-candidate isolation returns 404 (BR-01).
   - Suspended candidate or suspended organization returns 403 (`USER_SUSPENDED`, `ORGANIZATION_SUSPENDED`).
2. **Disconnect & Resume Timing Logic (`timing.spec.ts` Part B.2, 5 tests)**:
   - `pauseTimerOnDisconnect = false`: deadline unchanged after 1s, 10m, and past deadline (BR-09).
   - `pauseTimerOnDisconnect = false`: rapid disconnect/reconnect storm leaves deadline unchanged.
   - `pauseTimerOnDisconnect = true`: deadline advances by exact disconnect duration on resume.
   - `pauseTimerOnDisconnect = true`: cannot extend past window end + extended minutes ceiling.
   - `pauseTimerOnDisconnect = true`: client-supplied disconnect timestamp ignored.
3. **Auto-Submit Background Worker Contract (`auto-submit.spec.ts`, 11 tests)**:
   - 1ms before deadline leaves assignment `in_progress`.
   - At deadline transitions assignment to `status = 'submitted'`, `auto_submitted = true`.
   - Final workspace snapshot captured as submission deliverable (NF-013).
   - Append-only audit log entry written with action `'assignment.auto_submitted'` without candidate PII (BR-31).
   - Worker idempotency (re-sweeping already submitted assignment is a no-op).
   - Concurrency race between manual candidate submit and auto-submit sweeper yields exactly one submission.
   - Worker fault tolerance (single assignment error rolls back and continues batch).
   - Tenant isolation (queries scoped inside `withOrg` under RLS).
   - Advisory locking (concurrent worker instances do not double-process batches).
   - Testability (worker accepts injectable `referenceTime: Date` instead of SQL `now()`).
   - Results release (auto-submitted assignment results remain unreleased by default, BR-20).

---

## 3. Boundary Decisions & Invariant Formalization

_(Note: All lifecycle statuses below — `window_not_open`, `ready`, `in_progress`, `disconnected`, `submitted`, `expired`, `revoked` — are proposed, unverified until the `app.assignments` migration exists in Stream 2)._

1. **Window Boundaries (Inclusive)**:
   - $t < \text{window\_start\_utc}$: `'window_not_open'` _(proposed, unverified until the assignments migration exists)_. HTTP 403 (`code: "WINDOW_NOT_OPEN"`).
   - $\text{window\_start\_utc} \le t \le \text{window\_end\_utc}$: `'ready'` _(proposed, unverified until the assignments migration exists)_. HTTP 200 OK.
   - $t > \text{window\_end\_utc}$: `'expired'` _(proposed, unverified until the assignments migration exists)_. HTTP 403 (`code: "WINDOW_EXPIRED"` or `"ASSIGNMENT_EXPIRED"`).
2. **Submission Timeliness (Inclusive)**:
   - $t \le \text{deadline\_at}$: Timely (`isSubmissionTimely = true`). Accepted.
   - $t > \text{deadline\_at}$: Late (`isSubmissionTimely = false`). Auto-submit sweeper transitions assignment to `'submitted'` _(proposed, unverified until the assignments migration exists)_.
3. **Pause on Disconnect Calculation (BR-09)**:
   - `pause_timer_on_disconnect = false` (default):
     $$\text{adjusted\_deadline} = \text{current\_deadline}$$
   - `pause_timer_on_disconnect = true`:
     $$\text{disconnect\_duration} = \max(0, \text{resumed\_at} - \text{disconnected\_at})$$
     $$\text{adjusted\_deadline} = \text{current\_deadline} + \text{disconnect\_duration}$$
   - Transition to `'disconnected'` on fullscreen exit or connection drop _(proposed, unverified until the assignments migration exists)_.

---

## 4. Open Questions Staged for Product & Engineering (Vishal V)

1. **Effective-Deadline Formula for Combined Mode with Extensions**:
   - `AGENTS.md` lines 475-476 (`CO-030`) state:
     > "Combined window plus duration: e.g. start any time within 7 days, then 4 hours; both rules enforced server-side."
   - `AGENTS.md` does **NOT** write out a mathematical formula for `extended_minutes` on a combined assessment. Furthermore, requirement `CO-031` (`AGENTS.md:477`) is titled:
     > "**CO-031** Extend time or window for a candidate; revoke access"
     > This phrasing provides textual evidence that "time" (duration) and "window" extensions may be two separate actions or fields rather than a single scalar.
   - **Question**: When a company admin grants an extension to a candidate in a combined assessment, which formula should be enforced?
     - **Reading A**: $\text{effective\_deadline} = \min(\text{first\_connect} + \text{duration}, \text{window\_end}) + \text{extended\_minutes}$  
       _(The candidate gets the full duration extension regardless of original window end; extension pushes past the window)._
     - **Reading B**: $\text{effective\_deadline} = \min(\text{first\_connect} + \text{duration} + \text{extended\_minutes}, \text{window\_end})$  
       _(The window end is a hard cap; time extensions can never exceed the window end unless the window itself is extended)._
     - **Reading C**: $\text{effective\_deadline} = \min(\text{first\_connect} + \text{duration}, \text{window\_end} + \text{extended\_minutes})$  
       _(If the extension is granted to the window, the candidate gets until the extended window, provided their duration has not expired)._
2. **Problem Code for Launch After Window Closes**:
   - `openapi.yaml:386` specifies `WINDOW_NOT_OPEN` (HTTP 403) before the window starts.
   - When launching after `window_end_utc`, should the Problem Details error code be `WINDOW_EXPIRED` or `ASSIGNMENT_EXPIRED`?
   - The skipped contract test currently asserts HTTP 403 and the Problem Details envelope, leaving the code open.
3. **Worker Infrastructure Architecture**:
   - `apps/worker` exists as a directory containing only `CLAUDE.md` (which mentions SQS queues and EventBridge schedules).
   - In contrast, documentation architecture pages (`apps/docs/content/docs/roles/sde.mdx:50`, `apps/docs/content/docs/architecture/system-architecture.mdx:31,97`) describe `@hs/worker` as running on BullMQ and Redis.
   - **Recommendation**: Clarify whether Stream 2 background workers will use BullMQ/Redis or SQS/EventBridge before implementing `AutoSubmitWorker`.
4. **Worker Testability & PostgreSQL `now()` Constraint**:
   - Vitest fake timers mock JavaScript `Date`, but cannot alter PostgreSQL's transaction timestamp `now()`.
   - The Stream 2 `AutoSubmitWorker` must accept an optional injectable reference timestamp (`referenceTime: Date = new Date()`) in its sweep method to allow automated integration tests to time-travel deterministically.

---

## 5. Acceptance Checklist for Stream 2 Developers

When implementing Stream 2:

1. [ ] Create migration for `app.assignments` (deferred from Stream 1, Task 4.1 per `0013_indexes_and_triggers.sql:19`).
2. [ ] Implement `POST /candidate/assignments/:id/connect` enforcing window boundaries.
3. [ ] Implement `POST /candidate/workspaces/:id/events` handling disconnect and resume events.
4. [ ] Implement `AutoSubmitWorker` with advisory locking and injectable reference time.
5. [ ] Resolve open questions 1 and 2 with Vishal V.
6. [ ] Remove `.skip` from `Part B.1` & `Part B.2` in `timing.spec.ts` and `auto-submit.spec.ts`.
7. [ ] Run `pnpm --filter @hs/api exec vitest run --project timing` to confirm all 50 tests pass green.
