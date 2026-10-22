## Requirement
<!-- e.g. CO-012 · tasks/CO-012.md -->

## What changed

## Acceptance evidence
| Acceptance criterion | Test / proof |
|---|---|
| | |

## Checklist
- [ ] Only my department's paths changed (or contract request linked)
- [ ] typecheck, lint, unit, integration pass
- [ ] Cross-tenant test added for every new endpoint (BR-01)
- [ ] RBAC denial tests for other roles (BR-25)
- [ ] Audit entry for BR-31 actions
- [ ] No secrets in code, logs, fixtures, snapshots
- [ ] `/security-check` run; high/critical findings fixed
- [ ] New dependencies justified below (or none)
- [ ] Feature flag for incomplete work
- [ ] Migration reviewed for `org_id`, index, RLS (if any)

## New dependencies / risks
