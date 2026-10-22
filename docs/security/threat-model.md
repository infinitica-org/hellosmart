# Threat model (STRIDE) · v1.0 · 2026-10-22

Owner: Architecture & Platform. Reviewed every sprint; updated when a new trust boundary appears.

## Assets (by impact)
1. Company AI provider keys and platform grader keys
2. Candidate personal data, recordings, transcripts, submissions
3. Company private templates and rubrics (commercial IP)
4. Scores and review decisions (hiring outcomes)
5. Payment and entitlement state
6. Platform admin accounts

## Trust boundaries
| # | Boundary | Hostile side |
|---|---|---|
| TB1 | Internet → CloudFront/WAF → web/api | anonymous users, bots |
| TB2 | Org A ↔ Org B inside api/DB | other tenants |
| TB3 | Candidate ↔ company/admin routes | candidates |
| TB4 | Workspace slot ↔ host / other slots / AWS | **candidates running arbitrary code** |
| TB5 | Workspace → AI proxy → providers | candidates, prompt content |
| TB6 | Submission → reviewer agents | **candidate content targeting graders** |
| TB7 | Razorpay / cal.com → webhooks | spoofed callers |
| TB8 | CI/CD and dependencies → prod | supply chain, compromised agent output |

## Top threats and controls
| ID | STRIDE | Threat | Controls | Verified by |
|---|---|---|---|---|
| T1 | I | Cross-tenant read via missing org filter | RLS FORCE + `withOrg` + 404 + lint rule `no-client-org-id` | cross-tenant suite (CI) |
| T2 | E | Candidate reaches company/admin APIs | role guards on every route, lint `require-roles-decorator`, middleware redirect | BR-25 tests |
| T3 | E/I | Slot escape to host or neighbour slot | Sysbox userns, per-slot netns + nftables, cgroup limits, patched AMI, 24 h recycle, GuardDuty Runtime | S6 pen-test, escape test suite |
| T4 | I | Slot steals cloud creds via IMDS | hop limit 1, nftables drop 169.254.169.254, host role has no data access | security test |
| T5 | I | Candidate extracts provider key | keys only in proxy memory; slot holds a 1-workspace JWT; log redaction | proxy tests assert no key in logs/env |
| T6 | T | Prompt injection changes scores | sanitizer, untrusted boundary, evidence-required validator, adversarial golden set, human finalize | nightly injection suite |
| T7 | S | Forged payment webhook unlocks plan | HMAC verify (constant time) on raw body, idempotent `gateway_ref`, re-fetch payment from Razorpay API before granting | webhook tests |
| T8 | S | Account takeover | argon2id, throttling + lockout, MFA for platform admins, session rotation, secure cookies | auth tests, S6 pen-test |
| T9 | D | Workspace cost / resource exhaustion | per-org spend caps, slot limits, ASG max, AWS Budgets, idle/orphan cleanup | load test S6 |
| T10 | R | Admin denies destructive action | hash-chained append-only audit, CloudTrail org trail to log-archive account (Object Lock) | audit tests |
| T11 | T | Malicious dependency or agent-introduced backdoor | pinned deps, dependency review, CodeQL/Semgrep, human review on sensitive paths, signed images | CI gates |
| T12 | I | XSS via candidate content in review UI | React escaping, `SafeMarkdown`, strict CSP with nonces, no `dangerouslySetInnerHTML` | lint + e2e |
| T13 | I | SSRF via custom domain / logo URL / webhook config | `SafeHttp` allowlist, private-IP block, no redirects | unit tests |
| T14 | I | Data kept beyond retention | S3 lifecycle + purge jobs with deletion log | retention tests |
