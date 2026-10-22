# Contributing

We build with AI coding agents under the AI-SDLC in [docs/00-architecture-and-delivery-plan.md §6](docs/00-architecture-and-delivery-plan.md). Humans own intent, contracts, review and acceptance.

## Flow
1. Pick a Zoho Sprints item. It must carry a requirement ID (`CO-`, `CA-`, `AD-`, `SP-`, `NF-`, `BR-`).
2. Write `tasks/<ID>.md` from [tasks/_TEMPLATE.md](tasks/_TEMPLATE.md); department lead approves.
3. Branch `feat/<ID>-short-slug` (or `fix/`, `chore/`, `sec/`). One agent per git worktree: `git worktree add ../.worktrees/<ID> -b feat/<ID>-slug`.
4. Build against `packages/contracts` only. Need a contract change? Open a `contract:` PR; Architecture answers within 4 working hours.
5. PR ≤ ~600 changed lines, title `feat(CO-012): bulk upload candidates`. Fill the PR template including the acceptance evidence.
6. CI green + AI review resolved + CODEOWNERS approval. Sensitive paths need Architecture & Platform too.
7. Squash-merge to `main` (trunk). Feature flags keep incomplete work dark.

## Commits
Conventional Commits with requirement ID: `feat(CA-008): force full screen on cloud connect`.

## Never
- Commit secrets, real keys or real candidate data (fixtures are synthetic).
- Edit another department's paths directly; open a contract/request instead.
- Skip hooks (`--no-verify`) or disable a CI gate.
- Merge with an unresolved high/critical security finding.
