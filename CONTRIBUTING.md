# Contributing to HelloSmart

By contributing you agree your work is owned by the Company under [LICENSE](LICENSE) and your employment/contract agreement.

## 1. How we work: AI-agent-driven development
Engineers **direct AI coding agents**; agents write the code. You own the intent, the contract, the review and the result. Full process: [plan §6](docs/00-architecture-and-delivery-plan.md).

### Approved AI tools
- Claude Code, Codex, or other tools on the **company's team/enterprise plan** with training on our data disabled.
- Never paste repository code, secrets, customer data or candidate data into personal or free AI accounts, chat sites or public tools.
- Agents must run with the repo's `.claude/settings.json` guardrails. Never disable them.

## 2. The flow for every ticket

```
Zoho item (has requirement ID)
  → tasks/<ID>.md brief (/new-task), dept lead approves
  → branch from dev: feat/<ID>-slug  (one agent per git worktree)
  → agent builds against packages/contracts + fakes
  → agent self-verifies (tests, /security-check)
  → PR into dev → CI + AI review + human review (CODEOWNERS)
  → squash-merge → auto-deploy to QA VPS
  → QA verifies on qa.hellosmart.ai → Zoho item "Done"
  → weekly release PR dev → main → AWS prod (Monday)
```

### Branches
| Prefix | Use | Base | Merges into |
|---|---|---|---|
| `feat/<ID>-slug` | new requirement work | `dev` | `dev` |
| `fix/<ID>-slug` | bug fix | `dev` | `dev` |
| `sec/<ID>-slug` | security fix | `dev` | `dev` |
| `contract/<topic>` | contract change (Architecture only) | `dev` | `dev` |
| `chore/<topic>` | tooling, docs | `dev` | `dev` |
| `hotfix/<ID>-slug` | urgent prod fix | `main` | `main`, then back-merge to `dev` |
| `release/YYYY-MM-DD` | weekly release PR | `dev` | `main` |

**Never commit directly to `dev` or `main`.** Both are protected.

### Parallel agents
```bash
git fetch origin && git worktree add ../.worktrees/CO-012 -b feat/CO-012-bulk-upload origin/dev
cd ../.worktrees/CO-012 && claude    # one agent, one ticket, one worktree
```

## 3. Commits and PRs
- Conventional Commits with requirement ID: `feat(CO-012): bulk upload candidates`, `test(BR-01): cross-tenant candidates`, `fix(CA-009): resume overlay focus`.
- PR title = the main commit. PR ≤ ~600 changed lines; split bigger work.
- Fill the PR template fully, including the acceptance-evidence table.
- Link the Zoho item ID in the PR description.

## 4. Review rules
| Change | Approvals |
|---|---|
| Normal | 1 from the owning department (CODEOWNERS) + AI review resolved |
| Sensitive paths (auth, tenancy, rbac, billing, ai-proxy, sanitizer, orchestrator, ws-gateway, migrations, infra) | + 1 from Architecture & Platform |
| `contract/*` | Architecture & Platform + every affected department notified |
| Release `dev → main` | Architecture & Platform + QA sign-off |

Reviewers check: does it meet every acceptance criterion, does it touch only allowed paths, are tenancy/RBAC/audit tests present, any secrets or new dependencies.

## 5. Quality gates (CI must be green)
typecheck · lint · unit · integration · cross-tenant suite · contract check · gitleaks · CodeQL · Semgrep · Trivy · Checkov · dependency review · e2e smoke.
**Never** bypass with `--no-verify`, skipped tests or disabled rules.

## 6. Dependencies and licences
New dependency = note in PR (why, alternatives, maintenance, licence). Allowed licences: MIT, Apache-2.0, BSD-2/3, ISC, MPL-2.0, Python-2.0, 0BSD, Unlicense. **Blocked:** GPL, AGPL, LGPL (without approval), SSPL, BUSL, Commons Clause, unlicensed.

## 7. Data rules
- Fixtures are synthetic only (`@example.test` emails).
- No production data outside production. QA uses fixtures.
- Screenshots in tickets must not show real candidate data.

## 8. Definition of done
Acceptance criteria proven by tests · CI green · reviewed · deployed to QA · QA verified · Zoho item updated · docs/ADR updated if behaviour or architecture changed.

## 9. Conduct
See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
