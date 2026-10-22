# infra/terraform (Architecture & Platform)

Terraform 1.9.x, AWS provider 5.x. State in S3 (`hs-tfstate-<account>`, KMS, versioned) with DynamoDB locking, in the `shared` account. Applied **only** from CI via OIDC roles; humans use plan-only roles. Agents may run `fmt`/`validate`, never `apply`.

## Layout
```
modules/
  org-baseline/       Organizations, OUs, SCPs, CloudTrail org trail, Config, GuardDuty, Security Hub, IAM Identity Center
  network/            VPC (3 AZ), private subnets, VPC endpoints, NAT, flow logs
  data/               Aurora PG 16 (Multi-AZ, KMS, IAM auth, PITR), ElastiCache (TLS + AUTH), S3 buckets
  compute/            ECS cluster, services, ALB, CodeDeploy blue/green, autoscaling
  edge/               CloudFront, WAF (managed rules + rate limits), ACM, Route 53
  messaging/          SQS (+DLQ), EventBridge bus + Scheduler, Step Functions
  secrets/            KMS CMKs per data class, Secrets Manager, rotation lambdas
  observability/      CloudWatch dashboards/alarms, X-Ray, SNS → on-call
  workspace-hosts/    Shared host ASG (Sysbox AMI), slot SGs, Network Firewall egress, budgets
  github-oidc/        CI roles (build, deploy-staging, deploy-prod, plan-only)
envs/
  shared/  dev/  staging/  prod/  workspaces-staging/  workspaces-prod/
```

## Guardrails
- Every resource tagged `org=hellosmart`, `env`, `owner-dept`, `data-class`.
- Checkov + tfsec + Trivy misconfig in CI; zero high/critical to merge.
- `prod` and `workspaces-prod` applies need the GitHub `prod` environment approval.
