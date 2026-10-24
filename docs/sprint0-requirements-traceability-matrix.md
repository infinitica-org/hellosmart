# HelloSmart.ai — Sprint 0 Requirements-to-Test Traceability Matrix

> **Document ID:** S0-RTM-001  
> **Author:** Vishal Bharath (SDE-1), AI-assisted derivation  
> **Date:** 2026-10-23  
> **Source of truth:** `d:\hellosmart\AGENTS.md` (v0.2) and `d:\hellosmart\HelloSmart_BRD.md`  
> **Verified requirement count:** 126 MMP requirements (150 total; 24 deferred to Phase 2/3)  
> **BR coverage:** 34 business rules (BR-01 … BR-34) — all mapped from AGENTS.md §8 and §16  

---

> [!IMPORTANT]
> Every status in this matrix reflects **actual repository state as of Sprint 0** (2026-10-23).  
> No test is marked passing without evidence. No control is marked implemented without source-code or config evidence.  
> BR mappings are **derived** from AGENTS.md §8 (rule text) and §16 (required tests table) — not from inline annotations on requirement entries, which do not exist.

---

## 0. Summary & Test Status Audit

### 0.1 Feature Implementation Status

| Domain | MMP Count | Must | Should | Could | Implemented | Partial (Config/IaC) | Not Started |
|---|---|---|---|---|---|---|---|
| CO — Company | 50 | 39 | 10 | 1 | 0 | 7 | 43 |
| CA — Candidate | 18 | 13 | 5 | 0 | 0 | 1 | 17 |
| AD — Platform Admin | 25 | 17 | 8 | 0 | 0 | 2 | 23 |
| SP — Sales/Payments | 18 | 11 | 6 | 1 | 0 | 1 | 17 |
| NF — Non-Functional | 15 | 9 | 6 | 0 | 0 | 4 | 11 |
| **Total** | **126** | **89** | **35** | **2** | **0** | **15** | **111** |

### 0.2 Test State Distinction Audit (Sprint 0 Baseline)

| Test Lifecycle State | Count | Percentage | Definition & Audit Evidence |
|---|---|---|---|
| **Planned Tests** | **126 / 126** | **100%** | Target test file path and verification method explicitly defined for every requirement in this matrix. |
| **Implemented Tests** | **0 / 126** | **0%** | Zero test files exist in `d:\hellosmart\tests\`. No test assertions have been authored. |
| **Executed Tests** | **0 / 126** | **0%** | Zero test suites have been run locally or in CI pipelines. |
| **Passed Tests** | **0 / 126** | **0%** | Zero tests marked as passed. No passing status or verification claims are made without recorded execution evidence. |

**Status legend:**
| Code | Category | Meaning |
|---|---|---|
| `Not Started` | Feature | No application logic, schema, or IaC exists |
| `Partial — Config` | Feature | Schema (`openapi.yaml`, migrations), IaC (`Terraform`), or adapter contract exists; runtime logic not built |
| `Planned (Unwritten)` | Test | Test path and method defined in S0-RTM-001; test code file not yet authored |
| `Implemented` | Test | Test file authored with assertions; awaiting execution |
| `Executed` | Test | Test executed in target test environment with captured logs |
| `Passed` | Test | Test executed and passed against recorded acceptance thresholds |

> [!NOTE]
> "Partial — Config" items have concrete evidence in: `openapi.yaml`, `packages/db/src/migrations/0001_*.sql`, `apps/api/src/middleware/with-org.ts`, `infra/terraform/`, or `packages/adapters/src/index.ts`. All 126 requirements currently have test status `Planned (Unwritten)`.

---

## 1. Non-MMP Requirements (Excluded from Matrix)

These 24 IDs are Phase 2 or Phase 3 and **must not be built in MMP**. They are excluded from the matrix below.

| ID | Title | Phase |
|---|---|---|
| CO-007 | Company team members and roles | Phase 2 |
| CO-027 | Clone, close and archive assessments | Phase 2 |
| CO-036 | Use HelloSmart AI credits instead of own key | Phase 2 |
| CO-040 | Choose agent mode | Phase 2 |
| CO-049 | Compare candidates and shortlist | Phase 2 |
| CO-050 | Export report | Phase 2 |
| CO-057 | Organization audit log | Phase 2 |
| CO-058 | ATS integration and API/webhooks | Phase 3 |
| CA-014 | Runnable locally | Phase 2 |
| CA-016 | Browser workspace | Phase 2 |
| CA-021 | Profile and data rights | Phase 2 |
| CA-022 | Accessible UI and accommodation requests | Phase 2 |
| CA-023 | Integrity events logged | Phase 2 |
| AD-005 | Impersonate/support-view a company | Phase 2 |
| AD-016 | Re-run or force a review | Phase 2 |
| AD-020 | Capacity and warm pool management | Phase 2 |
| AD-024 | Manage HelloSmart-managed AI credits | Phase 2 |
| SP-019 | Stripe gateway for international customers | Phase 2 |
| SP-020 | Refunds and credit notes | Phase 2 |
| SP-021 | Revenue and payment reporting for admin | Phase 2 |
| SP-022 | Dedicated instance / VPC deployment | Phase 3 |
| NF-009 | Fairness monitoring | Phase 3 |
| NF-010 | SOC 2 / ISO 27001 readiness | Phase 3 |
| NF-016 | Accessibility and browser support | Phase 2 |

---

## 2. CO — Company (Company Admin) — 50 MMP Requirements

### 2.1 Authentication

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-001 | Sign in with email and password | Must | Integration test — auth flow | `tests/integration/auth/email-password.test.ts` | argon2/bcrypt hash; expiring reset link; throttle/lockout after failures; configurable session expiry | BR-25 | Not Started | Planned (Unwritten) |
| CO-002 | Sign in with Google SSO | Must | Integration test — SSO flow | `tests/integration/auth/google-sso.test.ts` | Google auth; matched on verified email; no org created by SSO | BR-04, BR-25 | Not Started | Planned (Unwritten) |
| CO-003 | Sign in with Microsoft SSO | Must | Integration test — SSO flow | `tests/integration/auth/microsoft-sso.test.ts` | Microsoft/Entra auth; matched on verified email | BR-04, BR-25 | Not Started | Planned (Unwritten) |
| CO-004 | Master login with role-based routing | Must | E2E test — RBAC routing | `tests/e2e/auth/role-routing.test.ts` | Single login URL; role-correct portal redirect; candidates cannot reach company routes; admins cannot reach via this route | BR-25 | Partial — Config | Planned (Unwritten) |

> [!NOTE]
> CO-004 is `Partial — Config` because `apps/api/src/middleware/with-org.ts` and the auth middleware stubs exist but runtime routing is not implemented.

### 2.2 Account

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-005 | Company account is provisioned by HelloSmart after sales call | Must | Integration test — provisioning | `tests/integration/admin/provision-org.test.ts` | Org + first Company Admin + trial created by Platform Admin only; invite email sent; no public self-signup | BR-04 | Not Started | Planned (Unwritten) |
| CO-006 | Manage organization name and profile | Must | Integration test + audit check | `tests/integration/company/org-profile.test.ts` | Org name editable; reflected everywhere; change audit-logged | BR-31 | Not Started | Planned (Unwritten) |

### 2.3 Trial

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-008 | Trial period with X templates, Y candidate cap, Z days | Must | Integration test — entitlements | `tests/integration/entitlements/trial-limits.test.ts` | Entitlements set by Platform Admin; enforced server-side; banner shows usage | BR-05 | Not Started | Planned (Unwritten) |
| CO-009 | Trial limits enforced with clear messaging | Must | Integration test — cap enforcement | `tests/integration/entitlements/cap-block.test.ts` | At cap or expiry: new actions blocked with CTA; data stays readable; candidate counted once at first launch; pending invites capped at 2x | BR-05, BR-06, BR-07 | Not Started | Planned (Unwritten) |
| CO-010 | Trial upgrade to paid plan | Must | Integration test — payment → entitlement | `tests/integration/payments/upgrade-entitlement.test.ts` | On payment success entitlements switch; no data loss | BR-05, BR-07 | Not Started | Planned (Unwritten) |

### 2.4 Candidates

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-011 | Add a single candidate (Create) | Must | Integration test — CRUD + tenancy | `tests/integration/candidates/create.test.ts` | Name + email required; format + org-uniqueness validated; counts against cap rules | BR-01, BR-06 | Not Started | Planned (Unwritten) |
| CO-012 | Bulk upload candidates | Must | Integration test — bulk import | `tests/integration/candidates/bulk-upload.test.ts` | CSV/XLSX; downloadable template; per-row validation; duplicates skipped + reported; error report; row limit | BR-01 | Not Started | Planned (Unwritten) |
| CO-013 | Automatic account-created email with link | Must | Integration test — email dispatch | `tests/integration/candidates/invite-email.test.ts` | Secure link sent on creation; first login forces password reset; link single-use + expiring; can be resent | BR-24 | Not Started | Planned (Unwritten) |
| CO-014 | View, search and filter candidates (Read) | Must | Integration test — list + tenancy | `tests/integration/candidates/list.test.ts` | List with status; search by name/email; filter by assessment/status; pagination; org-scoped (no cross-tenant) | BR-01 | Not Started | Planned (Unwritten) |
| CO-015 | Edit candidate (Update) | Must | Integration test — CRUD | `tests/integration/candidates/update.test.ts` | Name editable; email editable until activation (change triggers re-verification after) | BR-01 | Not Started | Planned (Unwritten) |
| CO-016 | Delete candidate (Delete) | Must | Integration test — soft-delete + audit | `tests/integration/candidates/delete.test.ts` | Soft delete with confirmation; active workspaces destroyed; submissions retained per retention setting; audit-logged | BR-01, BR-26, BR-31 | Not Started | Planned (Unwritten) |
| CO-017 | Resend invite / reset candidate access | Should | Integration test — invite resend | `tests/integration/candidates/resend-invite.test.ts` | One-click resend; reset password link; action audit-logged | BR-24, BR-31 | Not Started | Planned (Unwritten) |

### 2.5 Tasks and Templates

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-018 | Browse templates available to my company only | Must | Integration test — template privacy | `tests/integration/templates/org-catalog.test.ts` | Only org-assigned templates visible; no public or cross-company templates | BR-02 | Not Started | Planned (Unwritten) |
| CO-019 | Preview a template | Must | Integration test — preview API | `tests/integration/templates/preview.test.ts` | Shows scenario, deliverables, tech stack, mode, duration, AI policy, default reviewer agents | BR-02 | Not Started | Planned (Unwritten) |
| CO-020 | Create an assessment from a template with a task name | Must | Integration test — assessment creation | `tests/integration/assessments/create.test.ts` | Names the assessment; pins template version; edits never alter master template | BR-03 | Not Started | Planned (Unwritten) |
| CO-021 | Edit candidate-facing brief and deliverables | Should | Integration test — brief edit | `tests/integration/assessments/edit-brief.test.ts` | Title, description, instructions, deliverables editable within template's editable fields | BR-03 | Not Started | Planned (Unwritten) |
| CO-022 | Choose workspace mode | Must | Integration test — mode selection | `tests/integration/assessments/workspace-mode.test.ts` | MMP: Cloud VM and Chat selectable; Local/Browser shown as locked; selection drives consent and provisioning | — | Not Started | Planned (Unwritten) |
| CO-023 | Configure environment variables and secrets | Must | Integration test — env slot | `tests/integration/assessments/env-slots.test.ts` | Required slots from template; values encrypted, masked in UI, injected only into session | BR-13, BR-16 | Not Started | Planned (Unwritten) |
| CO-024 | Dry-run preview as candidate before publishing | Should | Integration test — dry run | `tests/integration/assessments/dry-run.test.ts` | Company launches a test session; publish blocked until dry run passes | — | Not Started | Planned (Unwritten) |
| CO-025 | Publish and deploy to candidates | Must | Integration test — publish flow | `tests/integration/assessments/publish.test.ts` | Candidates selected; publish provisions access and sends assignment email; lifecycle: Draft > Published > Closed > Archived | — | Not Started | Planned (Unwritten) |
| CO-026 | Assign candidates to an assessment in bulk | Must | Integration test — bulk assign | `tests/integration/assessments/bulk-assign.test.ts` | Multi-select or filter; assignments respect caps; each candidate sees only their assigned tasks | BR-05, BR-06 | Not Started | Planned (Unwritten) |

### 2.6 Timing

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-028 | Time-bound assessment | Must | Integration test — timer enforcement | `tests/integration/timing/duration.test.ts` | Duration starts at first connect; countdown visible; auto-submit at expiry | BR-08 | Not Started | Planned (Unwritten) |
| CO-029 | Window-bound assessment | Must | Integration test — window enforcement | `tests/integration/timing/window.test.ts` | Start/end date-time with timezone; workspace inaccessible outside window | BR-08 | Not Started | Planned (Unwritten) |
| CO-030 | Combined window plus duration | Must | Integration test — combined timing | `tests/integration/timing/combined.test.ts` | Both rules enforced server-side; e.g. start any time in 7 days then 4 hours | BR-08 | Not Started | Planned (Unwritten) |
| CO-031 | Extend time or window for a candidate; revoke access | Should | Integration test — extension + revoke | `tests/integration/timing/extend-revoke.test.ts` | Company can grant extension or revoke; both audit-logged; shown to candidate | BR-08, BR-31 | Not Started | Planned (Unwritten) |

### 2.7 AI Providers

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-032 | Add AI provider API keys in settings | Must | Integration test — key vault | `tests/integration/ai-keys/manage-keys.test.ts` | Providers stored encrypted in vault; shown masked (last 4); test-connection; rotate and delete; set default; never exposed to candidates | BR-13, BR-16, BR-17 | Not Started | Planned (Unwritten) |

### 2.8 AI Controls

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-033 | AI assistant ON/OFF per assessment | Must | Integration test + network test | `tests/integration/ai-policy/ai-toggle.test.ts` | Toggle per assessment; when OFF: assistant removed and AI domains blocked in cloud workspaces | BR-14 | Not Started | Planned (Unwritten) |
| CO-034 | Select provider/key and allowed models per assessment | Must | Integration test — proxy enforcement | `tests/integration/ai-policy/model-allowlist.test.ts` | Company picks key source and model allowlist; all calls via HelloSmart AI proxy | BR-13 | Not Started | Planned (Unwritten) |
| CO-035 | Usage caps per candidate and per assessment | Must | Integration test — cap enforcement | `tests/integration/ai-policy/caps.test.ts` | Caps in tokens or currency plus RPM; warn then block at cap; candidate sees remaining budget | BR-15 | Not Started | Planned (Unwritten) |
| CO-037 | AI usage and cost visibility | Should | Integration test — usage dashboard | `tests/integration/ai-policy/usage-visibility.test.ts` | Per-assessment and org-wide tokens/cost by candidate and model | BR-15 | Not Started | Planned (Unwritten) |

### 2.9 Rubrics / Reviewer Agents

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-038 | Define a custom rubric as reviewer agents | Must | Integration test — rubric CRUD | `tests/integration/rubric/define-rubric.test.ts` | Each item: name, goal, signals, scale+anchors, weight, red flags; weights total 100% | BR-18, BR-19 [Pending Confirmation] | Not Started | Planned (Unwritten) |
| CO-039 | Start from default rubric of the template or the agent library | Must | Integration test — rubric defaults | `tests/integration/rubric/default-rubric.test.ts` | Company can accept, edit, add or remove items; changes versioned per assessment | BR-18, BR-19 [Pending Confirmation] | Not Started | Planned (Unwritten) |

### 2.10 Submissions and Progress

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-041 | See all submissions and progress | Must | Integration test — submissions list + tenancy | `tests/integration/submissions/list.test.ts` | Table per assessment: candidate, status, time used, last activity, score; org-scoped | BR-01 | Not Started | Planned (Unwritten) |
| CO-042 | Submission detail view | Must | Integration test — submission detail | `tests/integration/submissions/detail.test.ts` | Shows deliverables, activity timeline, AI transcript, final snapshot, per-agent reports with evidence | BR-18 | Not Started | Planned (Unwritten) |

### 2.11 Workspaces

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-043 | See active workspaces | Must | Integration test — workspace list + tenancy | `tests/integration/workspaces/active-list.test.ts` | List with candidate, assessment, mode, status, started time, time left; auto-refresh; org-scoped | BR-01 | Not Started | Planned (Unwritten) |
| CO-044 | Destroy a workspace at any time | Must | Integration test — destroy + audit | `tests/integration/workspaces/destroy.test.ts` | Confirmation dialog; state snapshotted first; candidate notified; action audit-logged | BR-22, BR-31 | Not Started | Planned (Unwritten) |

### 2.12 Review and Results

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-045 | Provide scores per rubric item and overall | Must | Integration test — scoring | `tests/integration/review/score.test.ts` | Reviewer enters score per dimension and overall; accept or override agent scores; overrides audit-logged; original agent scores never overwritten | BR-20, BR-31, BR-32 | Not Started | Planned (Unwritten) |
| CO-046 | Add custom notes | Must | Integration test — notes | `tests/integration/review/notes.test.ts` | Free-text note at dimension and overall level; visible to company users; optionally shared with candidate | BR-20 | Not Started | Planned (Unwritten) |
| CO-047 | Edit scores after finalization with versioned history | Must | Integration test — versioned edit | `tests/integration/review/versioned-edit.test.ts` | Authorized users can edit finalized results; each edit creates new version; original agent scores preserved; released results updated if already released | BR-20 | Not Started | Planned (Unwritten) |
| CO-048 | Release results to candidates | Must | Integration test — release toggle | `tests/integration/review/release.test.ts` | Per-assessment or per-candidate toggle; when ON candidate sees scores and shared notes; default OFF | BR-20 | Not Started | Planned (Unwritten) |

### 2.13 Analytics

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-051 | Analytics per assessment | Must | Integration test — analytics + tenancy | `tests/integration/analytics/per-assessment.test.ts` | Invited/started/completed/expired; completion rate; avg time; score distribution; per-rubric averages; AI usage; agent agreement; org-scoped | BR-01 | Not Started | Planned (Unwritten) |
| CO-052 | Overall analytics across assessments | Must | Integration test — org analytics | `tests/integration/analytics/org-rollup.test.ts` | Org-level rollups with date filter; usage against plan entitlements; org-scoped | BR-01 | Not Started | Planned (Unwritten) |

### 2.14 Settings

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-053 | Central settings page | Must | E2E test — settings navigation | `tests/e2e/settings/settings-page.test.ts` | Sections: Organization, Branding, AI providers, Team, Notifications, Billing, Data retention | — | Not Started | Planned (Unwritten) |

### 2.15 Branding

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-054 | Upload logo for candidate portal, emails and reports | Must | Integration test — logo upload | `tests/integration/branding/logo-upload.test.ts` | PNG/SVG with size limits; shown in default location on candidate portal and reports | BR-28, BR-29 | Not Started | Planned (Unwritten) |
| CO-055 | Default 'Powered by hellosmart.ai' mark in a corner | Must | E2E test — branding assertion | `tests/e2e/branding/powered-by-mark.test.ts` | Shown on candidate portal and reports by default; removable only when white-label entitlement is active | BR-28, BR-29 | Not Started | Planned (Unwritten) |

### 2.16 Billing

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CO-056 | View quotes, invoices and pay in-app | Must | Integration test — billing UI | `tests/integration/billing/view-pay.test.ts` | Company Admin sees pending quotes and invoices; can pay online; download receipts; manage recurring subscription | BR-30 | Not Started | Planned (Unwritten) |

---

## 3. CA — Candidate — 18 MMP Requirements

### 3.1 Access

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-001 | Access via emailed link | Must | Integration test — candidate onboarding | `tests/integration/auth/candidate-link.test.ts` | Link opens set-password page; password reset forced on first login; link single-use and expiring | BR-24 | Not Started | Planned (Unwritten) |
| CA-002 | Sign in from the master login with RBAC | Must | Integration test — RBAC routing | `tests/integration/auth/candidate-routing.test.ts` | Same login page as other roles; role Candidate lands on candidate portal; cannot reach company or admin routes | BR-25 | Partial — Config | Planned (Unwritten) |
| CA-003 | Forgot / reset password; change password | Must | Integration test — password reset | `tests/integration/auth/password-reset.test.ts` | Emailed reset link; password policy enforced | — | Not Started | Planned (Unwritten) |

> [!NOTE]
> CA-002 is `Partial — Config` because `apps/api/src/middleware/with-org.ts` scopes requests by role and org, but the candidate route guard is not runtime-implemented.

### 3.2 Dashboard

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-004 | See assigned workspaces (tasks) | Must | Integration test — candidate dashboard | `tests/integration/candidate/dashboard.test.ts` | Cards/list with task name, company, mode, time rules, status; org-scoped to own assignments | BR-01 | Not Started | Planned (Unwritten) |
| CA-005 | Workspace connect state | Must | Integration test — connect state | `tests/integration/candidate/connect-state.test.ts` | Each workspace shows Connected/Not connected with Connect/Resume button | — | Not Started | Planned (Unwritten) |

### 3.3 Pre-flight

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-006 | Task brief, rules and timing before connect | Must | E2E test — pre-flight screen | `tests/e2e/candidate/preflight.test.ts` | Shows brief, deliverables, duration/window, AI policy (on/off, caps) and what is recorded | — | Not Started | Planned (Unwritten) |

### 3.4 Consent

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-007 | Mode-based consent before connecting | Must | Integration test — consent gate | `tests/integration/candidate/consent.test.ts` | Consent text depends on mode; Connect disabled until consent given; store consent version, timestamp, IP | BR-12 | Not Started | Planned (Unwritten) |

### 3.5 Cloud Workspace

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-008 | Force full-screen when connecting in Cloud mode | Must | E2E test — fullscreen API | `tests/e2e/workspace/fullscreen-connect.test.ts` | Workspace requests full screen on connect; session active only while full screen | BR-10 | Not Started | Planned (Unwritten) |
| CA-009 | Exit from full screen disconnects the session | Must | E2E test — fullscreen exit | `tests/e2e/workspace/fullscreen-exit.test.ts` | On exit: workspace disconnects; overlay asks to resume; event logged; timer keeps running (BR-09); pause_timer_on_disconnect=false by default; consent warns candidate | BR-09, BR-10 | Not Started | Planned (Unwritten) |
| CA-010 | All work is saved so the candidate can continue | Must | Integration test — autosave RPO | `tests/integration/workspace/autosave-rpo.test.ts` | Files, terminal history, editor state, chat transcript, drafts persisted continuously; RPO <= 30 s; restored on resume | BR-11 | Not Started | Planned (Unwritten) |
| CA-011 | Reconnect and resume | Must | Integration test — resume | `tests/integration/workspace/resume.test.ts` | Candidate can reconnect until timer or window ends; state restored; each disconnect/resume logged | BR-11 | Not Started | Planned (Unwritten) |

### 3.6 Timing

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-012 | Workspace access follows time-bound or window-bound rules | Must | Integration test — timing server enforcement | `tests/integration/timing/candidate-access.test.ts` | Before window opens/after it closes: Connect disabled; time-bound sessions auto-submit at expiry; enforced server-side | BR-08 | Not Started | Planned (Unwritten) |
| CA-013 | Countdown timer and warnings | Must | E2E test — timer display | `tests/e2e/workspace/countdown.test.ts` | Always visible; warnings at thresholds (e.g. 15 and 5 minutes) | BR-08 | Not Started | Planned (Unwritten) |

### 3.7 Non-tech Modes

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-015 | Chat workspace for non-technical roles | Must | Integration test — chat session | `tests/integration/workspace/chat-mode.test.ts` | AI chat using company's key (or platform key); files/documents provided; full transcript captured | BR-13, BR-17 | Not Started | Planned (Unwritten) |

### 3.8 AI Assistant

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-017 | Use AI assistant when enabled | Must | Integration test — AI assistant gating | `tests/integration/ai-policy/candidate-assistant.test.ts` | Assistant available only if ON for assessment; shows remaining budget; blocks at cap with clear message | BR-13, BR-14, BR-15 | Not Started | Planned (Unwritten) |

### 3.9 Submission

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-018 | Submit work | Must | Integration test — submission flow | `tests/integration/candidate/submit.test.ts` | Confirmation dialog; final snapshot saved; session closed; candidate cannot re-enter after submit unless company reopens | — | Not Started | Planned (Unwritten) |
| CA-019 | Provisioning failure handling | Should | Integration test — failure handling | `tests/integration/workspace/provision-failure.test.ts` | If workspace fails to start: candidate sees support route; compensated with extra time automatically | BR-33 | Not Started | Planned (Unwritten) |

### 3.10 Results

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| CA-020 | View results when provisioned by the company | Must | Integration test — results visibility | `tests/integration/candidate/view-results.test.ts` | Only visible if company released them; shows overall and per-dimension scores and shared notes | — | Not Started | Planned (Unwritten) |

---

## 4. AD — Platform Admin — 25 MMP Requirements

### 4.1 Access Control

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-001 | Platform Admin master login with MFA | Must | Integration test — MFA enforcement | `tests/integration/auth/admin-mfa.test.ts` | MFA mandatory; session timeout; IP/device logging | BR-25 | Not Started | Planned (Unwritten) |

### 4.2 Accounts

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-002 | Create all types of accounts | Must | Integration test — account creation | `tests/integration/admin/create-accounts.test.ts` | Platform Admin can create orgs, Company Admins, Candidates, internal staff; sends invite emails | BR-04 | Not Started | Planned (Unwritten) |
| AD-003 | Role-based access control matrix | Must | Integration test — RBAC matrix | `tests/integration/auth/rbac-matrix.test.ts` | Defined roles with permission sets; least privilege enforced server-side | BR-25 | Partial — Config | Planned (Unwritten) |
| AD-004 | Enable/disable/suspend orgs and users | Must | Integration test — suspension | `tests/integration/admin/suspend-org.test.ts` | Suspension blocks login and workspace launch; reversible; audit-logged | BR-31 | Not Started | Planned (Unwritten) |

> [!NOTE]
> AD-003 is `Partial — Config` because the RBAC permission matrix is specified in `openapi.yaml` x-permission annotations and the `with-org.ts` middleware, but full enforcement is not implemented.

### 4.3 Trial and Entitlements

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-006 | Provision trial with X templates, Y candidates, Z days per org | Must | Integration test — trial provisioning | `tests/integration/admin/provision-trial.test.ts` | Values set at provisioning and editable later; usage counters visible | BR-05 | Not Started | Planned (Unwritten) |
| AD-007 | Per-org entitlement overrides and feature flags | Must | Integration test — flags + entitlements | `tests/integration/admin/entitlement-flags.test.ts` | Toggle workspace modes, white label, custom domain, extra agents, retention days, AI credits | BR-05, BR-29 | Not Started | Planned (Unwritten) |

### 4.4 Pricing and Plans

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-008 | Maintain pricing plans and features | Must | Integration test — plan catalog | `tests/integration/admin/plan-catalog.test.ts` | Plan catalog with price, billing interval, limits, features; change history; new plans don't alter existing contracts silently | — | Not Started | Planned (Unwritten) |
| AD-009 | Add-on catalog | Must | Integration test — addon catalog | `tests/integration/admin/addon-catalog.test.ts` | Add-ons: white label, custom routing/domain, custom template build, local mode, extended retention, extra agents, AI credits packs | BR-28, BR-29 | Not Started | Planned (Unwritten) |

### 4.5 Templates

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-010 | Build and manage task templates | Must | Integration test — template management | `tests/integration/admin/template-management.test.ts` | Create manifest (scenario, resources, env, env slots, AI defaults, reviewers, timing); versioned; draft > tested > published | BR-03 | Not Started | Planned (Unwritten) |
| AD-011 | Templates are private per company | Must | Integration test — template privacy + tenancy | `tests/integration/templates/privacy.test.ts` | Each template assigned to specific org(s); no public marketplace; cross-org reads return 404 | BR-02 | Not Started | Planned (Unwritten) |
| AD-012 | Clone a base template into a company-specific copy | Must | Integration test — template clone | `tests/integration/admin/template-clone.test.ts` | Clone, customize and assign to one org; lineage tracked | BR-02, BR-03 | Not Started | Planned (Unwritten) |
| AD-013 | Build resources and golden images | Must | Integration test — image build | `tests/integration/admin/golden-image.test.ts` | Codebase at pinned commit, seed data, services, env slots; automated smoke test must pass before publish | BR-03 | Not Started | Planned (Unwritten) |

### 4.6 Agents

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-014 | Maintain reviewer agent library | Must | Integration test — agent library | `tests/integration/admin/agent-library.test.ts` | Define agents (prompt/config, model, version, enabled flag); version and roll back | BR-18, BR-21 | Not Started | Planned (Unwritten) |
| AD-015 | Monitor each independent agent's performance and health | Must | Integration test — agent health | `tests/integration/admin/agent-health.test.ts` | Dashboard per agent: success/failure rate, latency, queue depth, cost per review, score consistency, inter-agent agreement, drift; alerts on thresholds | BR-21 | Not Started | Planned (Unwritten) |
| AD-017 | Prompt-injection and gaming safeguards for graders | Must | Security test — adversarial grader | `tests/security/grader/prompt-injection.test.ts` | Grader inputs sanitized; adversarial test suite; flags suspicious submissions for human review | BR-18 | Not Started | Planned (Unwritten) |

### 4.7 Workspaces

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-018 | Oversee all workspaces across orgs | Must | Integration test — global workspace list | `tests/integration/admin/global-workspaces.test.ts` | Global list with org, candidate, mode, status, age, resource usage, cost; filters and search | BR-01 | Not Started | Planned (Unwritten) |
| AD-019 | Force-destroy any workspace; orphan and idle cleanup | Must | Integration test — force destroy + cleanup | `tests/integration/admin/force-destroy.test.ts` | Auto-destroy at session end/expiry; orphan detection job; spend alerts | BR-22, BR-23 | Not Started | Planned (Unwritten) |

### 4.8 Routing and Branding

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-021 | Configure custom routing/domain for an org | Should | Integration test — custom domain | `tests/integration/admin/custom-domain.test.ts` | Custom domain, DNS verification, automatic SSL; candidate links and emails use it; only if entitlement active | BR-28, BR-29 | Not Started | Planned (Unwritten) |
| AD-022 | Configure white label for an org | Should | Integration test — white label | `tests/integration/admin/white-label.test.ts` | Remove 'Powered by' mark, custom colors/logo, custom email sender domain; only if entitlement active | BR-28, BR-29 | Not Started | Planned (Unwritten) |

### 4.9 AI Credits

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-023 | Manually allocate a platform AI key and cap to an org (MMP interim) | Must | Integration test — platform key allocation | `tests/integration/admin/platform-key-alloc.test.ts` | Admin assigns platform-held key with token/currency cap per org and per assessment; usage visible; billed as quoted line item; revocable | BR-13, BR-17 | Not Started | Planned (Unwritten) |

### 4.10 Analytics

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-025 | Platform-wide analytics | Should | Integration test — platform analytics | `tests/integration/admin/platform-analytics.test.ts` | Orgs, trials, conversion, usage, workspace cost, agent cost, revenue | BR-01 | Not Started | Planned (Unwritten) |

### 4.11 Support

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-026 | Extend trial, candidate window or re-provision a session | Must | Integration test — admin support tools | `tests/integration/admin/extend-trial.test.ts` | Admin tools with reason and audit log | BR-31 | Not Started | Planned (Unwritten) |

### 4.12 Governance

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-027 | Global audit log | Must | Integration test — audit log immutability | `tests/integration/admin/audit-log.test.ts` | Immutable log of admin actions, config and data access; append-only | BR-31 | Not Started | Planned (Unwritten) |
| AD-028 | Data retention and deletion policy controls | Must | Integration test — retention + auto-delete | `tests/integration/admin/data-retention.test.ts` | Default 90-day retention after assessment closes; configurable per org within platform limits; automatic deletion jobs; every deletion logged | BR-26, BR-27 | Not Started | Planned (Unwritten) |

### 4.13 Communications

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| AD-029 | Manage email templates | Should | Integration test — email templates | `tests/integration/admin/email-templates.test.ts` | Invite, password reset, assignment, reminders, payment; variables and preview | BR-34 [Pending Confirmation] | Not Started | Planned (Unwritten) |

---

## 5. SP — Sales Motion, Provisioning and Payments — 18 MMP Requirements

### 5.1 Landing and Booking

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| SP-001 | Landing page with product pitch and category | Must | E2E test — landing page | `tests/e2e/landing/pitch.test.ts` | States category, vision, how it works, use cases; single primary CTA 'Book a meeting' | — | Not Started | Planned (Unwritten) |
| SP-002 | cal.com meeting booking | Must | Integration test — booking flow | `tests/integration/sales/calcom-booking.test.ts` | Embedded cal.com booking; UTM and source captured; booking confirmation email | — | Not Started | Planned (Unwritten) |
| SP-003 | Booking webhook creates a lead in admin | Should | Integration test — webhook lead | `tests/integration/sales/booking-webhook.test.ts` | cal.com webhook creates/updates lead with name, email, company, time; idempotent | — | Partial — Config | Planned (Unwritten) |

> [!NOTE]
> SP-003 is `Partial — Config` because `packages/adapters/src/index.ts` defines the webhook adapter interface but no handler is implemented.

### 5.2 Deal Pipeline

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| SP-004 | Track deal stages in admin | Should | Integration test — deal pipeline | `tests/integration/sales/deal-pipeline.test.ts` | Stages: Lead, Meeting booked, Meeting held, Quoted, Paid, Provisioned; owner and notes | — | Not Started | Planned (Unwritten) |

### 5.3 Provisioning

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| SP-005 | Provision the customer directly on the standard HelloSmart route | Must | Integration test — provisioning | `tests/integration/admin/standard-provision.test.ts` | Admin creates org on multi-tenant route in minutes; no separate infrastructure | BR-04 | Not Started | Planned (Unwritten) |
| SP-006 | Customer-specific custom templates | Must | Integration test — private templates | `tests/integration/templates/custom-template.test.ts` | Templates prepared for a company assigned to that company only; custom template build quoted as line item | BR-02 | Not Started | Planned (Unwritten) |

### 5.4 Add-ons

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| SP-007 | Own routing / custom domain as a paid add-on | Must | Integration test — add-on gate | `tests/integration/sales/custom-domain-addon.test.ts` | Add-on on quote; once paid admin enables custom domain; absent payment feature stays locked | BR-28, BR-29 | Not Started | Planned (Unwritten) |
| SP-008 | White label and branding as a paid add-on | Must | Integration test — white-label gate | `tests/integration/sales/white-label-addon.test.ts` | Add-on on quote; unlocks removal of 'Powered by' and custom branding | BR-28, BR-29 | Not Started | Planned (Unwritten) |

### 5.5 Quoting

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| SP-009 | Quote builder | Must | Integration test — quote builder | `tests/integration/sales/quote-builder.test.ts` | Line items (plan, candidate pack, custom templates, white label, custom routing, AI credits), discounts, tax (GST), currency, validity date, one-time vs recurring | BR-30 | Not Started | Planned (Unwritten) |
| SP-010 | Send quote and track acceptance | Must | Integration test — quote lifecycle | `tests/integration/sales/quote-lifecycle.test.ts` | Quote emailed with secure link; status: Sent, Viewed, Accepted, Expired | — | Not Started | Planned (Unwritten) |

### 5.6 Payments

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| SP-011 | Email payment collection | Must | Integration test — payment link | `tests/integration/payments/email-payment-link.test.ts` | Admin emails payment link for quote/invoice; link opens hosted checkout; status updates automatically | BR-30 | Not Started | Planned (Unwritten) |
| SP-012 | In-app payment | Must | Integration test — in-app checkout | `tests/integration/payments/in-app-checkout.test.ts` | Company Admin sees quoted amounts in Billing; pays in-app (card, UPI, netbanking) | BR-30 | Not Started | Planned (Unwritten) |
| SP-013 | Recurring payments | Must | Integration test — subscription | `tests/integration/payments/recurring.test.ts` | Monthly or annual subscriptions with auto-renew; failed-payment retries (dunning); cancel and plan change | BR-30 | Not Started | Planned (Unwritten) |
| SP-014 | One-time payments | Must | Integration test — one-time charge | `tests/integration/payments/one-time.test.ts` | Setup fees and custom template builds billed as one-time charges | BR-30 | Not Started | Planned (Unwritten) |
| SP-015 | Custom payment code | Should | Integration test — payment code | `tests/integration/payments/custom-code.test.ts` | Admin generates code tied to custom quote/price or discount; company redeems in-app or via email link; single-use or limited-use; expiry | BR-30 | Not Started | Planned (Unwritten) |
| SP-016 | Automatic entitlement changes on payment | Must | Integration test — payment → entitlement webhook | `tests/integration/payments/entitlement-sync.test.ts` | Payment success unlocks plan limits and add-ons; failure after grace period downgrades or suspends; idempotent on gateway_ref | BR-05, BR-30 | Not Started | Planned (Unwritten) |
| SP-017 | Invoices, receipts and tax | Must | Integration test — invoice generation | `tests/integration/payments/invoice-gst.test.ts` | GST-compliant invoice PDF; receipts emailed; history in Billing | BR-30 | Not Started | Planned (Unwritten) |
| SP-018 | Payment gateway integration | Must | Integration test — Razorpay webhook | `tests/integration/payments/razorpay-webhook.test.ts` | MMP: Razorpay (cards, UPI, netbanking, subscriptions, GST invoices); webhook signature verification; no card data stored; payment abstraction layer | BR-30 | Not Started | Planned (Unwritten) |

---

## 6. NF — Non-Functional, Security and Compliance — 15 MMP Requirements

### 6.1 Security

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-001 | Strict tenant isolation | Must | Automated cross-tenant test (every endpoint) | `tests/security/tenancy/cross-tenant.test.ts` | Every query and file is org-scoped; automated tests prove no cross-org reads; templates and submissions never leak | BR-01 | Partial — Config | Planned (Unwritten) |
| NF-002 | Secrets and API keys in a vault | Must | Security test — key exposure | `tests/security/secrets/key-exposure.test.ts` | Encrypted at rest; never returned in full; never present in workspaces; short-lived session tokens only | BR-13, BR-16 | Partial — Config | Planned (Unwritten) |
| NF-003 | Encryption in transit and at rest | Must | Infrastructure test — TLS + encryption | `tests/security/infra/tls-encryption.test.ts` | TLS everywhere; encrypted storage and backups | — | Partial — Config | Planned (Unwritten) |
| NF-004 | Workspace sandboxing and egress control | Must | Spike test — isolation verification | `tests/security/workspace/isolation-spike.sh` | Workspaces isolated; outbound traffic restricted; AI domains blocked when AI is OFF; no real cloud credentials for candidates (mock/LocalStack) | BR-33 | Partial — Config | Planned (Unwritten) |
| NF-005 | AI proxy as the single path for AI calls | Must | Integration test — proxy enforcement | `tests/security/ai/proxy-only.test.ts` | All candidate AI calls logged, capped, policy-checked; candidates never see real provider keys | BR-13 | Not Started | Planned (Unwritten) |
| NF-006 | Rate limiting, abuse protection, secure session management | Must | Security test — rate limiting | `tests/security/api/rate-limit.test.ts` | Login and API throttling; CSRF/XSS protections; secure cookies | — | Not Started | Planned (Unwritten) |

> [!NOTE]
> NF-001/NF-002/NF-003/NF-004 are `Partial — Config` because:
> - NF-001: RLS policy DDL in `packages/db/src/migrations/0001_*.sql`; Terraform org_id tagging; `with-org.ts` middleware
> - NF-002: Terraform encrypted gp3 EBS volumes; AWS Secrets Manager referenced in Terraform; vault fetch stubs in adapters
> - NF-003: TLS enforced at ALB layer (Terraform); EBS encryption enabled
> - NF-004: Terraform IMDSv2 (hop_limit=1, HttpTokens=required); SCP data-services-deny; Security Group ports 20000-29999; Sysbox/cgroup runtime NOT implemented

### 6.2 Privacy and Compliance

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-007 | Consent, notice and retention | Must | Integration test — consent gate + retention job | `tests/integration/compliance/consent-retention.test.ts` | Consent captured before any recording; default 90-day retention, configurable per org; erasure on request (GDPR, India DPDP) | BR-12, BR-27 | Not Started | Planned (Unwritten) |
| NF-008 | Human-in-the-loop for AI scoring | Must | Integration test — review gate | `tests/integration/review/human-in-loop.test.ts` | AI scores are evidence for a human reviewer; overrides retained; decisions explainable by cited evidence | BR-20, BR-32 | Not Started | Planned (Unwritten) |

### 6.3 Reliability

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-011 | Workspace launch time | Should | Performance test — launch timing | `tests/performance/workspace/launch-p95.test.ts` | p95 launch < 60 seconds from Connect (warm pool or snapshot clone) | BR-11 | Not Started | Planned (Unwritten) |
| NF-012 | Availability | Should | Infrastructure monitoring + SLO test | `tests/performance/infra/availability-slo.test.ts` | 99.5% monthly for candidate and company portals at MMP | — | Not Started | Planned (Unwritten) |
| NF-013 | No work loss | Must | Integration test + chaos test | `tests/integration/workspace/work-loss-prevention.test.ts` | Autosave RPO <= 30 s; resume restores state after browser crash or disconnect | BR-11 | Not Started | Planned (Unwritten) |

### 6.4 Cost Control

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-014 | Automatic VM cleanup and spend limits | Must | Integration test — cleanup job | `tests/integration/workspace/cleanup-job.test.ts` | Idle, expired and orphaned VMs destroyed automatically; hard per-session and per-org spend limits | BR-22, BR-23 | Partial — Config | Planned (Unwritten) |

> [!NOTE]
> NF-014 is `Partial — Config`: Terraform `aws_budgets_budget` with \$3000/month alert exists in `infra/terraform/modules/workspace-hosts/main.tf`. Cleanup job logic is not implemented.

### 6.5 Observability

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-015 | Logging, metrics and alerts | Must | Infrastructure test — log pipeline | `tests/integration/observability/log-pipeline.test.ts` | Central logs, error tracking, workspace and agent dashboards, on-call alerts | — | Not Started | Planned (Unwritten) |

### 6.6 Email

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-017 | Deliverability | Must | DNS verification test + bounce test | `tests/integration/email/deliverability.test.ts` | SPF, DKIM, DMARC configured; bounce handling; branded sender on white label | BR-34 [Pending Confirmation] | Not Started | Planned (Unwritten) |

### 6.7 Extensibility

| ID | Title | Priority | Verification Method | Target Test Asset | Acceptance Criteria Summary | Business Rule | Status |
|---|---|---|---|---|---|---|---|
| NF-018 | Template manifest as a versioned schema | Must | Schema validation test | `tests/integration/templates/manifest-schema.test.ts` | New roles can be added by authoring a manifest and rubric without platform code changes; manifest validated against JSON schema | — | Partial — Config | Planned (Unwritten) |

> [!NOTE]
> NF-018 is `Partial — Config`: `packages/adapters/src/manifest.schema.json` and `packages/adapters/src/index.ts` define the manifest schema and TypeScript types. Runtime manifest validation is not wired in.

---

## 7. Business Rule to Requirement Cross-Reference

*Derived from AGENTS.md §8 and §16. Not all requirement↔BR links are explicit in the source — inferred links are marked (inferred).*

| BR | Rule Summary | Governed Requirements |
|---|---|---|
| BR-01 | Tenant isolation — every query, cache key, file, job scoped by org_id; cross-org reads return 404 | CO-011, CO-014, CO-015, CO-016, CO-018, CO-041, CO-043, CO-051, CO-052, CA-004, AD-018, AD-025, NF-001 |
| BR-02 | Template privacy — visible only to orgs in TemplateAssignment | CO-018, CO-019, AD-011, AD-012, SP-006 |
| BR-03 | Version pinning — assessment pins TemplateVersion; published versions immutable | CO-020, CO-021, AD-010, AD-012, AD-013 |
| BR-04 | Org creation — only Platform Admin; SSO never creates org or user | CO-002, CO-003, CO-005, AD-002, SP-005 |
| BR-05 | Entitlements — X templates, Y candidates, Z days; feature flags enforced server-side | CO-008, CO-009, CO-010, CO-026, AD-006, AD-007, SP-016 |
| BR-06 | Candidate cap — counted once at first workspace launch; pending invites at 2x cap | CO-009, CO-011, CO-026 |
| BR-07 | Trial expiry — block new actions at cap/expiry; existing data stays readable | CO-009, CO-010 |
| BR-08 | Timing server-enforced — duration, window, both; auto-submit at expiry | CO-028, CO-029, CO-030, CO-031, CA-012, CA-013 |
| BR-09 | Timer on disconnect — keeps running while disconnected; default false for pause | CA-009, CA-011 |
| BR-10 | Full screen (Cloud) — requesting full screen on connect; exit disconnects | CA-008, CA-009 |
| BR-11 | No work loss — RPO <= 30s; resume restores state | CA-010, CA-011, NF-011, NF-013 |
| BR-12 | Consent — required before connect; store version/timestamp/IP/UA; covers recording + timer | CA-007, NF-007 |
| BR-13 | AI proxy only — workspace holds only short-lived session token; no real keys | CO-023, CO-032, CO-034, CA-017, AD-023, NF-002, NF-005 |
| BR-14 | AI OFF — remove assistant; block AI domain egress in cloud workspaces | CO-033, CA-017 |
| BR-15 | Caps — per-candidate and per-assessment; warn then block; candidate sees budget | CO-035, CO-037, CA-017 |
| BR-16 | Key handling — encrypted at rest, last4 only, never returned in full, never logged | CO-032, AD-023, NF-002 |
| BR-17 | Key source MMP — company's own key (including trial); platform admin may allocate platform key | CO-032, AD-023, CA-015 |
| BR-18 | Grader input sanitization — all candidate input treated as untrusted | CO-038, CO-039, CO-042, AD-017 |
| BR-19* | Rubric weights sum to 100% [Pending Confirmation] | CO-038, CO-039 |
| BR-20 | Human-in-the-loop — AI scores are evidence; no auto-reject; overrides logged; every post-finalize edit adds a version | CO-045, CO-046, CO-047, CO-048, NF-008 |
| BR-21 | Agent independence — one agent per rubric item; aggregator flags disagreement | AD-014, AD-015 |
| BR-22 | Destroy — snapshot state first; notify candidate; audit log entry | CO-044, AD-019 |
| BR-23 | Cost control — idle/expired/orphaned workspaces destroyed automatically; hard spend limits | AD-019, NF-014 |
| BR-24 | Candidate onboarding — company creates; account-created email with single-use expiring link; first login forces reset; can resend | CO-013, CO-017, CA-001 |
| BR-25 | Route isolation — candidate cannot reach company or admin routes | CO-004, CA-002, AD-001, AD-003 |
| BR-26 | Deletion — soft delete with confirmation; audit entry | CO-016, AD-028 |
| BR-27 | Retention — default 90 days after assessment closes; configurable; automatic deletion jobs; every deletion logged | AD-028, NF-007 |
| BR-28 | Branding — logo + 'Powered by' default; own domain and white label as gated paid add-ons | CO-054, CO-055, AD-021, AD-022, SP-007, SP-008 |
| BR-29 | Feature flags per org for gated features | AD-007, AD-021, AD-022, SP-007, SP-008, CO-055 |
| BR-30 | No card data stored; Razorpay in MMP; payment abstraction for future gateways | CO-056, SP-009, SP-011, SP-012, SP-013, SP-014, SP-015, SP-016, SP-017, SP-018 |
| BR-31 | Audit log — append-only entries for specific actions | CO-006, CO-016, CO-017, CO-031, CO-044, CO-045, CO-047, AD-004, AD-026, AD-027 |
| BR-32 | Human oversight — AI scores are evidence for a human | CO-045, NF-008 |
| BR-33 | No real cloud credentials for candidates — mock/LocalStack | CA-019, NF-004 |
| BR-34 [Pending Confirmation] | Email deliverability — SPF, DKIM, DMARC | AD-029, NF-017 |

---

## 8. Unresolved Assumptions and Gaps

> [!WARNING]
> The following items have inferred BR mappings or open design questions. Flag these in PR review.

| # | Item | Nature | Action Required |
|---|---|---|---|
| 1 | BR-19 (rubric weights sum to 100%) — not explicitly a standalone BR in AGENTS.md §8; derived from data model description in §6.2 | Inferred mapping | **Pending Team-Lead Confirmation**: Validate whether rubric normalization is a formal BR invariant or application logic |
| 2 | BR-34 (email deliverability) — introduced in context of AD-029 and NF-017 but not numbered in AGENTS.md §8 as a BR; this matrix maps it as BR-34 per the range BR-01..BR-34 | Inferred numbering | **Pending Team-Lead Confirmation**: Validate canonical designation of BR-34 vs retaining as non-functional requirement NF-017 |
| 3 | CO-022 (workspace mode selection) has no explicit BR linkage in §8 | Gap | Add BR annotation to requirement or note as intentional |
| 4 | CA-003, CA-005, CA-006, CA-013, CA-018, CA-020 have no explicit BR linkage | Gap | Review whether these need a BR reference or are governed implicitly by role/auth rules |
| 5 | SP-001, SP-002, SP-004, SP-010 — no BR linkage; these are pure product/sales features | Gap | Confirm intentional; document that these are unguarded by a BR invariant |
| 6 | Test asset paths proposed in this matrix do not yet exist in `d:\hellosmart\tests\` | Proposed paths | Author test files in Sprint 1+ using these paths as targets |
| 7 | All 15 `Partial — Config` status items have IaC/schema evidence but no running code | Status caveat | Verify each partial item individually as runtime code is written |

---

## 9. Validation

**Requirement count check:**
- CO domain: CO-001..CO-058 minus {CO-007, CO-027, CO-036, CO-040, CO-049, CO-050, CO-057, CO-058} = 50 ✓
- CA domain: CA-001..CA-023 minus {CA-014, CA-016, CA-021, CA-022, CA-023} = 18 ✓
- AD domain: AD-001..AD-029 minus {AD-005, AD-016, AD-020, AD-024} = 25 ✓
- SP domain: SP-001..SP-022 minus {SP-019, SP-020, SP-021, SP-022} = 18 ✓
- NF domain: NF-001..NF-018 minus {NF-009, NF-010, NF-016} = 15 ✓
- **Grand total: 50 + 18 + 25 + 18 + 15 = 126 ✓**

No requirement appears more than once. No MMP requirement is missing.

---

*End of S0-RTM-001. Next review gate: Sprint 0 closing review with team lead.*
