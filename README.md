# HelloSmart.ai

AI-native work simulation for hiring. **Hire by doing.**

| Doc | Purpose |
|---|---|
| [AGENTS.md](AGENTS.md) | Product + engineering spec (requirement IDs, business rules) |
| [docs/00-architecture-and-delivery-plan.md](docs/00-architecture-and-delivery-plan.md) | Frozen architecture, AI-SDLC, schedule |
| [CLAUDE.md](CLAUDE.md) | Operating rules for AI coding agents in this repo |
| [SECURITY.md](SECURITY.md) | Security policy, controls, reporting |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, PRs, reviews |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [docs/security/](docs/security/) | Threat model, data classification, controls matrix |
| [docs/runbooks/](docs/runbooks/) | Incident response and operations |

## Layout

```
apps/        web (Next.js) · api (NestJS) · worker (NestJS jobs + orchestrator)
services/    ai-proxy (FastAPI) · reviewer (FastAPI) · ws-agent · ws-gateway
packages/    contracts · ui · fixtures · adapters · config
templates/   assessment template manifests, images, golden submissions
infra/       terraform (all AWS accounts) · packer (workspace host AMI)
tests/       e2e (Playwright) · load (k6) · injection · security
tasks/       one brief per ticket (AI-SDLC stage 2)
```

## Local setup

```bash
nvm use && corepack enable
pnpm install
cp .env.example .env          # local placeholders only
pnpm infra:up                 # postgres, redis, localstack, mailpit, mock API
pnpm db:migrate && pnpm db:seed
pnpm dev
```

Python services: `cd services/ai-proxy && uv sync && uv run pytest`.

All external providers default to **fake adapters** (`*_PROVIDER=fake`); no cloud credentials are needed for development.
