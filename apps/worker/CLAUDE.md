# apps/worker: NestJS jobs + workspace orchestrator (Candidate & Workspace dept)

Consumes SQS queues and EventBridge schedules. Event envelope: `packages/contracts/events`.

## Rules
- **Idempotent:** every handler dedupes on `dedupeId` (Redis SETNX, 7-day TTL) before side effects.
- **Tenant-scoped:** every handler runs inside `withOrg(event.orgId)`.
- Poison messages → DLQ after 5 attempts; DLQ depth alarms page on-call.
- Jobs: auto-submit at deadline (+1-min sweeper), idle/orphan cleanup, retention purge (logs each deletion), reminders, dunning, trial expiry, bulk import, emails.

## Orchestrator (`src/orchestrator/`) security
- Talks to the workspaces account only via the `hs-orchestrator` cross-account role (STS, 15-min sessions).
- Slot creation: Sysbox runtime, non-root user, read-only template image layers, per-slot netns, egress allowlist, cgroup limits from the manifest size, no host mounts except the slot's quota'd volume.
- Session env injected from SSM SecureString scoped to `/ws/{orgId}/{workspaceId}/*`, deleted at end.
- Destroy = snapshot to S3 first, then remove container + volume, then audit entry (BR-22).
