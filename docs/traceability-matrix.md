# HelloSmart.ai — Requirements Traceability Matrix

- **Ticket:** PH-I27 / S0-T07-1
- **Sprint:** Sprint 0 — Foundation (24–31 Oct 2026)
- **Source of truth:** [`AGENTS.md`](../AGENTS.md), Section 9 — Feature requirements
- **Scope:** 126 MMP requirements across Company, Candidate, Platform Admin, Sales/Payments, and Non-functional/Security.
- **Purpose:** Map each in-scope requirement to a verification method and planned target test asset.

## Status semantics

- **Draft** — mapping and target path proposed; no implementation/execution evidence is claimed by this matrix.
- **Automated** — an automated test exists and is included in the relevant test command/CI.
- **Verified** — the automated test has been executed successfully against the intended behavior.

Target paths are planned test asset paths, not a claim that those files currently exist. Change a row to **Automated** only after the test is implemented and discoverable; change to **Verified** only after a successful run with evidence. Keep feature implementation status distinct from test lifecycle status.

## Coverage summary

| Requirement area | MMP rows expected | Rows mapped |
|---|---:|---:|
| Company (CO) | 50 | 50 |
| Candidate (CA) | 18 | 18 |
| Platform Admin (AD) | 25 | 25 |
| Sales, provisioning and payments (SP) | 18 | 18 |
| Non-functional, security and compliance (NF) | 15 | 15 |
| **Total** | **126** | **126** |

**Validation:** Requirement IDs are unique; each of the 126 in-scope MMP IDs appears exactly once. The 24 deferred requirements are listed separately below and are not part of the MMP table.

## MMP requirement traceability

| Requirement ID | Name & description (from AGENTS.md Section 9) | Test type | Target test file path | Status |
|---|---|---|---|---|
| CO-001 | **Sign in with email and password** — Password hashing, expiring reset link, throttling/lockout, configurable session expiry | Security | `tests/security/company/co-001-sign-in-with-email-and-password.test.ts` | Draft |
| CO-002 | **Sign in with Google SSO** — Match verified existing email; never create org through SSO | Security | `tests/security/company/co-002-sign-in-with-google-sso.test.ts` | Draft |
| CO-003 | **Sign in with Microsoft SSO** — Microsoft auth matches verified email | Security | `tests/security/company/co-003-sign-in-with-microsoft-sso.test.ts` | Draft |
| CO-004 | **Master login with role-based routing** — Shared login redirects role to correct portal | E2E | `tests/e2e/company/master-login-with-role-based-routing.spec.ts` | Draft |
| CO-005 | **Company account is provisioned by HelloSmart after sales call** — Platform Admin creates org, first Company Admin and trial; invite sent | E2E | `tests/e2e/company/company-account-is-provisioned-by-hellosmart-after-sales-call.spec.ts` | Draft |
| CO-006 | **Manage organization name and profile** — Edit org name, reflect changes and audit-log | Contract | `tests/api/company/co-006-manage-organization-name-and-profile.test.ts` | Draft |
| CO-008 | **Trial period with X templates, Y candidate cap, Z days** — Server-enforced entitlements and visible usage | Contract | `tests/api/company/co-008-trial-period-with-x-templates-y-candidate-cap-z-days.test.ts` | Draft |
| CO-009 | **Trial limits enforced with clear messaging** — Block new work at cap/expiry; preserve reads; enforce pending invite cap | Contract | `tests/api/company/co-009-trial-limits-enforced-with-clear-messaging.test.ts` | Draft |
| CO-010 | **Trial upgrade to paid plan** — Payment switches plan entitlements without data loss | Contract | `tests/api/company/co-010-trial-upgrade-to-paid-plan.test.ts` | Draft |
| CO-011 | **Add a single candidate (Create)** — Validate name/email, org-scoped uniqueness and cap | Contract | `tests/api/company/co-011-add-a-single-candidate-create.test.ts` | Draft |
| CO-012 | **Bulk upload candidates** — Row validation, duplicate report, limits and downloadable errors | Contract | `tests/api/company/co-012-bulk-upload-candidates.test.ts` | Draft |
| CO-013 | **Automatic account-created email with link** — Secure single-use expiring invite; force password reset | Contract | `tests/api/company/co-013-automatic-account-created-email-with-link.test.ts` | Draft |
| CO-014 | **View, search and filter candidates (Read)** — Org-scoped list, search, filters and pagination | Contract | `tests/api/company/co-014-view-search-and-filter-candidates-read.test.ts` | Draft |
| CO-015 | **Edit candidate (Update)** — Edit name; activated email changes require re-verification | Contract | `tests/api/company/co-015-edit-candidate-update.test.ts` | Draft |
| CO-016 | **Delete candidate (Delete)** — Confirmed soft delete, workspace cleanup, retention and audit | Security | `tests/security/company/co-016-delete-candidate-delete.test.ts` | Draft |
| CO-017 | **Resend invite / reset candidate access** — Resend invite/reset and audit action | Contract | `tests/api/company/co-017-resend-invite-reset-candidate-access.test.ts` | Draft |
| CO-018 | **Browse templates available to my company only** — Only org-assigned templates visible | Security | `tests/security/tenancy/co-018-browse-templates-available-to-my-company-only.test.ts` | Draft |
| CO-019 | **Preview a template** — Show scenario, deliverables, stack, mode, duration, policy and agents | Contract | `tests/api/company/co-019-preview-a-template.test.ts` | Draft |
| CO-020 | **Create an assessment from a template with a task name** — Pin template version; do not mutate master template | Contract | `tests/api/company/co-020-create-an-assessment-from-a-template-with-a-task-name.test.ts` | Draft |
| CO-021 | **Edit candidate-facing brief and deliverables** — Edit permitted candidate-facing fields | Contract | `tests/api/company/co-021-edit-candidate-facing-brief-and-deliverables.test.ts` | Draft |
| CO-022 | **Choose workspace mode** — MMP Cloud VM/Chat; later modes remain locked | E2E | `tests/e2e/company/choose-workspace-mode.spec.ts` | Draft |
| CO-023 | **Configure environment variables and secrets** — Declared slots; encrypted, masked, session-scoped values | Security | `tests/security/company/co-023-configure-environment-variables-and-secrets.test.ts` | Draft |
| CO-024 | **Dry-run preview as candidate before publishing** — Publishing blocked until dry run passes | E2E | `tests/e2e/company/dry-run-preview-as-candidate-before-publishing.spec.ts` | Draft |
| CO-025 | **Publish and deploy to candidates** — Provision assignments and send assignment email | Contract | `tests/api/company/co-025-publish-and-deploy-to-candidates.test.ts` | Draft |
| CO-026 | **Assign candidates to an assessment in bulk** — Respect caps; candidates see only their assignments | Security | `tests/security/company/co-026-assign-candidates-to-an-assessment-in-bulk.test.ts` | Draft |
| CO-028 | **Time-bound assessment** — Timer starts at first connect; auto-submit at expiry | Contract | `tests/api/company/co-028-time-bound-assessment.test.ts` | Draft |
| CO-029 | **Window-bound assessment** — Enforce configured window and timezone server-side | Contract | `tests/api/company/co-029-window-bound-assessment.test.ts` | Draft |
| CO-030 | **Combined window plus duration** — Enforce both window and duration server-side | Contract | `tests/api/company/co-030-combined-window-plus-duration.test.ts` | Draft |
| CO-031 | **Extend time or window for a candidate; revoke access** — Apply and audit extensions/revocation | Security | `tests/security/company/co-031-extend-time-or-window-for-a-candidate-revoke-access.test.ts` | Draft |
| CO-032 | **Add AI provider API keys in settings** — Encrypted, masked, test/rotate/delete/default keys | Security | `tests/security/company/co-032-add-ai-provider-api-keys-in-settings.test.ts` | Draft |
| CO-033 | **AI assistant ON/OFF per assessment** — OFF removes assistant and blocks AI egress in Cloud | Security | `tests/security/company/co-033-ai-assistant-on-off-per-assessment.test.ts` | Draft |
| CO-034 | **Select provider/key and allowed models per assessment** — Enforce key/model allowlist; use AI proxy | Security | `tests/security/company/co-034-select-provider-key-and-allowed-models-per-assessment.test.ts` | Draft |
| CO-035 | **Usage caps per candidate and per assessment** — Enforce token/currency and RPM caps; warn then block | Contract | `tests/api/company/co-035-usage-caps-per-candidate-and-per-assessment.test.ts` | Draft |
| CO-037 | **AI usage and cost visibility** — Show usage/cost by candidate, model, assessment and org | Contract | `tests/api/company/co-037-ai-usage-and-cost-visibility.test.ts` | Draft |
| CO-038 | **Define a custom rubric as reviewer agents** — Rubric dimensions and weights totaling 100% | Contract | `tests/api/company/co-038-define-a-custom-rubric-as-reviewer-agents.test.ts` | Draft |
| CO-039 | **Start from default rubric of the template or the agent library** — Edit/add/remove rubric items; version changes | Contract | `tests/api/company/co-039-start-from-default-rubric-of-the-template-or-the-agent-library.test.ts` | Draft |
| CO-041 | **See all submissions and progress** — Assessment list with scoped status, time, activity and score | Contract | `tests/api/company/co-041-see-all-submissions-and-progress.test.ts` | Draft |
| CO-042 | **Submission detail view** — Artifacts, timeline, transcript, snapshot and cited agent reports | Contract | `tests/api/company/co-042-submission-detail-view.test.ts` | Draft |
| CO-043 | **See active workspaces** — List candidate, assessment, mode, status and time data | Contract | `tests/api/company/co-043-see-active-workspaces.test.ts` | Draft |
| CO-044 | **Destroy a workspace at any time** — Confirm, snapshot first, notify, audit-log and mark session | Security | `tests/security/company/co-044-destroy-a-workspace-at-any-time.test.ts` | Draft |
| CO-045 | **Provide scores per rubric item and overall** — Human accepts/overrides scores; preserve original and audit | Contract | `tests/api/company/co-045-provide-scores-per-rubric-item-and-overall.test.ts` | Draft |
| CO-046 | **Add custom notes** — Dimension/overall notes with configured candidate sharing | Contract | `tests/api/company/co-046-add-custom-notes.test.ts` | Draft |
| CO-047 | **Edit scores after finalization with versioned history** — Preserve prior values, editor, timestamp and original agent scores | Contract | `tests/api/company/co-047-edit-scores-after-finalization-with-versioned-history.test.ts` | Draft |
| CO-048 | **Release results to candidates** — Hidden by default; show only after release toggle | Security | `tests/security/company/co-048-release-results-to-candidates.test.ts` | Draft |
| CO-051 | **Analytics per assessment** — Completion/drop-off, time, score, AI usage and agent agreement | Contract | `tests/api/company/co-051-analytics-per-assessment.test.ts` | Draft |
| CO-052 | **Overall analytics across assessments** — Org rollups, date filters and entitlement usage | Contract | `tests/api/company/co-052-overall-analytics-across-assessments.test.ts` | Draft |
| CO-053 | **Central settings page** — Organization, branding, AI, team, notifications, billing and retention | E2E | `tests/e2e/company/central-settings-page.spec.ts` | Draft |
| CO-054 | **Upload logo for candidate portal, emails and reports** — Validate image type/size and render in portal/reports | Contract | `tests/api/company/co-054-upload-logo-for-candidate-portal-emails-and-reports.test.ts` | Draft |
| CO-055 | **Default 'Powered by hellosmart.ai' mark in a corner** — Brand mark default; removal requires white-label entitlement | E2E | `tests/e2e/company/default-powered-by-hellosmart-ai-mark-in-a-corner.spec.ts` | Draft |
| CO-056 | **View quotes, invoices and pay in-app** — View/pay quotes, download receipts and manage subscription | E2E | `tests/e2e/company/view-quotes-invoices-and-pay-in-app.spec.ts` | Draft |
| CA-001 | **Access via emailed link** — Single-use expiring invite; force password reset on first login | Security | `tests/security/candidate/ca-001-access-via-emailed-link.test.ts` | Draft |
| CA-002 | **Sign in from the master login with RBAC** — Candidate portal routing; deny company/admin routes | Security | `tests/security/tenancy/ca-002-sign-in-from-the-master-login-with-rbac.test.ts` | Draft |
| CA-003 | **Forgot / reset password; change password** — Emailed reset link and password policy | Security | `tests/security/candidate/ca-003-forgot-reset-password-change-password.test.ts` | Draft |
| CA-004 | **See assigned workspaces (tasks)** — Candidate sees own assigned tasks and statuses | Security | `tests/security/candidate/ca-004-see-assigned-workspaces-tasks.test.ts` | Draft |
| CA-005 | **Workspace connect state** — State and Connect/Resume reflect server state | E2E | `tests/e2e/candidate/workspace-connect-state.spec.ts` | Draft |
| CA-006 | **Task brief, rules and timing before connect** — Show brief, deliverables, timing, AI policy and recording notice | E2E | `tests/e2e/candidate/task-brief-rules-and-timing-before-connect.spec.ts` | Draft |
| CA-007 | **Mode-based consent before connecting** — Block connect until mode-specific consent is recorded | Security | `tests/security/candidate/ca-007-mode-based-consent-before-connecting.test.ts` | Draft |
| CA-008 | **Force full-screen when connecting in Cloud mode** — Request fullscreen before active Cloud session | E2E | `tests/e2e/candidate/force-full-screen-when-connecting-in-cloud-mode.spec.ts` | Draft |
| CA-009 | **Exit from full screen disconnects the session** — Disconnect/log/offer resume; timer runs by default | E2E | `tests/e2e/candidate/exit-from-full-screen-disconnects-the-session.spec.ts` | Draft |
| CA-010 | **All work is saved so the candidate can continue** — Persist and restore work within RPO target | E2E | `tests/e2e/candidate/all-work-is-saved-so-the-candidate-can-continue.spec.ts` | Draft |
| CA-011 | **Reconnect and resume** — Restore state and log disconnect/resume until expiry | E2E | `tests/e2e/candidate/reconnect-and-resume.spec.ts` | Draft |
| CA-012 | **Workspace access follows time-bound or window-bound rules** — Block out-of-window connect; auto-submit at expiry | Security | `tests/security/candidate/ca-012-workspace-access-follows-time-bound-or-window-bound-rules.test.ts` | Draft |
| CA-013 | **Countdown timer and warnings** — Visible timer and threshold warnings | E2E | `tests/e2e/candidate/countdown-timer-and-warnings.spec.ts` | Draft |
| CA-015 | **Chat workspace for non-technical roles** — Approved key route and full transcript capture | E2E | `tests/e2e/candidate/chat-workspace-for-non-technical-roles.spec.ts` | Draft |
| CA-017 | **Use AI assistant when enabled** — Follow policy and budget; block at cap | Security | `tests/security/candidate/ca-017-use-ai-assistant-when-enabled.test.ts` | Draft |
| CA-018 | **Submit work** — Save snapshot, close session, prevent re-entry | E2E | `tests/e2e/candidate/submit-work.spec.ts` | Draft |
| CA-019 | **Provisioning failure handling** — Support route and automatic extra time after failure | Contract | `tests/api/candidate/ca-019-provisioning-failure-handling.test.ts` | Draft |
| CA-020 | **View results when provisioned by the company** — Show scores/notes only after release | Security | `tests/security/candidate/ca-020-view-results-when-provisioned-by-the-company.test.ts` | Draft |
| AD-001 | **Platform Admin master login with MFA** — Require MFA; log timeout/IP/device | Security | `tests/security/admin/ad-001-platform-admin-master-login-with-mfa.test.ts` | Draft |
| AD-002 | **Create all types of accounts** — Create permitted org/user types and send invites | Security | `tests/security/admin/ad-002-create-all-types-of-accounts.test.ts` | Draft |
| AD-003 | **Role-based access control matrix** — Enforce least-privilege server-side permissions | Security | `tests/security/admin/ad-003-role-based-access-control-matrix.test.ts` | Draft |
| AD-004 | **Enable/disable/suspend orgs and users** — Suspension blocks login/launch; reversible and audited | Security | `tests/security/admin/ad-004-enable-disable-suspend-orgs-and-users.test.ts` | Draft |
| AD-006 | **Provision trial with X templates, Y candidates, Z days per org** — Store trial entitlements and usage counters | Contract | `tests/api/admin/ad-006-provision-trial-with-x-templates-y-candidates-z-days-per-org.test.ts` | Draft |
| AD-007 | **Per-org entitlement overrides and feature flags** — Change org entitlements and feature flags | Contract | `tests/api/admin/ad-007-per-org-entitlement-overrides-and-feature-flags.test.ts` | Draft |
| AD-008 | **Maintain pricing plans and features** — Plan catalog, limits, features and change history | Contract | `tests/api/admin/ad-008-maintain-pricing-plans-and-features.test.ts` | Draft |
| AD-009 | **Add-on catalog** — Manage supported add-on entries | Contract | `tests/api/admin/ad-009-add-on-catalog.test.ts` | Draft |
| AD-010 | **Build and manage task templates** — Version manifest through draft/tested/published | Contract | `tests/api/admin/ad-010-build-and-manage-task-templates.test.ts` | Draft |
| AD-011 | **Templates are private per company** — Only assigned orgs can see templates | Security | `tests/security/tenancy/ad-011-templates-are-private-per-company.test.ts` | Draft |
| AD-012 | **Clone a base template into a company-specific copy** — Clone/customize/assign and retain lineage | Contract | `tests/api/admin/ad-012-clone-a-base-template-into-a-company-specific-copy.test.ts` | Draft |
| AD-013 | **Build resources and golden images** — Pinned resources require successful smoke test before publish | Contract | `tests/api/admin/ad-013-build-resources-and-golden-images.test.ts` | Draft |
| AD-014 | **Maintain reviewer agent library** — Create/version/enable/rollback agent configs | Contract | `tests/api/admin/ad-014-maintain-reviewer-agent-library.test.ts` | Draft |
| AD-015 | **Monitor each independent agent's performance and health** — Expose agent health, latency, cost, consistency and alerts | Contract | `tests/api/admin/ad-015-monitor-each-independent-agent-s-performance-and-health.test.ts` | Draft |
| AD-017 | **Prompt-injection and gaming safeguards for graders** — Sanitize grader inputs; flag suspicious submissions for human review | Security | `tests/security/admin/ad-017-prompt-injection-and-gaming-safeguards-for-graders.test.ts` | Draft |
| AD-018 | **Oversee all workspaces across orgs** — Search/filter global workspace status, resource use and cost | Security | `tests/security/admin/ad-018-oversee-all-workspaces-across-orgs.test.ts` | Draft |
| AD-019 | **Force-destroy any workspace; orphan and idle cleanup** — Destroy/cleanup and emit audit events/alerts | Security | `tests/security/admin/ad-019-force-destroy-any-workspace-orphan-and-idle-cleanup.test.ts` | Draft |
| AD-021 | **Configure custom routing/domain for an org** — Domain verification/SSL gated by entitlement | Contract | `tests/api/admin/ad-021-configure-custom-routing-domain-for-an-org.test.ts` | Draft |
| AD-022 | **Configure white label for an org** — White-label configuration requires entitlement | Contract | `tests/api/admin/ad-022-configure-white-label-for-an-org.test.ts` | Draft |
| AD-023 | **Manually allocate a platform AI key and cap to an org (MMP interim)** — Allocate/revoke capped key and report usage/billing | Security | `tests/security/admin/ad-023-manually-allocate-a-platform-ai-key-and-cap-to-an-org-mmp-interim.test.ts` | Draft |
| AD-025 | **Platform-wide analytics** — Report orgs, trials, conversion, usage, costs and revenue | Contract | `tests/api/admin/ad-025-platform-wide-analytics.test.ts` | Draft |
| AD-026 | **Extend trial, candidate window or re-provision a session** — Require reason and audit support action | Security | `tests/security/admin/ad-026-extend-trial-candidate-window-or-re-provision-a-session.test.ts` | Draft |
| AD-027 | **Global audit log** — Append-only log of admin actions/config/data access | Security | `tests/security/admin/ad-027-global-audit-log.test.ts` | Draft |
| AD-028 | **Data retention and deletion policy controls** — Retention limits, deletion jobs and deletion audit | Contract | `tests/api/admin/ad-028-data-retention-and-deletion-policy-controls.test.ts` | Draft |
| AD-029 | **Manage email templates** — Manage invite/reset/assignment/reminder/payment templates | Contract | `tests/api/admin/ad-029-manage-email-templates.test.ts` | Draft |
| SP-001 | **Landing page with product pitch and category** — Product pitch, use cases and primary meeting CTA | E2E | `tests/e2e/marketing/landing-page-with-product-pitch-and-category.spec.ts` | Draft |
| SP-002 | **cal.com meeting booking** — Booking captures UTM/source and sends confirmation | E2E | `tests/e2e/marketing/cal-com-meeting-booking.spec.ts` | Draft |
| SP-003 | **Booking webhook creates a lead in admin** — Signed webhook creates/updates lead | Contract | `tests/api/billing/sp-003-booking-webhook-creates-a-lead-in-admin.test.ts` | Draft |
| SP-004 | **Track deal stages in admin** — Deal stages, owner and notes | Contract | `tests/api/billing/sp-004-track-deal-stages-in-admin.test.ts` | Draft |
| SP-005 | **Provision the customer directly on the standard HelloSmart route** — Provision on shared multi-tenant route | E2E | `tests/e2e/billing/provision-the-customer-directly-on-the-standard-hellosmart-route.spec.ts` | Draft |
| SP-006 | **Customer-specific custom templates** — Template assigned only to customer; quote line item tracked | Security | `tests/security/tenancy/sp-006-customer-specific-custom-templates.test.ts` | Draft |
| SP-007 | **Own routing / custom domain as a paid add-on** — Domain remains locked until entitled/paid | Contract | `tests/api/billing/sp-007-own-routing-custom-domain-as-a-paid-add-on.test.ts` | Draft |
| SP-008 | **White label and branding as a paid add-on** — White-label remains locked without entitlement | Contract | `tests/api/billing/sp-008-white-label-and-branding-as-a-paid-add-on.test.ts` | Draft |
| SP-009 | **Quote builder** — Line items, discounts, GST, currency, validity and payment type | Contract | `tests/api/billing/sp-009-quote-builder.test.ts` | Draft |
| SP-010 | **Send quote and track acceptance** — Secure link and Sent/Viewed/Accepted/Expired states | Contract | `tests/api/billing/sp-010-send-quote-and-track-acceptance.test.ts` | Draft |
| SP-011 | **Email payment collection** — Hosted payment link updates status automatically | Contract | `tests/api/billing/sp-011-email-payment-collection.test.ts` | Draft |
| SP-012 | **In-app payment** — Company Admin pays supported quote in app | E2E | `tests/e2e/billing/in-app-payment.spec.ts` | Draft |
| SP-013 | **Recurring payments** — Renewal, cancellation, plan changes and dunning | Contract | `tests/api/billing/sp-013-recurring-payments.test.ts` | Draft |
| SP-014 | **One-time payments** — One-time setup/template charges supported | Contract | `tests/api/billing/sp-014-one-time-payments.test.ts` | Draft |
| SP-015 | **Custom payment code** — Enforce quote/discount, use limits and expiry | Contract | `tests/api/billing/sp-015-custom-payment-code.test.ts` | Draft |
| SP-016 | **Automatic entitlement changes on payment** — Success unlocks features; failed payment eventually downgrades/suspends | Contract | `tests/api/billing/sp-016-automatic-entitlement-changes-on-payment.test.ts` | Draft |
| SP-017 | **Invoices, receipts and tax** — GST invoice, emailed receipts and billing history | Contract | `tests/api/billing/sp-017-invoices-receipts-and-tax.test.ts` | Draft |
| SP-018 | **Payment gateway integration** — Verify Razorpay signatures, idempotency, no card storage | Security | `tests/security/billing/sp-018-payment-gateway-integration.test.ts` | Draft |
| NF-001 | **Strict tenant isolation** — Org-scoped queries/files; automated cross-org denial tests | Security | `tests/security/tenancy/nf-001-strict-tenant-isolation.test.ts` | Draft |
| NF-002 | **Secrets and API keys in a vault** — Encrypt secrets; never expose full keys/workspace keys | Security | `tests/security/security/nf-002-secrets-and-api-keys-in-a-vault.test.ts` | Draft |
| NF-003 | **Encryption in transit and at rest** — TLS and encrypted storage/backups | Security | `tests/security/security/nf-003-encryption-in-transit-and-at-rest.test.ts` | Draft |
| NF-004 | **Workspace sandboxing and egress control** — Isolation/egress controls; no real cloud credentials for candidates | Security | `tests/security/security/nf-004-workspace-sandboxing-and-egress-control.test.ts` | Draft |
| NF-005 | **AI proxy as the single path for AI calls** — Proxy logs/caps/policy-checks all candidate AI calls | Security | `tests/security/security/nf-005-ai-proxy-as-the-single-path-for-ai-calls.test.ts` | Draft |
| NF-006 | **Rate limiting, abuse protection, secure session management** — Throttling, CSRF/XSS protection and secure cookies | Security | `tests/security/security/nf-006-rate-limiting-abuse-protection-secure-session-management.test.ts` | Draft |
| NF-007 | **Consent, notice and retention** — Consent before recording; retention/erasure enforced | Security | `tests/security/security/nf-007-consent-notice-and-retention.test.ts` | Draft |
| NF-008 | **Human-in-the-loop for AI scoring** — Human decision, retained overrides and cited explanations | Security | `tests/security/security/nf-008-human-in-the-loop-for-ai-scoring.test.ts` | Draft |
| NF-011 | **Workspace launch time** — Measure p95 launch against <60-second target | Unit | `tests/performance/nf-011-workspace-launch-time.test.ts` | Draft |
| NF-012 | **Availability** — Verify 99.5% monthly portal availability target | Contract | `tests/api/security/nf-012-availability.test.ts` | Draft |
| NF-013 | **No work loss** — Autosave RPO <=30s and resume after crash/disconnect | E2E | `tests/e2e/security/no-work-loss.spec.ts` | Draft |
| NF-014 | **Automatic VM cleanup and spend limits** — Cleanup idle/expired/orphan VMs; enforce spend limits | Contract | `tests/api/security/nf-014-automatic-vm-cleanup-and-spend-limits.test.ts` | Draft |
| NF-015 | **Logging, metrics and alerts** — Central logs, error tracking, dashboards and alerts | Contract | `tests/api/security/nf-015-logging-metrics-and-alerts.test.ts` | Draft |
| NF-017 | **Deliverability** — SPF/DKIM/DMARC and bounce handling; branded sender gated | Contract | `tests/api/security/nf-017-deliverability.test.ts` | Draft |
| NF-018 | **Template manifest as a versioned schema** — New roles/rubrics via versioned manifest without code changes | Contract | `tests/api/security/nf-018-template-manifest-as-a-versioned-schema.test.ts` | Draft |

## Deferred requirements excluded from the 126-item MMP matrix

These 24 Section 9 requirements are Phase 2 or Phase 3 and are listed for scope transparency only.

| Requirement ID | Requirement name | Phase |
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
| AD-005 | Impersonate/support-view a company (read-only) | Phase 2 |
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

## Verification notes and completion checklist

- [x] All 126 MMP requirement IDs are cataloged once, with no duplicate IDs.
- [x] Every MMP requirement has a test type and target test path.
- [ ] Commit this file at `docs/traceability-matrix.md`.
- [ ] Implement backend API integration tests and run them locally.
- [ ] Implement Playwright tests for master login, role routing, and cross-portal tampering.
- [ ] Run `pnpm test:e2e` in headless mode and record the result.
- [ ] Update row status only when supported by implementation and execution evidence.

## Ticket-specific security coverage

BR-25 requires that candidate sessions never reach company or admin routes. CA-002 maps to a Playwright E2E test that should attempt direct navigation to protected `/admin` and `/company` routes as a candidate and verify access is denied by server-side/middleware authorization, not merely by hidden navigation links. Company users must likewise be denied admin routes.

## Change control

When a requirement changes, update `AGENTS.md` first (per its Section 18 change-control rule), then update this matrix. Do not mark a requirement Automated or Verified without corresponding test evidence.
