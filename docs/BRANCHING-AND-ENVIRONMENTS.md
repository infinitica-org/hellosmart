# Branching and environments

```
feat/CO-012-…  ─┐
fix/CA-009-…   ─┼─▶  dev  ──(auto)──▶  QA  (KVM VPS · qa.hellosmart.ai)
sec/…          ─┘     │
                      │  weekly release PR  release/YYYY-MM-DD  (QA sign-off Friday)
                      ▼
                    main ──(approval)──▶  PRODUCTION  (AWS ap-south-1 · app.hellosmart.ai)
                      ▲
hotfix/… ─────────────┘  (then back-merge main → dev)
```

## Environments
| Env | Branch | Infra | Data | Who deploys | Access |
|---|---|---|---|---|---|
| Local | any | Docker Compose (`pnpm infra:up`) | fixtures | you | you |
| QA | `dev` | KVM VPS, Docker Compose, Sysbox, LocalStack, Mailpit | fixtures (resettable) | CI on every merge | team IP allowlist + basic auth |
| Production | `main` | AWS (ECS, Aurora, EC2 workspace hosts…) | real | CI after approval on `production` environment | public |

## Weekly rhythm
| Day | What |
|---|---|
| Mon 10:00 | Release PR `dev → main` merged (after Friday sign-off) → prod deploy → smoke |
| Mon | Sprint planning |
| Tue–Wed | Build; merges to `dev` deploy to QA continuously |
| Wed 18:00 | Integration check on QA (all departments' work together) |
| Thu | QA regression on QA env |
| Fri | QA sign-off, demo, retro; release PR opened |

## Branch protection (set in GitHub → Settings → Rules)
**`main`**
- PRs only; no direct pushes, no force pushes, no deletion
- Required checks: `ci/*`, `security/*`
- 2 approvals: Architecture & Platform + QA
- Only from `release/*` or `hotfix/*`
- Linear history, signed commits required
- Deployments gated by the `production` environment (required reviewer: Architecture & Platform)

**`dev`**
- PRs only; no direct pushes, no force pushes
- Required checks: `ci/*`, `security/*`
- 1 approval from CODEOWNERS (2 for sensitive paths)
- Branch must be up to date before merge; squash merge only

## Hotfix
1. `git checkout -b hotfix/<ID>-slug origin/main`
2. Fix + test; PR to `main` (Architecture + QA approval).
3. After deploy: PR `main → dev` the same day.

## Feature flags
Work that isn't complete merges to `dev` behind a flag (default off in prod). Flags live in `app.feature_flags` per org; removing a flag is a ticket.
