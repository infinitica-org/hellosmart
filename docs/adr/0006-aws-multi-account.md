# 0006: AWS multi-account with SCP guardrails

**Status:** Accepted · 2026-10-22

## Decision
Accounts: `management`, `security` (log archive + GuardDuty/Security Hub admin), `shared`, `dev`, `staging`, `prod`, `workspaces-staging`, `workspaces-prod`. Region ap-south-1, DR backups ap-south-2. Human access via IAM Identity Center only (MFA). SCPs (in `infra/terraform/modules/org-baseline`) deny other regions, root use, IAM users/keys, disabling security services, non-IMDSv2 instances and unencrypted S3 writes. The workspaces OU additionally denies data services.

## Consequences
+ A compromised candidate slot or workload account has a small blast radius.
− More Terraform up front (S0).
