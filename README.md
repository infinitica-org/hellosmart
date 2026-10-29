# HelloSmart.ai

> **Hire by doing.** An AI-native work-simulation platform for hiring.
> Proprietary and confidential: see [LICENSE](LICENSE).

**Launch: Saturday 12 December 2026 · full MMP scope · AWS production.**

---

## 1. What we are building (read this first)

Companies stop asking candidates to solve puzzles. Instead, a candidate **does a real piece of work with real AI tools** (Claude Code, Codex, an AI chat) in a controlled workspace HelloSmart provides. Independent **AI reviewer agents** then read everything the candidate did and score it against **the company's own rubric**, citing evidence for every score. **A human at the company always makes the final decision.**

### The core loop

```
 HelloSmart builds a private TEMPLATE for a company
        │
 Company creates an ASSESSMENT from it (name, AI rules, timing, rubric)
        │
 Company adds CANDIDATES → they get an email invite
        │
 Candidate reads the brief, accepts consent, clicks Connect
        │
 WORKSPACE: a real Linux machine in the browser (Cloud) or an AI chat with files (Chat)
   · every command, file change and AI message is recorded · work autosaves every 15 s
        │
 Candidate submits (or time runs out → auto-submit)
        │
 REVIEWER AGENTS: one independent AI agent per rubric item, each must cite evidence
        │
 Company reviews, overrides if needed, finalizes → optionally releases results to the candidate
```

### Who uses it
| Role | What they do | Portal |
|---|---|---|
| **Platform admin** (HelloSmart staff) | Creates companies, sets trial limits, builds templates, runs agents, billing | Admin console |
| **Company admin** | Creates assessments, adds candidates, reviews and scores, pays | Company portal |
| **Candidate** | Does the assessment, sees results if released | Candidate portal |
| **Reviewer agents** | System actors that score submissions | none |

Everyone logs in at **one URL**; the server sends them to the right portal by role.

### How we sell (affects the product)
No public sign-up. A prospect books a meeting (cal.com), HelloSmart provisions the company with a trial (X templates, Y candidates, Z days), builds **private** templates for them, and bills via **Razorpay** (quotes, payment links, subscriptions, GST invoices). Custom domain and white label are paid add-ons.

### Key terms
**Org** = a customer company (tenant) · **Template** = versioned task blueprint, private per org · **Assessment** = an org's configured copy of a template · **Assignment** = a candidate on an assessment · **Workspace / slot** = one candidate's isolated environment · **Rubric item** = one scoring dimension = one reviewer agent · **AI proxy** = the only path workspaces use to reach LLMs (keys never leave it).

Full glossary and every requirement: **[AGENTS.md](AGENTS.md)**.

---

## 2. Documents (in reading order)

| # | Doc | Why |
|---|---|---|
| 1 | [docs/ONBOARDING.md](docs/ONBOARDING.md) | Day-one setup and first ticket |
| 2 | [AGENTS.md](AGENTS.md) | The spec: 150 requirements, business rules (BR-xx), flows |
| 3 | [docs/00-architecture-and-delivery-plan.md](docs/00-architecture-and-delivery-plan.md) | Architecture, AI-SDLC, schedule, departments |
| 4 | [docs/BRANCHING-AND-ENVIRONMENTS.md](docs/BRANCHING-AND-ENVIRONMENTS.md) | `feature → dev (QA AWS EC2) → main (AWS prod)` |
| 5 | [CONTRIBUTING.md](CONTRIBUTING.md) | How we work with AI agents, PRs, reviews |
| 6 | [CLAUDE.md](CLAUDE.md) | Rules every AI coding agent follows |
| 7 | [SECURITY.md](SECURITY.md) + [docs/security/](docs/security/) | Security policy, threat model, data classes |
| 8 | [docs/TEAM.md](docs/TEAM.md) | Departments, ownership, who reviews what |
| 9 | [docs/adr/](docs/adr/) | Why we chose what we chose |
| 10 | [docs/runbooks/](docs/runbooks/) | Incidents and operations |
| 11 | [zoho/README.md](zoho/README.md) | Backlog import for Zoho Sprints |

---

## 3. Architecture at a glance

```
Browser ─▶ CloudFront + WAF ─▶ web (Next.js) ─▶ api (NestJS) ─▶ Aurora Postgres (RLS per org)
                                                   │             Redis · S3 · SQS · Step Functions
                                                   ├─▶ worker (jobs + workspace orchestrator)
                                                   │        └─▶ shared EC2 hosts, 1 Sysbox slot per candidate
Workspace slot ─▶ ai-proxy (FastAPI) ─▶ Anthropic / OpenAI / Bedrock   (keys only in the proxy)
Submission ─▶ reviewer (FastAPI) ─▶ sanitizer ─▶ N independent agents ─▶ validator ─▶ aggregator
```

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React, Tailwind, shadcn/ui, TanStack Query |
| API + jobs | NestJS (TypeScript, Fastify), Drizzle ORM, Zod |
| AI services | Python 3.12, FastAPI |
| Data | Aurora PostgreSQL 16 + Row-Level Security, ElastiCache Redis, S3 |
| Async | SQS, EventBridge Scheduler, Step Functions |
| Workspaces | EC2 hosts + Sysbox containers, code-server, Claude Code / Codex |
| Infra | AWS ap-south-1, Terraform, Packer, GitHub Actions (OIDC) |
| QA env | AWS EC2 (ap-south-1), Docker Compose, LocalStack, Mailpit |

---

## 4. Repository map

```
apps/
  web/          Next.js: (landing) (auth) (company) (candidate) (admin)
  api/          NestJS modular monolith: auth, tenancy, orgs, assessments, candidates, billing …
  worker/       NestJS: queues, schedules, workspace orchestrator
services/
  ai-proxy/     FastAPI: the only route to LLMs; policy, caps, logging
  reviewer/     FastAPI: evidence → sanitizer → agents → validator → aggregator
  ws-agent/     inside each workspace slot: autosave, recording, heartbeat
  ws-gateway/   authenticated proxy from browser to a slot
packages/
  contracts/    OpenAPI, DB migrations, event schemas: what every team builds against
  adapters/     interfaces + fake/real implementations (payments, email, LLM, runtime, secrets)
  fixtures/     synthetic seed data (two orgs, every state)
  ui/           design system
  config/       shared lint/ts/prettier + security lint rules
templates/      assessment templates (manifest, image, seed, golden submissions)
infra/
  terraform/    AWS (all accounts)        packer/   workspace host image
  qa-vps/       QA environment            ci/       GitHub workflow sources
tests/          e2e · load · injection · security
tasks/          one brief per ticket
zoho/           Zoho Sprints import (epics, stories, backlog)
docs/           plan, ADRs, security, runbooks, onboarding
```

---

## 5. Quick start

```bash
nvm use && corepack enable
pnpm install
cp .env.example .env          # local placeholders only, never real secrets
pnpm infra:up                 # postgres, redis, localstack, mailpit, mock API (:4010)
pnpm db:migrate && pnpm db:seed
pnpm dev                      # web :3000 · api :4000
```
Python: `cd services/ai-proxy && uv sync && uv run pytest`.
All external providers default to **fakes**, so you need no cloud credentials to build anything.

### Inspect invitation emails locally (Mailpit)

Mailpit is included in `docker-compose.yml` and captures development invitation emails without sending them to real recipients.

1. Start the local infrastructure with `pnpm infra:up` (or `docker compose up -d mailpit`).
2. Open the Mailpit inbox at **http://localhost:8025**.
3. Create/send an invitation from the app. In development, the invitation email should appear in the inbox addressed to the invited student, with an **Activate Account & Set Password** link.
4. Open the message in Mailpit and use its link to test the invitation flow. Invitation links are single-use and expire after 72 hours.

Mailpit's SMTP port is `1025`; its web inbox is bound to `127.0.0.1:8025` by the local Compose configuration. If an email does not appear, check that the Mailpit container is running and review the API logs for a `[Mailpit]` warning.

---

## 6. Environments

| Branch | Environment | Where | Deploys |
|---|---|---|---|
| `feat/*`, `fix/*` | Local + PR checks | Your machine / CI | n/a |
| `dev` | **QA** | AWS EC2 · `qa.hellosmart.ai` (allowlisted) | Automatically on merge |
| `main` | **Production** | AWS ap-south-1 · `app.hellosmart.ai` | Monday release, approval required |

Details: [docs/BRANCHING-AND-ENVIRONMENTS.md](docs/BRANCHING-AND-ENVIRONMENTS.md).

---

## 7. Non-negotiables

1. **Tenant isolation:** one company can never see another's data (BR-01). Every endpoint has a cross-tenant test.
2. **No secrets** anywhere in code, logs, fixtures or workspaces.
3. **Server enforces** permissions, limits and timing. UI checks are cosmetic.
4. **Candidate content is hostile.** Validate it, sandbox it, sanitize it before graders.
5. **Humans decide.** Agent scores are evidence; nothing auto-rejects a candidate.
6. **Build only MMP scope.** Phase 2/3 = extension points only.

---

## 8. Help
- Product questions: Product Delivery
- Architecture, infra, security: Architecture & Platform
- Security issue: **security@hellosmart.ai** (see [SECURITY.md](SECURITY.md)); never post it in a public channel
