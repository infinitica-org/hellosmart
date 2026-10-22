"""Generates Zoho Sprints import files from AGENTS.md + the plan.

    py zoho/tools/build_backlog.py      (or python3)

Outputs (UTF-8 with BOM so Excel/Zoho read it correctly):
    zoho/epics.csv     zoho/sprints.csv     zoho/backlog.csv
Every requirement in AGENTS.md §9 becomes one Story; engineering/QA/security work that the
spec doesn't list becomes Tasks. Re-run after AGENTS.md changes; IDs are stable.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "zoho"

SEATS = {
    "ARCH": "System Architect",
    "BE": "Backend Engineer",
    "SDE1": "SDE-1",
    "SDE2": "SDE-2",
    "AI1": "AI Engineer-1",
    "AI2": "AI Engineer-2",
    "DO": "Data Ops Engineer",
    "QA1": "QA-1",
    "QA2": "QA-2",
}

EPICS = [
    ("EP-01", "Platform & DevOps", "ARCH", "AWS accounts, Terraform, QA VPS, CI/CD, observability, releases"),
    ("EP-02", "Security & Compliance", "ARCH", "Tenant isolation, secrets, sandboxing, audit, retention, consent, pen-test"),
    ("EP-03", "Identity & Access", "BE", "Login, SSO, MFA, master login, RBAC, password flows"),
    ("EP-04", "Org, Trial & Entitlements", "BE", "Org provisioning, trial X/Y/Z, caps, suspend, support tools"),
    ("EP-05", "Templates & Assessments", "SDE1", "Template manifest/versions/assignment, assessment builder, timing, rubric"),
    ("EP-06", "Candidate Management", "SDE1", "Candidate CRUD, bulk upload, invites, assignment"),
    ("EP-07", "Candidate Portal", "SDE2", "Dashboard, pre-flight, consent, timing UX, submit, results"),
    ("EP-08", "Workspaces", "SDE2", "Shared-host Sysbox slots, connect/resume, autosave, destroy, cleanup"),
    ("EP-09", "AI Proxy, Keys & Chat", "AI1", "AI proxy, provider keys, caps, Chat workspace, platform key allocation"),
    ("EP-10", "Review & Results", "AI2", "Reviewer agents, pipeline, human review, finalize, release"),
    ("EP-11", "Billing & Payments", "BE", "Plans, quotes, Razorpay, subscriptions, codes, GST invoices"),
    ("EP-12", "Sales, Landing & Leads", "SDE1", "Landing, cal.com, leads, deal pipeline, provisioning"),
    ("EP-13", "Analytics", "SDE1", "Assessment, org and platform analytics"),
    ("EP-14", "Settings, Branding & Domains", "SDE1", "Settings, logo, Powered-by, white label, custom domain, email templates"),
    ("EP-15", "Template Content", "DO", "Launch catalog of 10 templates, golden submissions, injection corpus"),
    ("EP-16", "Quality & Release", "QA1", "Test plans, regression, load, security testing, UAT, go-live"),
]

SPRINTS = [
    ("S0", "S0 Foundation", "2026-10-23", "2026-10-30", "Accounts, IaC, CI/CD, contracts frozen, mocks, fakes, design system, slot spike"),
    ("S1", "S1 Identity & Tenancy", "2026-11-02", "2026-11-06", "Auth, RBAC, tenancy, orgs, entitlements, audit, landing"),
    ("S2", "S2 Configure", "2026-11-09", "2026-11-13", "Templates, assessments, timing, AI keys/policy, candidates, quotes"),
    ("S3", "S3 Candidate Session", "2026-11-16", "2026-11-20", "Candidate portal, consent, workspaces, AI assistant, Chat; first E2E 19 Nov"),
    ("S4", "S4 Submit & Review", "2026-11-23", "2026-11-27", "Submit, cleanup, review pipeline, human review, release"),
    ("S5", "S5 Commercial & Ops", "2026-11-30", "2026-12-04", "Payments, domains, white label, analytics, retention; feature complete"),
    ("S6", "S6 Harden & Launch", "2026-12-07", "2026-12-11", "Bug fixes, load, security, DR, UAT; go/no-go 10 Dec; launch 12 Dec"),
    ("P2", "Backlog: Phase 2", "", "", "Not in MMP. Do not start without product sign-off"),
    ("P3", "Backlog: Phase 3", "", "", "Not in MMP"),
]

# requirement ID -> (epic, sprint, owner seat, supporting seats, points override)
R: dict[str, tuple[str, str, str, str, int | None]] = {}


def r(ids: str, epic: str, sprint: str, owner: str, support: str = "", pts: int | None = None) -> None:
    for i in ids.split():
        R[i] = (epic, sprint, owner, support, pts)


# Company
r("CO-001", "EP-03", "S1", "BE", "SDE1", 8)
r("CO-002 CO-003", "EP-03", "S1", "BE", "SDE1")
r("CO-004", "EP-03", "S1", "BE", "SDE1")
r("CO-005", "EP-04", "S1", "BE", "SDE1")
r("CO-006", "EP-04", "S2", "SDE1", "BE", 3)
r("CO-007", "EP-03", "P2", "BE")
r("CO-008 CO-009", "EP-04", "S1", "BE", "SDE1", 8)
r("CO-010", "EP-04", "S5", "BE")
r("CO-011", "EP-06", "S2", "BE", "SDE1")
r("CO-012", "EP-06", "S2", "SDE1", "BE", 8)
r("CO-013", "EP-06", "S2", "BE", "SDE1")
r("CO-014 CO-015", "EP-06", "S2", "SDE1", "BE")
r("CO-016", "EP-06", "S4", "SDE2", "BE")
r("CO-017", "EP-06", "S2", "SDE1", "BE")
r("CO-018 CO-019", "EP-05", "S2", "SDE1", "BE")
r("CO-020 CO-021 CO-022", "EP-05", "S2", "SDE1", "BE")
r("CO-023", "EP-05", "S2", "AI1", "SDE1")
r("CO-024", "EP-05", "S3", "SDE2", "SDE1", 8)
r("CO-025 CO-026", "EP-05", "S3", "SDE1", "BE")
r("CO-027", "EP-05", "P2", "SDE1")
r("CO-028 CO-029 CO-030", "EP-05", "S2", "SDE2", "BE")
r("CO-031", "EP-05", "S4", "SDE2", "BE")
r("CO-032", "EP-09", "S2", "AI1", "SDE1 BE", 8)
r("CO-033 CO-034 CO-035", "EP-09", "S2", "AI1", "SDE1")
r("CO-036", "EP-09", "P2", "AI1")
r("CO-037", "EP-09", "S5", "AI1", "SDE1")
r("CO-038 CO-039", "EP-10", "S2", "AI2", "SDE1", 8)
r("CO-040", "EP-10", "P2", "AI2")
r("CO-041 CO-042", "EP-10", "S4", "AI2", "SDE1", 8)
r("CO-043 CO-044", "EP-08", "S4", "SDE2", "SDE1")
r("CO-045 CO-046 CO-047 CO-048", "EP-10", "S4", "AI2", "SDE1")
r("CO-049 CO-050", "EP-10", "P2", "SDE1")
r("CO-051 CO-052", "EP-13", "S5", "DO", "SDE1")
r("CO-053", "EP-14", "S5", "SDE1")
r("CO-054 CO-055", "EP-14", "S5", "SDE1", "BE")
r("CO-056", "EP-11", "S5", "SDE1", "BE")
r("CO-057", "EP-02", "P2", "BE")
r("CO-058", "EP-12", "P3", "BE")
# Candidate
r("CA-001 CA-002 CA-003", "EP-03", "S1", "BE", "SDE2")
r("CA-004 CA-005 CA-006", "EP-07", "S3", "SDE2", "BE")
r("CA-007", "EP-07", "S3", "SDE2", "BE")
r("CA-008 CA-009", "EP-08", "S3", "SDE2", "ARCH", 8)
r("CA-010 CA-011", "EP-08", "S3", "SDE2", "ARCH", 8)
r("CA-012 CA-013", "EP-07", "S3", "SDE2", "BE")
r("CA-014", "EP-08", "P2", "SDE2")
r("CA-015", "EP-09", "S3", "AI1", "SDE2", 8)
r("CA-016", "EP-08", "P2", "SDE2")
r("CA-017", "EP-09", "S3", "AI1", "SDE2")
r("CA-018", "EP-07", "S4", "SDE2", "BE")
r("CA-019", "EP-07", "S4", "SDE2", "BE")
r("CA-020", "EP-07", "S4", "SDE2", "BE")
r("CA-021 CA-022 CA-023", "EP-07", "P2", "SDE2")
# Admin
r("AD-001", "EP-03", "S1", "BE", "SDE1", 8)
r("AD-002 AD-003 AD-004", "EP-04", "S1", "BE", "SDE1")
r("AD-005", "EP-04", "P2", "BE")
r("AD-006 AD-007", "EP-04", "S1", "BE", "SDE1")
r("AD-008 AD-009", "EP-11", "S2", "BE", "SDE1")
r("AD-010", "EP-05", "S2", "BE", "SDE1 DO", 8)
r("AD-011", "EP-05", "S1", "BE")
r("AD-012", "EP-05", "S2", "DO", "SDE1")
r("AD-013", "EP-05", "S2", "DO", "ARCH", 8)
r("AD-014", "EP-10", "S2", "AI2", "SDE1")
r("AD-015", "EP-10", "S5", "AI2", "SDE1")
r("AD-016", "EP-10", "P2", "AI2")
r("AD-017", "EP-10", "S4", "AI2", "DO", 8)
r("AD-018", "EP-08", "S3", "SDE2", "SDE1")
r("AD-019", "EP-08", "S4", "SDE2", "ARCH")
r("AD-020", "EP-08", "P2", "SDE2")
r("AD-021", "EP-14", "S5", "ARCH", "BE SDE1", 8)
r("AD-022", "EP-14", "S5", "SDE1", "BE")
r("AD-023", "EP-09", "S4", "AI1", "SDE1")
r("AD-024", "EP-09", "P2", "AI1")
r("AD-025", "EP-13", "S5", "DO", "SDE1")
r("AD-026", "EP-04", "S4", "SDE2", "BE")
r("AD-027", "EP-02", "S1", "BE", "SDE1")
r("AD-028", "EP-02", "S5", "DO", "BE")
r("AD-029", "EP-14", "S5", "SDE1", "BE")
# Sales & payments
r("SP-001", "EP-12", "S1", "SDE1")
r("SP-002 SP-003", "EP-12", "S1", "AI1", "SDE1")
r("SP-004", "EP-12", "S5", "SDE1", "BE")
r("SP-005", "EP-12", "S1", "BE", "SDE1")
r("SP-006", "EP-12", "S2", "DO", "BE")
r("SP-007 SP-008", "EP-14", "S5", "BE", "SDE1")
r("SP-009 SP-010", "EP-11", "S2", "BE", "SDE1", 8)
r("SP-011 SP-012 SP-014", "EP-11", "S5", "SDE1", "BE")
r("SP-013", "EP-11", "S5", "BE", "SDE1", 8)
r("SP-015", "EP-11", "S5", "AI1", "SDE1")
r("SP-016 SP-017", "EP-11", "S5", "AI1", "BE")
r("SP-018", "EP-11", "S5", "BE", "ARCH", 8)
r("SP-019 SP-020 SP-021", "EP-11", "P2", "BE")
r("SP-022", "EP-01", "P3", "ARCH")
# Non-functional
r("NF-001", "EP-02", "S1", "ARCH", "BE", 8)
r("NF-002 NF-003", "EP-02", "S0", "ARCH")
r("NF-004", "EP-02", "S3", "ARCH", "SDE2", 8)
r("NF-005", "EP-09", "S3", "AI1", "ARCH")
r("NF-006", "EP-02", "S1", "BE", "ARCH")
r("NF-007", "EP-02", "S3", "BE", "SDE2")
r("NF-008", "EP-10", "S4", "AI2", "SDE1")
r("NF-009 NF-010", "EP-02", "P3", "ARCH")
r("NF-011", "EP-08", "S3", "SDE2", "ARCH")
r("NF-012", "EP-01", "S6", "ARCH")
r("NF-013", "EP-08", "S3", "SDE2")
r("NF-014", "EP-08", "S4", "SDE2", "ARCH")
r("NF-015", "EP-01", "S2", "ARCH")
r("NF-016", "EP-16", "P2", "QA1")
r("NF-017", "EP-01", "S2", "ARCH", "BE")
r("NF-018", "EP-05", "S1", "ARCH", "DO")

# Tasks not in AGENTS.md (engineering, content, QA). (id, title, epic, sprint, owner, support, pts, description)
TASKS = [
    # S0 foundation
    ("T-001", "AWS Organization, accounts, IAM Identity Center, SCP baseline", "EP-01", "S0", "ARCH", "", 8, "Apply infra/terraform/modules/org-baseline. Accounts: management, security, shared, prod, workspaces-prod."),
    ("T-002", "Terraform state backend + GitHub OIDC roles", "EP-01", "S0", "ARCH", "", 3, "S3+KMS state, DynamoDB lock, CI roles: build, deploy-prod, plan-only."),
    ("T-003", "Prod network: VPC 3 AZ, endpoints, NAT, flow logs", "EP-01", "S0", "ARCH", "", 5, "modules/network."),
    ("T-004", "Prod data: Aurora PG16, Redis, S3 buckets, KMS keys", "EP-01", "S0", "ARCH", "BE", 5, "modules/data + modules/secrets. RLS-ready roles."),
    ("T-005", "QA VPS bootstrap + Caddy + allowlist + deploy pipeline", "EP-01", "S0", "ARCH", "QA2", 5, "infra/qa-vps. dev branch auto-deploys."),
    ("T-006", "GitHub: branch protection main/dev, environments qa/production, teams, CODEOWNERS", "EP-01", "S0", "ARCH", "", 2, "See docs/BRANCHING-AND-ENVIRONMENTS.md."),
    ("T-007", "Install workflows from infra/ci and pin actions to SHAs", "EP-01", "S0", "ARCH", "", 2, "ADR-0007."),
    ("T-008", "Dockerfiles for web, api, worker, ai-proxy, reviewer, ws-gateway", "EP-01", "S0", "ARCH", "BE AI1", 3, "Non-root, distroless/minimal, healthchecks."),
    ("T-009", "Freeze contracts: full OpenAPI (AGENTS §13), DB schema, events, route map", "EP-01", "S0", "ARCH", "BE SDE1 SDE2 AI1 AI2", 8, "Freeze Fri 30 Oct. Mock server serves it."),
    ("T-010", "Fake adapters: payment, email, LLM, workspace runtime, secrets", "EP-01", "S0", "BE", "AI1 SDE2", 5, "packages/adapters. Fakes forbidden in prod."),
    ("T-011", "Fixtures package: two orgs, every state, synthetic submissions", "EP-15", "S0", "DO", "BE", 5, "packages/fixtures + pnpm db:seed."),
    ("T-012", "Next.js app shell, route groups, middleware, API client from contracts", "EP-05", "S0", "SDE1", "SDE2", 5, ""),
    ("T-013", "Design system in code (@hs/ui) from Figma tokens", "EP-14", "S0", "SDE1", "", 5, "BrandMark, SafeMarkdown, forms, timer."),
    ("T-014", "NestJS skeleton: guards, withOrg, problem+json, logger redaction, idempotency", "EP-03", "S0", "BE", "ARCH", 5, ""),
    ("T-015", "FastAPI skeletons: ai-proxy + reviewer, CI, typed config", "EP-09", "S0", "AI1", "AI2", 3, ""),
    ("T-016", "Workspace spike: 4 medium Sysbox slots on one host, isolation + start time", "EP-08", "S0", "SDE2", "ARCH", 8, "Go/no-go by Thu 29 Oct (ADR-0003)."),
    ("T-017", "Packer host AMI with Sysbox + CIS hardening", "EP-08", "S0", "ARCH", "SDE2", 5, "infra/packer."),
    ("T-018", "Custom lint rules: require-roles-decorator, no-client-org-id", "EP-02", "S0", "ARCH", "", 3, "packages/config + .semgrep."),
    ("T-019", "Test strategy, traceability matrix (126 MMP items), Playwright + axe setup", "EP-16", "S0", "QA2", "QA1", 5, ""),
    ("T-020", "Agent library v0 design + evidence bundle format", "EP-10", "S0", "AI2", "AI1", 3, "Evidence refs: term:/diff:/ai:/file:/event:/test:."),
    # Workspace platform
    ("T-021", "Orchestrator: slot scheduler (bin-pack, AZ spread), free-slot target", "EP-08", "S3", "SDE2", "ARCH", 8, ""),
    ("T-022", "ws-gateway: ticket exchange, slot routing, WebSocket proxy", "EP-08", "S3", "SDE2", "ARCH", 8, ""),
    ("T-023", "ws-agent: 15 s git snapshot, terminal capture, heartbeat, presigned uploads", "EP-08", "S3", "SDE2", "", 5, ""),
    ("T-024", "Egress allowlist (Network Firewall) + AI-off domain block", "EP-02", "S3", "ARCH", "SDE2", 5, "BR-14."),
    ("T-025", "workspace-hosts Terraform + ASG + budgets in workspaces account", "EP-01", "S2", "ARCH", "SDE2", 5, ""),
    # AI
    ("T-026", "AI proxy: Anthropic + OpenAI compatible endpoints, streaming", "EP-09", "S2", "AI1", "", 8, "Claude Code / Codex work unmodified."),
    ("T-027", "AI proxy: atomic caps + RPM in Redis (Lua), 80% warning", "EP-09", "S3", "AI1", "", 5, "BR-15."),
    ("T-028", "Sanitizer + injection classifier", "EP-10", "S3", "AI2", "DO", 5, "BR-18."),
    ("T-029", "Agent library: 10 agents with golden-set evals", "EP-10", "S4", "AI2", "DO", 8, ""),
    ("T-030", "Review pipeline Step Functions: map, validator, aggregator, retries", "EP-10", "S4", "AI2", "ARCH", 8, "Report < 15 min."),
    # Content
    ("T-031", "Templates 1-2: Node API incident, Python service bug", "EP-15", "S2", "DO", "AI2", 8, "Golden x5 each."),
    ("T-032", "Templates 3-4: Next.js feature, REST endpoint + tests", "EP-15", "S3", "DO", "SDE1", 8, ""),
    ("T-033", "Templates 5-6: SQL + notebook, Terraform on LocalStack", "EP-15", "S3", "DO", "ARCH", 8, ""),
    ("T-034", "Templates 7-10 (Chat): PRD, market sizing, ticket triage, ops escalation", "EP-15", "S4", "DO", "AI1", 8, ""),
    ("T-035", "Prompt-injection corpus (≥100 cases) for graders", "EP-15", "S3", "DO", "AI2", 5, ""),
    # Security
    ("T-036", "Cross-tenant test harness generated from x-roles", "EP-02", "S1", "QA2", "ARCH", 5, "BR-01."),
    ("T-037", "Hash-chained append-only audit writer", "EP-02", "S1", "BE", "ARCH", 3, "BR-31."),
    ("T-038", "GuardDuty, Security Hub, Inspector, CloudTrail org trail with Object Lock", "EP-02", "S1", "ARCH", "", 3, ""),
    ("T-039", "WAF rules + rate limits; CloudFront", "EP-02", "S2", "ARCH", "", 3, ""),
    ("T-040", "Slot escape / IMDS / cross-slot network security tests", "EP-02", "S4", "QA2", "ARCH SDE2", 5, ""),
    ("T-041", "External pen-test quick scan + fixes", "EP-02", "S6", "ARCH", "QA2", 8, ""),
    ("T-042", "Observability: dashboards, alarms, on-call routing", "EP-01", "S2", "ARCH", "", 5, "NF-015."),
    ("T-043", "Backups + DR restore drill (ap-south-2)", "EP-01", "S6", "ARCH", "BE", 3, ""),
    # QA per sprint
    ("T-044", "S1 QA: auth, RBAC, route isolation, cross-tenant", "EP-16", "S1", "QA1", "QA2", 5, ""),
    ("T-045", "S2 QA: templates, assessments, candidates, bulk, invites", "EP-16", "S2", "QA2", "QA1", 5, ""),
    ("T-046", "S3 QA: first full E2E candidate loop (19 Nov)", "EP-16", "S3", "QA1", "QA2", 8, ""),
    ("T-047", "S4 QA: submit, auto-submit, review, release", "EP-16", "S4", "QA2", "QA1", 5, ""),
    ("T-048", "S5 QA: payments (Razorpay test), domains, white label, analytics, retention", "EP-16", "S5", "QA1", "QA2", 5, ""),
    ("T-049", "Full regression of all 126 MMP items", "EP-16", "S5", "QA1", "QA2", 8, "30 Nov - 4 Dec."),
    ("T-050", "Load tests: 100 workspaces, 500 portal users, proxy RPM", "EP-16", "S6", "QA2", "ARCH", 5, ""),
    ("T-051", "UAT with 2 pilot customers", "EP-16", "S6", "QA1", "SDE1", 5, ""),
    ("T-052", "Launch security checklist sign-off + go/no-go (10 Dec)", "EP-16", "S6", "ARCH", "QA1 QA2", 3, "docs/security/launch-security-checklist.md"),
    ("T-053", "Runbooks + on-call rota + hypercare plan (12-24 Dec)", "EP-01", "S6", "ARCH", "", 3, ""),
    ("T-054", "Production launch 12 Dec: flags on, landing live", "EP-16", "S6", "ARCH", "QA1", 2, ""),
]

REQ_RE = re.compile(r"^- \[ \] \*\*(?P<id>[A-Z]{2}-\d{3})\*\* (?P<title>.+?) `(?P<prio>Must|Should|Could) · (?P<phase>MMP|Phase 2|Phase 3)`")
DEFAULT_PTS = {"Must": 5, "Should": 3, "Could": 2}
ZOHO_PRIO = {"Must": "High", "Should": "Medium", "Could": "Low"}


def parse_requirements() -> list[dict[str, str]]:
    lines = (ROOT / "AGENTS.md").read_text(encoding="utf-8").splitlines()
    items: list[dict[str, str]] = []
    group = ""
    for idx, line in enumerate(lines):
        if line.startswith("#### "):
            group = line[5:].strip()
        m = REQ_RE.match(line)
        if not m:
            continue
        acc = note = ""
        for nxt in lines[idx + 1 : idx + 4]:
            if "*Acceptance:*" in nxt:
                acc = nxt.split("*Acceptance:*", 1)[1].strip()
            elif "*Note:*" in nxt:
                note = nxt.split("*Note:*", 1)[1].strip()
            elif nxt.startswith("- [ ]"):
                break
        items.append({**m.groupdict(), "group": group, "acc": acc, "note": note})
    return items


def write_csv(name: str, header: list[str], rows: list[list[object]]) -> None:
    with (OUT / name).open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main() -> None:
    reqs = parse_requirements()
    missing = [q["id"] for q in reqs if q["id"] not in R]
    if missing:
        raise SystemExit(f"unmapped requirements: {missing}")

    sprint_name = {s[0]: s[1] for s in SPRINTS}
    epic_name = {e[0]: e[1] for e in EPICS}

    write_csv("epics.csv", ["Epic ID", "Epic Name", "Owner", "Description"],
              [[e[0], f"{e[0]} {e[1]}", SEATS[e[2]], e[3]] for e in EPICS])
    write_csv("sprints.csv", ["Sprint ID", "Sprint Name", "Start Date", "End Date", "Goal"],
              [list(s) for s in SPRINTS])

    header = ["Item ID", "Item Name", "Item Type", "Epic", "Sprint", "Priority", "Story Points",
              "Owner", "Supporting", "Requirement ID", "Phase", "Tags", "Description"]
    rows: list[list[object]] = []
    for q in reqs:
        epic, sprint, owner, support, pts = R[q["id"]]
        desc = f"Requirement: {q['title']}\n\nAcceptance criteria:\n{q['acc']}"
        if q["note"]:
            desc += f"\n\nNote: {q['note']}"
        desc += ("\n\nDefinition of done: tests for every acceptance criterion, cross-tenant + RBAC tests "
                 "for new endpoints, audit for BR-31 actions, deployed to QA and verified by QA.")
        tags = [q["id"][:2], q["group"], q["prio"]]
        if sprint in ("P2", "P3"):
            tags.append("not-mmp")
        rows.append([q["id"], f"{q['id']} {q['title']}", "Story", f"{epic} {epic_name[epic]}",
                     sprint_name[sprint], ZOHO_PRIO[q["prio"]], pts or DEFAULT_PTS[q["prio"]],
                     SEATS[owner], ", ".join(SEATS[s] for s in support.split()), q["id"],
                     q["phase"], "; ".join(tags), desc])
    for tid, title, epic, sprint, owner, support, pts, desc in TASKS:
        rows.append([tid, f"{tid} {title}", "Task", f"{epic} {epic_name[epic]}", sprint_name[sprint],
                     "High", pts, SEATS[owner], ", ".join(SEATS[s] for s in support.split()), "",
                     "MMP", "engineering", desc or title])
    order = {s[0]: i for i, s in enumerate(SPRINTS)}
    inv = {v: k for k, v in sprint_name.items()}
    rows.sort(key=lambda x: (order[inv[str(x[4])]], str(x[3]), str(x[0])))
    write_csv("backlog.csv", header, rows)

    # summary for the README
    by_sprint: dict[str, list[int]] = {}
    for row in rows:
        s = inv[str(row[4])]
        by_sprint.setdefault(s, [0, 0])
        by_sprint[s][0] += 1
        by_sprint[s][1] += int(row[6])
    by_seat: dict[str, int] = {}
    for row in rows:
        if inv[str(row[4])] not in ("P2", "P3"):
            by_seat[str(row[7])] = by_seat.get(str(row[7]), 0) + int(row[6])
    print(f"stories={len(reqs)} tasks={len(TASKS)} total={len(rows)}")
    for s, (n, p) in by_sprint.items():
        print(f"  {s}: {n} items, {p} pts")
    for seat, p in sorted(by_seat.items(), key=lambda x: -x[1]):
        print(f"  {seat}: {p} pts (MMP)")


if __name__ == "__main__":
    main()
