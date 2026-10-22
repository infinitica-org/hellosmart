# Architecture Decision Records

Format: `NNNN-title.md` with Status / Context / Decision / Consequences. New ADR for any change to frozen decisions, contracts (breaking) or security controls. Owner: Architecture & Platform.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-modular-monolith-and-services.md) | NestJS modular monolith + Python AI services | Accepted |
| [0002](0002-tenancy-rls.md) | Tenant isolation via Postgres RLS + app scoping | Accepted |
| [0003](0003-shared-host-sysbox-workspaces.md) | Shared EC2 hosts with Sysbox slots for workspaces | Accepted |
| [0004](0004-contract-first.md) | Contract-first development with mocks and fakes | Accepted |
| [0005](0005-auth-in-house.md) | In-house auth (argon2id, TOTP, OAuth) instead of Cognito | Accepted |
| [0006](0006-aws-multi-account.md) | AWS multi-account with SCP guardrails, ap-south-1 | Accepted |
| [0007](0007-supply-chain.md) | Supply chain: pinned deps, SHA-pinned actions, signed images, SBOM | Accepted |
| [0008](0008-ai-sdlc.md) | AI-agent-driven SDLC with human gates | Accepted |
