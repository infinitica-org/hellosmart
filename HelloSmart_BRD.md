# HelloSmart.ai | Business Requirements Document (BRD)

| | |
|---|---|
| **Product** | HelloSmart.ai: AI-native hiring platform |
| **Document** | Business Requirements Document, single source of truth for what the product is and must do |
| **Version** | 0.2 (all open questions resolved) |
| **Scope** | Minimum Marketable Product (MMP), with Phase 2 and Phase 3 items identified |
| **Date** | 22 October 2026 |
| **Source** | `HelloSmart_Business_Requirements.xlsx`; this document is a direct reading of that workbook |
| **Total requirements** | 150 |

> **How to read this document.** Each requirement has an ID (`CO-`, `CA-`, `AD-`, `SP-`, `NF-`), a **priority** (Must, Should, Could) and a **phase** (MMP, Phase 2, Phase 3). *Must* means needed to sell the MMP; *Should* means important and following quickly; *Could* means nice to have. Where this document and the workbook differ, update the workbook first.

## Contents

- [1. Executive summary](#1-executive-summary)
- [2. Product overview](#2-product-overview)
- [3. Release scope](#3-release-scope)
- [4. Users and stakeholders](#4-users-and-stakeholders)
- [5. End-to-end user flow](#5-end-to-end-user-flow)
- [6. Lifecycle and status models](#6-lifecycle-and-status-models)
- [7. Business requirements: Company](#7-business-requirements-company)
- [8. Business requirements: Candidate](#8-business-requirements-candidate)
- [9. Business requirements: Platform Admin](#9-business-requirements-platform-admin)
- [10. Business requirements: Sales, provisioning and payments](#10-business-requirements-sales-provisioning-and-payments)
- [11. Non-functional requirements](#11-non-functional-requirements)
- [12. Exception and edge flows](#12-exception-and-edge-flows)
- [13. Decisions and resolved questions](#13-decisions-and-resolved-questions)
- [14. Assumptions and items to confirm](#14-assumptions-and-items-to-confirm)
- [15. Requirements summary and traceability](#15-requirements-summary-and-traceability)

---

## 1. Executive summary

HelloSmart.ai is an AI-native hiring platform. Companies assess candidates by having them do real work, with AI tools, inside a controlled workspace. Independent AI reviewer agents monitor the work and score it against the company's own rubric.

**Pitch:** Hire by doing: watch candidates do the real job, with AI, and get an evidence-backed score for every rubric dimension.

**Category:** AI-native work simulation for hiring (also described as: proof-of-work hiring, job simulation, work-sample assessment).

**Vision:** Make demonstrated work, not claims, the standard for hiring in the AI era, for every role in every company.

**Mission:** Give every hiring team a fair, realistic and evidence-backed way to see how a candidate really works with AI, and give every candidate a chance to prove it.

**MMP goal:** Be sellable to the first design-partner customers: one end-to-end loop of template, assessment, candidate session, agent review and company result, plus quoting and payment collection.

---

## 2. Product overview

### 2.1 Problem

Resume screens and puzzle-style tests no longer predict performance, because AI is now part of the job. Hiring managers cannot see how a candidate directs AI, verifies output and recovers from mistakes. Existing assessment tools are engineering-centric, generic, or self-serve and shallow for niche roles.

### 2.2 Solution

A role-agnostic platform with (1) private, company-specific task templates, (2) provisioned workspaces (Cloud VM, Local, Chat, Browser), (3) an AI proxy that controls provider keys, ON/OFF and caps, and (4) reviewer agents that monitor and review the work and produce cited evidence for human decision-makers.

### 2.3 How it works

- 1) Prospect books a meeting via cal.com.
- 2) HelloSmart quotes, collects payment and provisions the company on the platform.
- 3) Company configures a task from its private templates (timing, AI policy, rubrics) and adds candidates.
- 4) Candidates connect to a provisioned workspace and do the work.
- 5) Reviewer agents score; the hiring team adds scores and notes and decides.

### 2.4 Target customers

Companies hiring for technical and non-technical niche roles: startups, mid-size firms, staffing agencies and enterprises that want a bespoke, defensible assessment.

### 2.5 Differentiators

- Role-agnostic via a template and rubric authoring engine
- Templates are private to each company
- Real work with AI tools, not trivia
- Rubrics run as independent monitoring agents
- Optional local mode, white labelling and custom routing
- Human-in-the-loop with an audit trail

### 2.6 Business model and go-to-market

Sales-assisted and behind the curtain: landing page, cal.com booking, discovery call, quote, payment, provisioning on the standard HelloSmart route. Own-domain routing, white label and custom templates are paid add-ons. Self-serve signup is not in MMP; revisit after the first 10-15 paying customers.

### 2.7 MMP success metrics

- Time from signed quote to provisioned org < 1 business day
- Candidate workspace launch success rate >= 95%
- Assessment completion rate >= 70%
- Reviewer-agent report ready < 15 min after submit
- First paid pilots closed
- Zero cross-tenant data exposure

---

## 3. Release scope

Requirements are tagged by release phase. **The MMP is what is built and sold first**; Phase 2 and Phase 3 items are identified so the MMP is designed to accommodate them.

| Area | Total | MMP | Phase 2 | Phase 3 |
|---|---|---|---|---|
| Company | 58 | 50 | 7 | 1 |
| Candidate | 23 | 18 | 5 | 0 |
| Platform Admin | 29 | 25 | 4 | 0 |
| Sales, Provisioning and Payments | 22 | 18 | 3 | 1 |
| Non-Functional | 18 | 15 | 1 | 2 |
| **Total** | **150** | **126** | **20** | **4** |

### Deferred to Phase 2

- **CO-007** Company team members and roles (Should)
- **CO-027** Clone, close and archive assessments (Should)
- **CO-036** Use HelloSmart AI credits instead of own key (Should)
- **CO-040** Choose agent mode (Should)
- **CO-049** Compare candidates and shortlist (Should)
- **CO-050** Export report (Should)
- **CO-057** Organization audit log (Should)
- **CA-014** Runnable locally (Should)
- **CA-016** Browser workspace (Should)
- **CA-021** Profile and data rights (Should)
- **CA-022** Accessible UI and accommodation requests (Should)
- **CA-023** Integrity events logged (Should)
- **AD-005** Impersonate/support-view a company (read-only) (Should)
- **AD-016** Re-run or force a review (Should)
- **AD-020** Capacity and warm pool management (Should)
- **AD-024** Manage HelloSmart-managed AI credits (Should)
- **SP-019** Stripe gateway for international customers (Should)
- **SP-020** Refunds and credit notes (Should)
- **SP-021** Revenue and payment reporting for admin (Should)
- **NF-016** Accessibility and browser support (Should)

### Deferred to Phase 3

- **CO-058** ATS integration and API/webhooks (Could)
- **SP-022** Dedicated instance / VPC deployment (Could)
- **NF-009** Fairness monitoring (Should)
- **NF-010** SOC 2 / ISO 27001 readiness (Should)

---

## 4. Users and stakeholders

| Persona | Description | Primary goals | How they get access | Created by |
|---|---|---|---|---|
| Prospect / Visitor | Sales lead on the public landing page | Understand the product, book a meeting | Public landing page, cal.com booking | n/a |
| Company Admin | Customer-side owner who configures the org, tasks, rubrics and candidates | Launch assessments, review results, control spend and branding | Email + password, Google SSO or Microsoft SSO | Platform Admin |
| Company Reviewer (Hiring Manager) | Customer-side user who reviews submissions and scores (Phase 2 sub-role) | Review evidence, add scores and notes | Same login as Company Admin, role-restricted | Company Admin |
| Candidate | Person being assessed | Connect to workspace, do the task, submit, optionally see results | Emailed link then forced password reset; or same master login (RBAC routes to candidate portal) | Company Admin (single or bulk upload) |
| Platform Admin (HelloSmart) | Internal super admin / operations | Provision orgs, manage pricing, templates, agents, workspaces and payments | Master login with MFA | Seeded / other Platform Admin |
| Internal Sales / Support (Phase 2) | Restricted internal roles | Track deals, send quotes, support customers | Master login, role-restricted | Platform Admin |
| Reviewer Agents (system actor) | Independent AI agents that monitor and review the work | Produce rubric scores with cited evidence | System-run, no login | Platform Admin (library) / Company (rubric config) |

---

## 5. End-to-end user flow

The flow runs from first visit on the landing page to data deletion. Each step shows who acts, what the system does, the status afterwards and the requirements that cover it.


### A. Acquire

1. **Prospect / Company contact:** Lands on hellosmart.ai, reads the category pitch ('Hire by doing') and clicks Book a meeting.  
   **System / Reviewer agents:** Captures UTM / source.
   - *Status after step:* Visitor  
   - *Requirements:* SP-001
2. **Prospect / Company contact:** Picks a slot on the embedded cal.com page.  
   **Platform Admin (HelloSmart):** Sees the new lead in the admin pipeline.  
   **System / Reviewer agents:** cal.com sends confirmation; webhook creates the lead.
   - *Status after step:* Lead: meeting booked  
   - *Requirements:* SP-002, SP-003, SP-004
3. **Prospect / Company contact:** Joins the discovery call.  
   **Platform Admin (HelloSmart):** Runs the call: target roles, task needs, AI policy, add-ons wanted (own routing, white label, custom templates) and trial limits X / Y / Z.
   - *Status after step:* Meeting held  
   - *Requirements:* SP-004

### B. Provision

4. **Platform Admin (HelloSmart):** Creates the org on the standard HelloSmart route, sets trial entitlements (X templates, Y candidates, Z days) and feature flags.  
   **System / Reviewer agents:** Org and trial created; usage counters start.
   - *Status after step:* Org provisioned; trial active  
   - *Requirements:* SP-005, AD-006, AD-007
5. **Platform Admin (HelloSmart):** Builds or clones templates for this company only and assigns them; smoke test must pass before publish.  
   **System / Reviewer agents:** Templates are visible to this org only; resources and golden image built.
   - *Status after step:* Templates assigned (private)  
   - *Requirements:* AD-010, AD-011, AD-013, SP-006
6. **Prospect / Company contact:** Receives the invite email.  
   **Platform Admin (HelloSmart):** Creates the Company Admin account.  
   **System / Reviewer agents:** Sends invite from the HelloSmart domain.
   - *Status after step:* Company Admin invited  
   - *Requirements:* AD-002, CO-005

### C. Onboard

7. **Company Admin:** Signs in with email + password, Google or Microsoft SSO on the master login; lands on the company dashboard.  
   **System / Reviewer agents:** RBAC redirect by role; trial banner shows usage and days left.
   - *Status after step:* Logged in  
   - *Requirements:* CO-001, CO-002, CO-003, CO-004, CO-008
8. **Company Admin:** Sets organization name and uploads logo. 'Powered by hellosmart.ai' shows by default in a corner.  
   **System / Reviewer agents:** Branding applied to candidate portal, emails and reports.
   - *Status after step:* Org profile ready  
   - *Requirements:* CO-006, CO-054, CO-055
9. **Platform Admin (HelloSmart):** Optional: manually allocates a platform key with a cap (interim add-on).  
   **Company Admin:** Adds AI provider API key(s) in Settings, sets default and optional org cap.  
   **System / Reviewer agents:** Key encrypted in the vault, masked, connection tested.
   - *Status after step:* AI provider connected  
   - *Requirements:* CO-032, AD-023

### D. Configure assessment

10. **Company Admin:** Opens Tasks, browses the company's private templates and previews one.  
   **System / Reviewer agents:** Only this org's templates are listed.
   - *Status after step:* Template chosen  
   - *Requirements:* CO-018, CO-019
11. **Company Admin:** Creates an assessment: task name, brief edits, workspace mode (Cloud or Chat in MMP; Local and Browser locked).  
   **System / Reviewer agents:** Pins the template version.
   - *Status after step:* Assessment: Draft  
   - *Requirements:* CO-020, CO-022
12. **Company Admin:** Sets AI ON/OFF, provider and key, allowed models, per-candidate and per-assessment caps.  
   **System / Reviewer agents:** Policy stored; the AI proxy enforces it at runtime.
   - *Status after step:* AI policy set  
   - *Requirements:* CO-033, CO-035
13. **Company Admin:** Fills environment variables and secret slots.  
   **System / Reviewer agents:** Values encrypted; injected only into the session.
   - *Status after step:* Environment ready  
   - *Requirements:* CO-023
14. **Company Admin:** Chooses timing: time-bound, window-bound, or both, with timezone.  
   **System / Reviewer agents:** Rules enforced server-side.
   - *Status after step:* Timing set  
   - *Requirements:* CO-028, CO-029, CO-030
15. **Company Admin:** Defines the rubric as reviewer agents: items, level anchors, weights totalling 100%, red flags.  
   **System / Reviewer agents:** Agent configuration versioned per assessment.
   - *Status after step:* Rubric set  
   - *Requirements:* CO-038
16. **Company Admin:** Runs a dry run as a test candidate and fixes any issue.  
   **System / Reviewer agents:** Provisions a test workspace and records the dry-run result.
   - *Status after step:* Dry-run passed  
   - *Requirements:* CO-024

### E. Add candidates

17. **Company Admin:** Adds candidates: single add or bulk CSV/XLSX (name + email); reviews the row error report.  
   **System / Reviewer agents:** Validates, de-duplicates and applies cap rules (counts at first launch; pending invites up to 2x cap).
   - *Status after step:* Candidates created  
   - *Requirements:* CO-011, CO-012, CO-009
18. **Candidate:** Receives the account-created email with a secure link.  
   **System / Reviewer agents:** Sends the email automatically; link expires and can be resent.
   - *Status after step:* Candidate invited  
   - *Requirements:* CO-013
19. **Company Admin:** Publishes the assessment and assigns candidates.  
   **Candidate:** Sees the assignment.  
   **System / Reviewer agents:** Creates assignments; per-candidate status becomes Invited, Window not open or Ready.
   - *Status after step:* Assessment: Published  
   - *Requirements:* CO-025, CO-026

### F. Candidate session

20. **Candidate:** Opens the link and sets a new password (forced reset), or signs in on the master login; RBAC routes to the candidate portal.  
   **System / Reviewer agents:** Candidate cannot reach company or admin routes.
   - *Status after step:* Candidate logged in  
   - *Requirements:* CA-001, CA-002
21. **Candidate:** Sees the dashboard of assigned workspaces with status (Connected or Not connected) and opens one.
   - *Status after step:* Ready  
   - *Requirements:* CA-004, CA-006
22. **Candidate:** Reads the brief, rules, timing and AI policy, and accepts the mode-based consent.  
   **System / Reviewer agents:** Stores consent version, timestamp and IP; enables Connect.
   - *Status after step:* Consent given  
   - *Requirements:* CA-007
23. **Candidate:** Clicks Connect inside the allowed time. Cloud mode goes full screen.  
   **System / Reviewer agents:** Checks window and time server-side; takes a VM from the warm pool or clones the snapshot; pulls the pinned repo and seed data; injects secrets; starts services, AI proxy and recorder; starts the timer.
   - *Status after step:* Connected; in progress  
   - *Requirements:* CA-008, CA-012, NF-011
24. **Candidate:** Works on the task, uses the AI assistant if enabled, sees remaining budget and countdown.  
   **System / Reviewer agents:** AI proxy checks policy and caps and logs prompts; recorder captures activity; autosave runs continuously (target <= 30 s).
   - *Status after step:* In progress  
   - *Requirements:* CA-017, CA-013, CA-010, NF-005
25. **Candidate:** If full screen is exited or the connection drops, resumes from the overlay; timer keeps running.  
   **System / Reviewer agents:** Disconnects the workspace, logs the event, restores saved state on resume.
   - *Status after step:* Disconnected (resumable) then In progress  
   - *Requirements:* CA-009, CA-011
26. **Candidate:** Submits, or time or window expiry auto-submits.  
   **System / Reviewer agents:** Saves the final snapshot, destroys the workspace, queues the submission for review.
   - *Status after step:* Submitted  
   - *Requirements:* CA-018

### G. Review and results

27. **System / Reviewer agents:** Reviewer agents run independently on artifacts, transcript and activity; each score cites evidence; an aggregator flags disagreement; injection checks run.
   - *Status after step:* Agent report ready  
   - *Requirements:* AD-017, CO-042
28. **Platform Admin (HelloSmart):** Monitors agent health (latency, failures, cost, agreement) and can re-run an agent.  
   **System / Reviewer agents:** Raises alerts on thresholds.
   - *Status after step:* Agents healthy  
   - *Requirements:* AD-015, AD-016
29. **Company Admin:** Is notified, opens Submissions and progress, and reads the detail (artifacts, timeline, AI transcript, agent reports).
   - *Status after step:* Human review  
   - *Requirements:* CO-041, CO-042
30. **Company Admin:** Enters or overrides scores per dimension and overall, adds custom notes and finalizes; later edits create versions.  
   **System / Reviewer agents:** Keeps original agent scores and every edit version with an audit log.
   - *Status after step:* Finalized  
   - *Requirements:* CO-045, CO-046, CO-047
31. **Company Admin:** Optionally releases results (default OFF).  
   **Candidate:** Sees overall and per-dimension scores and shared notes.  
   **System / Reviewer agents:** Result visibility follows the release toggle.
   - *Status after step:* Released  
   - *Requirements:* CO-048, CA-020

### H. Monitor and analytics

32. **Company Admin:** Watches active workspaces; destroys one at any time; extends time or revokes access.  
   **Candidate:** Is notified if a workspace is destroyed or time is extended.  
   **System / Reviewer agents:** Snapshots state before destroy; audit-logged.
   - *Status after step:* Workspace destroyed / extended  
   - *Requirements:* CO-043, CO-044, CO-031
33. **Company Admin:** Views analytics per assessment and org-wide (completion, drop-off, score distribution, AI cost).
   - *Status after step:* Insights  
   - *Requirements:* CO-051, CO-052
34. **Platform Admin (HelloSmart):** Oversees all workspaces, spend and orphans across orgs; force-destroys; manages capacity.  
   **System / Reviewer agents:** Auto-destroys idle, expired and orphaned VMs.
   - *Status after step:* Costs controlled  
   - *Requirements:* AD-018, AD-019, NF-014

### I. Commercial

35. **Prospect / Company contact:** Opens the quote.  
   **Platform Admin (HelloSmart):** Builds the quote: plan, candidate pack, custom templates, add-ons (own routing, white label), discounts, GST, recurring or one-time; emails it or issues a custom payment code.  
   **System / Reviewer agents:** Tracks quote status Sent, Viewed, Accepted.
   - *Status after step:* Quoted  
   - *Requirements:* SP-009, SP-010, SP-015
36. **Prospect / Company contact:** Pays through the emailed link or in-app Billing (Razorpay: card, UPI, netbanking); sets up recurring if quoted.  
   **Company Admin:** Sees quotes and invoices in Billing.  
   **System / Reviewer agents:** Webhook confirms payment; GST invoice and receipt are issued.
   - *Status after step:* Paid  
   - *Requirements:* SP-011, SP-012, SP-013, SP-017, SP-018, CO-056
37. **Platform Admin (HelloSmart):** Enables own domain and/or white label if purchased (DNS verification, SSL).  
   **System / Reviewer agents:** Entitlements upgrade automatically: trial becomes paid plan; add-ons unlock.
   - *Status after step:* Paid plan active; add-ons live  
   - *Requirements:* SP-016, CO-010, AD-021, AD-022, SP-007, SP-008
38. **System / Reviewer agents:** Renewals run; failed payments retry (dunning), then grace, then downgrade or suspend.
   - *Status after step:* Active / Past due / Suspended  
   - *Requirements:* SP-013, SP-016

### J. Close-out

39. **Platform Admin (HelloSmart):** Sets or overrides retention; handles support and erasure tools.  
   **Candidate:** May request correction or deletion of own data.  
   **System / Reviewer agents:** Deletes recordings, transcripts and artifacts after the retention period (default 90 days); logs everything.
   - *Status after step:* Data deleted per policy  
   - *Requirements:* AD-028, NF-007, CA-021, CO-016

---

## 6. Lifecycle and status models

| Object | Statuses (in order) | Notes |
|---|---|---|
| Org / trial | Provisioned > Trial active > Trial expired / Paid active > Suspended | Entitlements (X templates, Y candidates, Z days) set by Platform Admin. |
| Assessment | Draft > Dry-run passed > Published > Closed > Archived | Publish blocked until dry run passes. |
| Candidate assignment | Invited > Window not open > Ready > Connected > In progress > Disconnected (resumable) > Submitted / Expired / Revoked | Disconnected is reached when the candidate exits full screen. |
| Workspace | Queued > Provisioning > Not connected > Connected > Disconnected > Ended > Destroyed | Destroy can be triggered by company, admin, expiry or cleanup job. |
| Review | Pending > Agents running > Agent report ready > Human review > Finalized > Released to candidate | Release is optional and off by default. |
| Quote / payment | Draft > Sent > Viewed > Accepted > Paid / Expired / Failed > Refunded | Recurring subscriptions add Active, Past due, Cancelled. |
| Deal | Lead > Meeting booked > Meeting held > Quoted > Paid > Provisioned | Tracked in Platform Admin. |

---

## 7. Business requirements: Company

Requirements for company users (Company Admin in the MMP; Reviewer role in Phase 2). Companies are provisioned by HelloSmart after the sales call and configure everything behind their own login.

### 7.1 Authentication

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-001** | Sign in with email and password | Passwords hashed (argon2/bcrypt); forgot-password via emailed expiring link; lockout or throttling after repeated failures; session expiry configurable. | Must | MMP |  |
| **CO-002** | Sign in with Google SSO | Company user can authenticate with Google; account is matched on verified email; no new org is created by SSO. | Must | MMP | SSO only works for users already created by Platform Admin / Company Admin. |
| **CO-003** | Sign in with Microsoft SSO | Company user can authenticate with Microsoft (Entra ID / personal); matched on verified email. | Must | MMP |  |
| **CO-004** | Master login with role-based routing | After login the user lands in the correct portal (company dashboard) based on role; candidates and admins use the same login page. One login URL for all roles; white-label customers get a branded login route on their custom domain (add-on). | Must | MMP | Decision accepted (Open Q11). |

### 7.2 Account

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-005** | Company account is provisioned by HelloSmart after sales call | Org, first Company Admin and trial are created by Platform Admin; Company Admin receives invite email and sets a password or uses SSO. | Must | MMP | Decision accepted (Open Q12): no public self-signup in MMP; revisit after 10-15 paying customers. |
| **CO-006** | Manage organization name and profile | Company Admin can edit org name; change is reflected on candidate portal, emails and reports; change is audit-logged. | Must | MMP |  |
| **CO-007** | Company team members and roles | Company Admin can invite Reviewer / Admin users; Reviewers cannot change settings, keys or billing. | Should | Phase 2 | Decision accepted (Open Q6): MMP has Company Admin users only; Reviewer role arrives in Phase 2. |

### 7.3 Trial

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-008** | Trial period with X templates, Y candidate cap, Z days | Entitlements are set by Platform Admin per org; enforced server-side; banner shows usage and days left (e.g. 2 of 3 templates, 4 of 10 candidates, 9 days left). | Must | MMP | Suggested defaults: 3 templates, 10 candidates, 14 days. |
| **CO-009** | Trial limits enforced with clear messaging | At cap or expiry, new assessments, candidates or workspace launches are blocked with a message and 'Contact us / Pay' CTA; existing data stays readable. A candidate counts once against the cap at first workspace launch; pending (not yet launched) invites are capped at 2x the cap, configurable by Platform Admin. | Must | MMP | Decision accepted (Open Q1). The 2x pending-invite multiplier is an assumption. |
| **CO-010** | Trial upgrade to paid plan | On payment success, entitlements switch to the purchased plan with no data loss. | Must | MMP | Links to Sales_Payments module. |

### 7.4 Candidates

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-011** | Add a single candidate (Create) | Name and email required; email format and uniqueness within the org validated; counts against candidate cap rules. | Must | MMP |  |
| **CO-012** | Bulk upload candidates | CSV/XLSX with name and email; downloadable template; per-row validation; duplicates skipped and reported; downloadable error report; row limit stated (e.g. 500). | Must | MMP |  |
| **CO-013** | Automatic account-created email with link | On creation, candidate receives email with secure link; first login forces password reset; link expires and can be resent. | Must | MMP | Email must come from HelloSmart domain; branded sender is a white-label add-on. |
| **CO-014** | View, search and filter candidates (Read) | List with name, email, assigned assessments, status; search by name/email; filter by assessment and status; pagination. | Must | MMP |  |
| **CO-015** | Edit candidate (Update) | Name editable; email editable until activation, after which change triggers re-verification. | Must | MMP |  |
| **CO-016** | Delete candidate (Delete) | Soft delete with confirmation; active workspaces destroyed; submissions retained or erased according to the retention setting; audit-logged. | Must | MMP | Supports erasure requests under GDPR / DPDP. |
| **CO-017** | Resend invite / reset candidate access | One-click resend of invite; reset password link; action audit-logged. | Should | MMP |  |

### 7.5 Tasks and templates

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-018** | Browse templates available to my company only | Template catalog shows only templates provisioned for this org; no public or cross-company templates. | Must | MMP | Templates are built behind the curtain by HelloSmart. |
| **CO-019** | Preview a template | Shows scenario, deliverables, tech stack tags, workspace mode, estimated duration, default AI policy and default reviewer agents. | Must | MMP |  |
| **CO-020** | Create an assessment from a template with a task name | Company names the assessment; it pins the template version; edits never alter the master template. | Must | MMP | Three levels: Template > Assessment > Session. |
| **CO-021** | Edit candidate-facing brief and deliverables | Company can adjust title, description, instructions and deliverables within the template's editable fields. | Should | MMP |  |
| **CO-022** | Choose workspace mode | MMP options: Cloud VM and Chat. Local and Browser are shown as locked 'coming soon' options and unlock in Phase 2 subject to the org's entitlements; selection drives consent and provisioning. | Must | MMP | Decision accepted (Open Q10). |
| **CO-023** | Configure environment variables and secrets | Required slots declared by the template; company fills values; values encrypted, masked in UI and injected only into the session. | Must | MMP |  |
| **CO-024** | Dry-run preview as candidate before publishing | Company launches a test session of the assessment; publish is blocked until a dry-run has passed. | Should | MMP | Prevents broken tasks from reaching candidates. |
| **CO-025** | Publish and deploy to candidates | Company selects candidates; publishing provisions access and sends assignment email; lifecycle Draft > Published > Closed > Archived. | Must | MMP |  |
| **CO-026** | Assign candidates to an assessment in bulk | Multi-select or filter by list; assignments respect caps; each candidate sees only their assigned tasks. | Must | MMP |  |
| **CO-027** | Clone, close and archive assessments | Clone copies configuration; closing stops new starts; archive hides from the default list. | Should | Phase 2 |  |

### 7.6 Timing

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-028** | Time-bound assessment | Duration in minutes/hours starts at the candidate's first connect; countdown visible; auto-submit at expiry. | Must | MMP |  |
| **CO-029** | Window-bound assessment | Company sets start and end date-time with timezone; workspace is not accessible outside the window. | Must | MMP |  |
| **CO-030** | Combined window plus duration | e.g. start any time within 7 days, then 4 hours; both rules enforced server-side. | Must | MMP |  |
| **CO-031** | Extend time or window for a candidate; revoke access | Company can grant an extension or revoke; both are audit-logged and shown to the candidate. | Should | MMP |  |

### 7.7 AI providers

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-032** | Add AI provider API keys in settings | Providers such as Anthropic and OpenAI; keys stored encrypted in a vault, shown masked (last 4); test-connection; rotate and delete; set a default key. | Must | MMP | Decision accepted (Open Q7): own key in MMP, including trial. Keys are never exposed to candidates or workspaces. |

### 7.8 AI controls

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-033** | AI assistant ON/OFF per assessment | Toggle at assessment level; when OFF the assistant is removed and AI domains are blocked in cloud workspaces. | Must | MMP | AI-off cannot be fully enforced in local mode; label this in consent and report. |
| **CO-034** | Select provider/key and allowed models per assessment | Company picks key source (own key) and a model allowlist; all AI calls pass through the HelloSmart AI proxy. | Must | MMP |  |
| **CO-035** | Usage caps per candidate and per assessment | Caps in tokens or currency plus requests-per-minute; behaviour at cap configurable (warn then block); candidate sees remaining budget. | Must | MMP |  |
| **CO-036** | Use HelloSmart AI credits instead of own key | Company can select managed credits where purchased; usage metered and shown. | Should | Phase 2 | Decision accepted (Open Q7): MMP uses the company's own key; self-serve managed credits are Phase 2. Pricing and markup set by Platform Admin. |
| **CO-037** | AI usage and cost visibility | Per-assessment and org-wide tokens/cost by candidate and model. | Should | MMP |  |

### 7.9 Rubrics / Reviewer agents

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-038** | Define a custom rubric as reviewer agents | Each rubric item has name, goal, signals watched, scale with level anchors, weight, red flags; weights total 100%. | Must | MMP | Rubrics run as independent monitoring and review agents. |
| **CO-039** | Start from default rubric of the template or the agent library | Company can accept, edit, add or remove items; changes are versioned per assessment. | Must | MMP |  |
| **CO-040** | Choose agent mode | Post-session review (default) or live monitoring (observe and flag, never interrupt the candidate). | Should | Phase 2 |  |

### 7.10 Submissions and progress

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-041** | See all submissions and progress | Table per assessment: candidate, status (Invited, Ready, Connected, In progress, Submitted, Expired), time used, last activity, score. | Must | MMP |  |
| **CO-042** | Submission detail view | Shows deliverables/artifacts, activity timeline, AI conversation transcript, final snapshot and per-agent reports with cited evidence. | Must | MMP |  |

### 7.11 Workspaces

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-043** | See active workspaces | List with candidate, assessment, mode, status, started time, time left; auto-refresh. | Must | MMP |  |
| **CO-044** | Destroy a workspace at any time | Confirmation dialog; workspace state is snapshotted first; candidate is notified; action audit-logged; session marked accordingly. | Must | MMP |  |

### 7.12 Review and results

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-045** | Provide scores per rubric item and overall | Reviewer enters score per dimension and overall; can accept or override agent scores; overrides keep the original and are audit-logged. | Must | MMP | Human-in-the-loop is required for AI-assisted hiring decisions. |
| **CO-046** | Add custom notes | Free-text note at dimension level and overall; visible to company users, optionally shared with candidate. | Must | MMP |  |
| **CO-047** | Edit scores after finalization with versioned history | Authorized company users can edit finalized results; each edit creates a new version keeping previous scores, notes, editor and timestamp; original agent scores are never overwritten; released results update only if already released. | Must | MMP | Decision accepted (Open Q8). |
| **CO-048** | Release results to candidates | Per-assessment or per-candidate toggle; when ON the candidate sees scores and shared notes. | Must | MMP | Default OFF. |
| **CO-049** | Compare candidates and shortlist | Side-by-side score comparison; mark Shortlisted/Rejected. | Should | Phase 2 |  |
| **CO-050** | Export report | PDF per candidate and CSV per assessment. | Should | Phase 2 |  |

### 7.13 Analytics

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-051** | Analytics per assessment | Invited, started, completed, expired; completion rate and drop-off; avg time; score distribution; per-rubric averages; AI usage; agent agreement. | Must | MMP |  |
| **CO-052** | Overall analytics across assessments | Org-level rollups with date filter; usage against plan entitlements. | Must | MMP |  |

### 7.14 Settings

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-053** | Central settings page | Sections: Organization, Branding, AI providers, Team, Notifications, Billing, Data retention. | Must | MMP |  |

### 7.15 Branding

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-054** | Upload logo for candidate portal, emails and reports | PNG/SVG with size limits; shown in a default location on the candidate portal and reports. | Must | MMP |  |
| **CO-055** | Default 'Powered by hellosmart.ai' mark in a corner | Shown on candidate portal and reports by default; can only be removed or replaced when white-label entitlement is active. | Must | MMP | White label is a paid add-on. |

### 7.16 Billing

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-056** | View quotes, invoices and pay in-app | Company Admin sees pending quotes and invoices, can pay online, download receipts and manage a recurring subscription. | Must | MMP | See Sales_Payments sheet. |

### 7.17 Governance

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-057** | Organization audit log | Records config changes, key changes, overrides, destroys, result releases with user and timestamp. | Should | Phase 2 |  |

### 7.18 Integrations

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CO-058** | ATS integration and API/webhooks | Greenhouse, Lever, Workday or generic webhook for candidate create and result push. | Could | Phase 3 |  |

---

## 8. Business requirements: Candidate

Requirements for candidates taking assessments. Candidates arrive by emailed link or through the same master login, where role-based access routes them to the candidate portal.

### 8.1 Access

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-001** | Access via emailed link | Link opens set-password page; password reset is forced on first login; link is single-use and expiring. | Must | MMP |  |
| **CA-002** | Sign in from the master login with RBAC | Same login page as other roles; role Candidate lands on the candidate portal; candidates cannot reach company or admin routes. | Must | MMP |  |
| **CA-003** | Forgot / reset password; change password | Emailed reset link; password policy enforced. | Must | MMP |  |

### 8.2 Dashboard

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-004** | See assigned workspaces (tasks) | Cards/list with task name, company, mode, time rules and status. | Must | MMP | Statuses: Invited, Window not open, Ready, Not connected, Connected, In progress, Disconnected (resumable), Submitted, Expired. |
| **CA-005** | Workspace connect state | Each workspace shows 'Connected' or 'Not connected' with a Connect/Resume button. | Must | MMP |  |

### 8.3 Pre-flight

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-006** | Task brief, rules and timing before connect | Shows brief, deliverables, duration/window, AI policy (on/off, caps) and what is recorded. | Must | MMP |  |

### 8.4 Consent

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-007** | Mode-based consent before connecting | Consent text depends on mode (Cloud: activity, AI transcript and screen recording as configured; Local: agent install, terminal/file/git capture; Chat; Browser: page and action logging). Connect is disabled until consent is given. | Must | MMP | Store consent version, timestamp and IP. |

### 8.5 Cloud workspace

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-008** | Force full-screen when connecting in Cloud mode | Workspace requests full screen on connect; session is only active while full screen. | Must | MMP | Browsers cannot truly prevent exit; the system detects it and reacts. |
| **CA-009** | Exit from full screen disconnects the session | On exit the workspace disconnects, an overlay asks the candidate to resume, and the event is logged for reviewers. The timer keeps running while disconnected. An assessment-level setting 'Pause timer on disconnect' exists and is OFF by default. The consent screen warns the candidate. | Must | MMP | Decision accepted (Open Q2). |
| **CA-010** | All work is saved so the candidate can continue | Files, terminal history, editor state, chat transcript and drafts are persisted continuously (target RPO <= 30 s) and restored on resume. | Must | MMP |  |
| **CA-011** | Reconnect and resume | Candidate can reconnect until the timer or window ends; state is restored; each disconnect/resume is logged. | Must | MMP |  |

### 8.6 Timing

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-012** | Workspace access follows time-bound or window-bound rules | Before window opens or after it closes, Connect is disabled with a clear message; time-bound sessions auto-submit at expiry. | Must | MMP | Enforced server-side, not just in the UI. |
| **CA-013** | Countdown timer and warnings | Always visible; warnings at set thresholds (e.g. 15 and 5 minutes). | Must | MMP |  |

### 8.7 Local mode

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-014** | Runnable locally | Candidate gets a one-line command or small desktop agent; pulls the task environment (devcontainer/Docker); status flips to Connected (Local) when the agent checks in; AI calls go through the HelloSmart proxy. | Should | Phase 2 | Decision accepted (Open Q10): Phase 2. Cloud-first; local is an opt-in assessment setting. |

### 8.8 Non-tech modes

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-015** | Chat workspace for non-technical roles | AI chat using the company's key (or a platform key allocated by Platform Admin), with files/documents provided; full transcript captured. | Must | MMP | Decision accepted (Open Q7, Q10). |
| **CA-016** | Browser workspace | Sandboxed remote browser with mock tools; monitor agent logs pages and actions. | Should | Phase 2 | Decision accepted (Open Q10): Phase 2. |

### 8.9 AI assistant

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-017** | Use AI assistant when enabled | Assistant available only if ON for the assessment; shows remaining budget; blocks at cap with a clear message. | Must | MMP |  |

### 8.10 Submission

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-018** | Submit work | Confirmation dialog; final snapshot saved; session closed; candidate cannot re-enter after submit unless the company reopens. | Must | MMP |  |
| **CA-019** | Provisioning failure handling | If a workspace fails to start, the candidate sees a support route and is compensated with extra time automatically. | Should | MMP |  |

### 8.11 Results

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-020** | View results when provisioned by the company | Only visible if the company released them; shows overall and per-dimension scores and shared notes. | Must | MMP |  |

### 8.12 Profile and privacy

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-021** | Profile and data rights | Candidate can see what data is held, and request correction or deletion; request routed to company/admin. | Should | Phase 2 | GDPR / DPDP. |

### 8.13 Accessibility

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-022** | Accessible UI and accommodation requests | WCAG 2.2 AA target; candidate can request extra time; company can grant it. | Should | Phase 2 |  |

### 8.14 Integrity

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **CA-023** | Integrity events logged | Full-screen exit, tab visibility change and long idle recorded as timeline events for reviewers; not auto-failing. | Should | Phase 2 | Evidence, not verdict. |

---

## 9. Business requirements: Platform Admin

Requirements for HelloSmart's internal administration: accounts, trials and entitlements, pricing, private templates, reviewer agents, workspaces, routing and governance.

### 9.1 Access control

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-001** | Platform Admin master login with MFA | MFA mandatory; session timeout; IP/device logging. | Must | MMP |  |

### 9.2 Accounts

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-002** | Create all types of accounts | Platform Admin can create orgs, Company Admins, Candidates, and internal staff; sends invite emails. | Must | MMP |  |
| **AD-003** | Role-based access control matrix | Defined roles (Platform Admin, Sales, Support, Company Admin, Reviewer, Candidate) with permission sets; least privilege enforced server-side. | Must | MMP |  |
| **AD-004** | Enable/disable/suspend orgs and users | Suspension blocks login and workspace launch; reversible; audit-logged. | Must | MMP |  |
| **AD-005** | Impersonate/support-view a company (read-only) | Time-limited, reason required, fully audit-logged. | Should | Phase 2 |  |

### 9.3 Trial and entitlements

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-006** | Provision trial with X templates, Y candidates, Z days per org | Values set at provisioning and editable later; usage counters visible. | Must | MMP |  |
| **AD-007** | Per-org entitlement overrides and feature flags | Toggle workspace modes, white label, custom domain, extra agents, retention days, AI credits. | Must | MMP |  |

### 9.4 Pricing and plans

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-008** | Maintain pricing plans and features | Plan catalog with price, billing interval, included limits and feature set; change history; new plans do not alter existing contracts silently. | Must | MMP |  |
| **AD-009** | Add-on catalog | Add-ons: white label, custom routing/domain, custom template build, local mode, extended retention, extra agents, AI credits packs. | Must | MMP |  |

### 9.5 Templates

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-010** | Build and manage task templates | Create manifest (scenario, resources, environment, env slots, AI defaults, reviewers, timing); versioned; draft > tested > published. | Must | MMP | Built behind the curtain by HelloSmart. |
| **AD-011** | Templates are private per company | Each template is assigned to specific org(s); no public marketplace; org users can never see another org's templates. | Must | MMP | Key business rule. |
| **AD-012** | Clone a base template into a company-specific copy | Clone, customize and assign to one org; lineage tracked. | Must | MMP |  |
| **AD-013** | Build resources and golden images | Codebase at pinned commit, seed data, services, env slots; automated smoke test must pass before publish. | Must | MMP |  |

### 9.6 Agents

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-014** | Maintain reviewer agent library | Define agents (prompt/config, model, version, enabled flag); version and roll back. | Must | MMP |  |
| **AD-015** | Monitor each independent agent's performance and health | Dashboard per agent: success/failure rate, latency, queue depth, cost per review, score consistency and inter-agent agreement, drift; alerts on thresholds. | Must | MMP |  |
| **AD-016** | Re-run or force a review | Admin can re-run an agent on a submission; both runs are retained. | Should | Phase 2 |  |
| **AD-017** | Prompt-injection and gaming safeguards for graders | Grader inputs sanitized; adversarial test suite; flags suspicious submissions for human review. | Must | MMP |  |

### 9.7 Workspaces

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-018** | Oversee all workspaces across orgs | Global list with org, candidate, mode, status, age, resource usage and cost; filters and search. | Must | MMP |  |
| **AD-019** | Force-destroy any workspace; orphan and idle cleanup | Auto-destroy at session end/expiry; orphan detection job; spend alerts. | Must | MMP |  |
| **AD-020** | Capacity and warm pool management | Configure pool size and VM sizes; capacity alerts. | Should | Phase 2 |  |

### 9.8 Routing and branding

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-021** | Configure custom routing/domain for an org | Enter custom domain, DNS verification, automatic SSL; candidate links and emails use it; only if entitlement is active. | Should | MMP | Paid add-on. |
| **AD-022** | Configure white label for an org | Remove 'Powered by' mark, custom colors/logo, custom email sender domain; only if entitlement is active. | Should | MMP | Paid add-on. |

### 9.9 AI credits

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-023** | Manually allocate a platform AI key and cap to an org (MMP interim) | Admin assigns a platform-held key with a token/currency cap per org and per assessment; usage visible; billed as a quoted line item; revocable. | Must | MMP | Decision accepted (Open Q7): interim route so the Chat workspace works before self-serve credits ship. |
| **AD-024** | Manage HelloSmart-managed AI credits | Platform keys held in vault; per-org credit allocation, usage and caps; markup configuration. | Should | Phase 2 |  |

### 9.10 Analytics

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-025** | Platform-wide analytics | Orgs, trials, conversion, usage, workspace cost, agent cost, revenue. | Should | MMP |  |

### 9.11 Support

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-026** | Extend trial, candidate window or re-provision a session | Admin tools with reason and audit log. | Must | MMP |  |

### 9.12 Governance

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-027** | Global audit log | Immutable log of admin actions, config and data access. | Must | MMP |  |
| **AD-028** | Data retention and deletion policy controls | Default retention is 90 days after the assessment closes for recordings, transcripts and artifacts; configurable per org within limits set by Platform Admin; automatic deletion jobs; every deletion logged. | Must | MMP | Decision accepted (Open Q9). Counsel to confirm the period per market. |

### 9.13 Communications

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **AD-029** | Manage email templates | Invite, password reset, assignment, reminders, payment; variables and preview. | Should | MMP |  |

---

## 10. Business requirements: Sales, provisioning and payments

The commercial path: landing page, cal.com booking, discovery call, quote, payment and provisioning on the standard HelloSmart route, with paid add-ons for own routing, white label and custom templates.

### 10.1 Landing and booking

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-001** | Landing page with product pitch and category | States category (AI-native work simulation), vision, how it works and use cases; single primary CTA 'Book a meeting'. | Must | MMP |  |
| **SP-002** | cal.com meeting booking | Embedded cal.com booking; UTM and source captured; booking confirmation email. | Must | MMP |  |
| **SP-003** | Booking webhook creates a lead in admin | cal.com webhook creates/updates a lead with name, email, company and time. | Should | MMP |  |

### 10.2 Deal pipeline

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-004** | Track deal stages in admin | Stages: Lead, Meeting booked, Meeting held, Quoted, Paid, Provisioned; owner and notes. | Should | MMP |  |

### 10.3 Provisioning

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-005** | Provision the customer directly on the standard HelloSmart route | Admin creates org on the multi-tenant app route (e.g. app.hellosmart.ai/{org}) in minutes; no separate infrastructure. | Must | MMP | Default delivery model. |
| **SP-006** | Customer-specific custom templates | Templates prepared for a company are assigned to that company only; custom template build is quoted as a line item. | Must | MMP | Private templates; HelloSmart works behind the curtain. |

### 10.4 Add-ons

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-007** | Own routing / custom domain as a paid add-on | Add-on on the quote; once paid, admin enables custom domain; absent payment, feature stays locked. | Must | MMP | Decision accepted (Open Q3): routing = own domain and portal routing. Separate instance/VPC is an Enterprise quote. |
| **SP-008** | White label and branding as a paid add-on | Add-on on the quote; unlocks removal of 'Powered by' and custom branding. | Must | MMP |  |

### 10.5 Quoting

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-009** | Quote builder | Line items (platform plan, candidate pack, custom templates, white label, custom routing, AI credits), discounts, tax (GST), currency, validity date, one-time vs recurring. | Must | MMP |  |
| **SP-010** | Send quote and track acceptance | Quote is emailed with a secure link; status Sent, Viewed, Accepted, Expired. | Must | MMP |  |

### 10.6 Payments

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-011** | Email payment collection | Admin emails a payment link for a quote/invoice; link opens a hosted checkout; status updates automatically. | Must | MMP |  |
| **SP-012** | In-app payment | Company Admin sees quoted amounts in Billing and pays in-app (card, UPI, netbanking depending on gateway). | Must | MMP |  |
| **SP-013** | Recurring payments | Monthly or annual subscriptions with auto-renew, failed-payment retries (dunning), cancel and plan change. | Must | MMP |  |
| **SP-014** | One-time payments | Setup fees and custom template builds are billed as one-time charges. | Must | MMP |  |
| **SP-015** | Custom payment code | Admin can generate a code tied to a custom quote/price or discount; company redeems it in-app or via the email link; single-use or limited-use; expiry. | Should | MMP | Decision accepted (Open Q4): custom code = custom quote/coupon code. |
| **SP-016** | Automatic entitlement changes on payment | Payment success unlocks plan limits and add-ons; failure after grace period downgrades or suspends. | Must | MMP |  |
| **SP-017** | Invoices, receipts and tax | GST-compliant invoice PDF; receipts emailed; history in Billing. | Must | MMP |  |
| **SP-018** | Payment gateway integration | MMP: Razorpay (cards, UPI, netbanking, subscriptions, GST invoices) with webhook signature verification; no card data stored by HelloSmart. Built behind a payment abstraction so other gateways can be added. | Must | MMP | Decision accepted (Open Q5). |
| **SP-019** | Stripe gateway for international customers | Stripe checkout, subscriptions and webhooks behind the same payment abstraction; multi-currency pricing. | Should | Phase 2 | Decision accepted (Open Q5). |
| **SP-020** | Refunds and credit notes | Admin can refund fully or partially and issue credit notes with an audit trail. | Should | Phase 2 |  |

### 10.7 Reporting

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-021** | Revenue and payment reporting for admin | MRR, collections, outstanding quotes, add-on revenue, services share of revenue. | Should | Phase 2 | Keep services under about 20-30% of revenue. |

### 10.8 Enterprise

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **SP-022** | Dedicated instance / VPC deployment | Quoted individually; only for enterprise customers; not part of MMP build. | Could | Phase 3 |  |

---

## 11. Non-functional requirements

Security, privacy, reliability, cost control and extensibility that apply across every persona.

### 11.1 Security

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-001** | Strict tenant isolation | Every query and file is org-scoped; automated tests prove no cross-org reads; templates and submissions never leak. | Must | MMP |  |
| **NF-002** | Secrets and API keys in a vault | Encrypted at rest, never returned in full, never present in workspaces; short-lived session tokens only. | Must | MMP |  |
| **NF-003** | Encryption in transit and at rest | TLS everywhere; encrypted storage and backups. | Must | MMP |  |
| **NF-004** | Workspace sandboxing and egress control | Workspaces isolated; outbound traffic restricted (e.g. AI domains blocked when AI is OFF); no real cloud credentials for candidates (use mock/LocalStack). | Must | MMP |  |
| **NF-005** | AI proxy as the single path for AI calls | All candidate AI calls are logged, capped, and policy-checked; candidates never see real provider keys. | Must | MMP |  |
| **NF-006** | Rate limiting, abuse protection, secure session management | Login and API throttling; CSRF/XSS protections; secure cookies. | Must | MMP |  |

### 11.2 Privacy and compliance

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-007** | Consent, notice and retention | Consent captured before any recording; default 90-day retention, configurable per org; erasure on request. | Must | MMP | GDPR, India DPDP Act. |
| **NF-008** | Human-in-the-loop for AI scoring | AI scores are evidence for a human reviewer; overrides retained; decisions explainable by cited evidence. | Must | MMP | EU AI Act treats hiring AI as high-risk; NYC LL144 bias audit may apply. Confirm with counsel. |
| **NF-009** | Fairness monitoring | Track score distributions and adverse-impact indicators where data is lawfully available. | Should | Phase 3 |  |
| **NF-010** | SOC 2 / ISO 27001 readiness | Controls, logging and policies aligned to start an audit when enterprise demand appears. | Should | Phase 3 |  |

### 11.3 Reliability

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-011** | Workspace launch time | p95 launch < 60 seconds from Connect (warm pool or snapshot clone). | Should | MMP |  |
| **NF-012** | Availability | 99.5% monthly for candidate and company portals at MMP. | Should | MMP |  |
| **NF-013** | No work loss | Autosave RPO <= 30 s; resume restores state after browser crash or disconnect. | Must | MMP |  |

### 11.4 Cost control

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-014** | Automatic VM cleanup and spend limits | Idle, expired and orphaned VMs destroyed automatically; hard per-session and per-org spend limits. | Must | MMP |  |

### 11.5 Observability

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-015** | Logging, metrics and alerts | Central logs, error tracking, workspace and agent dashboards, on-call alerts. | Must | MMP |  |

### 11.6 Usability

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-016** | Accessibility and browser support | WCAG 2.2 AA target; latest Chrome, Edge, Safari, Firefox (full-screen API support required for Cloud mode). | Should | Phase 2 |  |

### 11.7 Email

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-017** | Deliverability | SPF, DKIM, DMARC configured; bounce handling; branded sender on white label. | Must | MMP |  |

### 11.8 Extensibility

| ID | Requirement | Acceptance criteria | Priority | Phase | Notes |
|---|---|---|---|---|---|
| **NF-018** | Template manifest as a versioned schema | New roles can be added by authoring a manifest and rubric without platform code changes. | Must | MMP | Core to the 'all niche roles' strategy. |

---

## 12. Exception and edge flows

What happens when the happy path breaks.

| ID | Scenario | Trigger | System response | Actor action | Resulting status | Requirements |
|---|---|---|---|---|---|---|
| EX-01 | Trial candidate cap reached | Company adds or launches beyond Y candidates (or pending invites exceed 2x). | Blocks the action; keeps existing data readable; shows Contact us / Pay CTA. | Company pays or asks Platform Admin to raise the cap. | Blocked until entitlement changes | CO-009 |
| EX-02 | Trial expired | Z days elapse. | Blocks new assessments, candidates and workspace launches; running sessions finish; data stays readable. | Company pays; Admin can extend trial. | Trial expired | CO-009, AD-026, CO-010 |
| EX-03 | AI key invalid, revoked or provider outage | Provider rejects calls during a session. | AI assistant shows a degraded message; session continues; event logged; company and admin notified. | Company rotates the key in Settings. | AI degraded | CO-032, NF-005 |
| EX-04 | AI cap reached for a candidate | Token or currency cap hit. | Warns first, then blocks AI; candidate sees a clear message; work continues without AI. | Company may raise the cap for that candidate. | AI blocked, session active | CO-035, CA-017 |
| EX-05 | Full-screen exit (Cloud) | Candidate leaves full screen. | Disconnects workspace, logs the event, shows resume overlay; timer keeps running (default). | Candidate resumes. | Disconnected (resumable) | CA-009, CA-011 |
| EX-06 | Browser crash or network drop | Connection lost. | State already autosaved; resume restores files, terminal, chat and drafts. | Candidate reconnects before time or window ends. | Disconnected (resumable) | CA-010, CA-011 |
| EX-07 | Candidate tries to start outside the window | Clicks Connect before start or after end. | Connect disabled; message states the window; enforced server-side. | Candidate waits or asks company for an extension. | Window not open / Expired | CA-012, CO-031 |
| EX-08 | Time runs out mid-work | Duration or window ends. | Auto-submits the current state, destroys the workspace, queues review. | None. | Submitted (auto) | CO-028, CA-018 |
| EX-09 | Workspace provisioning fails | VM or services do not start. | Retries; if still failing shows a support route and adds compensating time automatically; alerts Admin. | Candidate contacts support; Admin re-provisions. | Re-provisioned | CA-019, AD-018 |
| EX-10 | Company destroys an active workspace | Company Admin clicks Destroy. | Snapshots state first, notifies the candidate, logs the action, marks the session. | Company may extend time or reopen. | Workspace destroyed | CO-044 |
| EX-11 | Bulk upload has errors | Invalid emails, duplicates or over the cap. | Valid rows import; invalid rows are skipped and returned in a downloadable error report. | Company fixes and re-uploads. | Partial import | CO-012 |
| EX-12 | Invite link expired or lost | Candidate opens an expired link. | Shows a clear message and a request-new-link action; does not reveal account details. | Company resends the invite. | Invite resent | CO-013, CO-017 |
| EX-13 | Recurring payment fails | Gateway declines the renewal. | Retries (dunning), emails the company, grace period, then downgrade or suspend. | Company updates payment method in Billing. | Past due / Suspended | SP-013, SP-016 |
| EX-14 | Paid add-on not purchased | Company tries to use own domain or white label without entitlement. | Feature stays locked with a request-quote prompt. | Company contacts sales; Admin quotes. | Locked | SP-007, SP-008 |
| EX-15 | Suspected prompt injection or gaming | Submission tries to manipulate the grader. | Inputs sanitized; submission flagged; scores marked low-confidence for human review. | Reviewer decides. | Flagged for review | AD-017, CO-045 |
| EX-16 | Reviewer agent fails | Agent errors or times out. | Auto-retry, then alert Admin; report shows the missing dimension; human review still possible. | Admin re-runs the agent. | Partial agent report | AD-015, AD-016 |
| EX-17 | Candidate deletion or erasure request | Company or candidate requests deletion. | Destroys workspaces, deletes personal data and recordings per policy, logs the request. | Company Admin or Platform Admin confirms. | Candidate erased | CO-016, CA-021, AD-028 |

---

## 13. Decisions and resolved questions

Every question raised during requirements gathering has been resolved and is reflected in the requirements above.

| # | Question | Decision | Status | Affected requirements |
|---|---|---|---|---|
| 1 | Does the candidate cap count at invite or at workspace launch? | Candidate counts once against the cap at first workspace launch. Pending (not yet launched) invites are capped separately at 2x the cap; the 2x multiplier is my assumption and is configurable by Platform Admin. | Accepted | CO-009, CO-011 |
| 2 | Does the timer keep running while a candidate is disconnected after exiting full screen? | Timer keeps running while disconnected. An assessment-level 'Pause timer on disconnect' setting exists and is OFF by default. The consent screen warns the candidate before connecting. | Accepted | CA-009, CA-011, CA-007 |
| 3 | Does 'routing' mean the company's own domain, or AI-model routing? | Routing = company's own domain and portal routing, sold as a paid add-on. Separate instance/VPC stays an Enterprise quote in Phase 3. | Accepted | SP-007, AD-021, SP-022 |
| 4 | What does 'custom code' mean in payments? | Custom code = custom quote/coupon code that applies an agreed price or discount; single- or limited-use with expiry. | Accepted | SP-015 |
| 5 | Which payment gateway(s) for MMP? | Razorpay in the MMP (cards, UPI, netbanking, subscriptions, GST invoices). Stripe added in Phase 2 behind the same payment abstraction. | Accepted | SP-018, SP-019 |
| 6 | Can Company Reviewers exist in MMP or only Company Admins? | MMP has Company Admin users only (created by Platform Admin). The Reviewer role arrives in Phase 2. | Accepted | CO-007 |
| 7 | Who pays for AI usage in a trial: company key or HelloSmart credits? | Companies, including trial users, bring their own key in the MMP. RESOLUTION OF A CONFLICT: the Chat workspace needs a key, and your original brief said chat uses HelloSmart credits. So Platform Admin can manually allocate a platform key with a cap to an org as a quoted add-on (interim). Self-serve managed credits are Phase 2. | Accepted | CO-032, CO-036, AD-023, CA-015 |
| 8 | Can a company edit scores after finalizing, and is that audit-logged? | Yes. Every edit after finalization creates a new version; original agent scores, prior versions, editor and timestamp are retained. | Accepted | CO-047, CO-045 |
| 9 | What are default retention periods for recordings and transcripts? | Default 90 days after the assessment closes, configurable per org within limits set by Platform Admin. Counsel to confirm the period per market. | Accepted | AD-028, NF-007, CO-016 |
| 10 | Which workspace modes are in the MMP build? | MMP = Cloud VM and Chat. Local and Browser appear as locked 'coming soon' options and ship in Phase 2. | Accepted | CO-022, CA-015, CA-014, CA-016 |
| 11 | Is the master login one URL for all roles? | One master login URL for all roles with RBAC redirect. White-label customers get a branded login route on their custom domain (add-on). | Accepted | CO-004, CA-002 |
| 12 | Assumption: companies are created by Platform Admin after the sales call; no public self-signup. | Platform Admin creates every org. Self-serve is revisited after the first 10-15 paying customers. | Accepted | CO-005 |

---

## 14. Assumptions and items to confirm

Collected from the notes column of the requirement sheets. These are the points where the business has made an assumption or needs outside confirmation (for example legal counsel).

| Requirement | Note |
|---|---|
| **CO-009** Trial limits enforced with clear messaging | Decision accepted (Open Q1). The 2x pending-invite multiplier is an assumption. |
| **AD-028** Data retention and deletion policy controls | Decision accepted (Open Q9). Counsel to confirm the period per market. |
| **NF-008** Human-in-the-loop for AI scoring | EU AI Act treats hiring AI as high-risk; NYC LL144 bias audit may apply. Confirm with counsel. |

---

## 15. Requirements summary and traceability

| Area | Total | Must | Should | Could | MMP | Phase 2 | Phase 3 |
|---|---|---|---|---|---|---|---|
| Company | 58 | 45 | 12 | 1 | 50 | 7 | 1 |
| Candidate | 23 | 17 | 6 | 0 | 18 | 5 | 0 |
| Platform Admin | 29 | 21 | 8 | 0 | 25 | 4 | 0 |
| Sales, Provisioning and Payments | 22 | 15 | 6 | 1 | 18 | 3 | 1 |
| Non-Functional | 18 | 13 | 5 | 0 | 15 | 1 | 2 |
| **Total** | **150** | **111** | **37** | **2** | **126** | **20** | **4** |

**Traceability.** Every step in the end-to-end flow (section 5) and every exception (section 12) lists the requirement IDs that cover it. Every decision (section 13) lists the requirements it changed. Requirement status values used in the workbook: Draft, Approved, In progress, Done, Deferred.

| Status | Count |
|---|---|
| Draft | 132 |
| Approved | 18 |
| In progress | 0 |
| Done | 0 |
| Deferred | 0 |
