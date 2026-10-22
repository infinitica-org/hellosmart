# Security Policy

## Reporting a vulnerability
Email **security@hellosmart.ai**. Do not open a public issue. We acknowledge within 2 business days and give a fix ETA within 5.

## Security principles
1. **Tenant isolation is non-negotiable** (BR-01): Postgres RLS + application scoping + cross-tenant tests on every endpoint.
2. **Zero secrets in code, logs, responses, workspaces or fixtures** (BR-13, BR-16). Secrets live only in AWS Secrets Manager / SSM SecureString, encrypted with KMS CMKs.
3. **Least privilege everywhere**: IAM per service, DB roles per purpose (`hs_app`, `hs_migrator`, `hs_readonly`), short-lived credentials via OIDC/IAM Identity Center. No long-lived AWS keys.
4. **Untrusted by default**: candidate code, files, AI transcripts and submissions are hostile input (BR-18). They run only in isolated workspace slots and reach graders only through the sanitizer.
5. **Defense in depth**: WAF → ALB → authN → RBAC → tenancy → RLS → audit.
6. **Everything auditable**: append-only audit log for BR-31 actions; CloudTrail org trail; immutable log archive.

## Controls (summary)
| Area | Control |
|---|---|
| Identity | argon2id, lockout + throttle, TOTP MFA mandatory for platform admins, session rotation on privilege change, secure/HttpOnly/SameSite=Lax cookies |
| AppSec | CSP with nonces, CSRF tokens on cookie-auth mutations, Zod validation at every boundary, output encoding, SSRF allowlist for outbound calls |
| Data | TLS 1.2+ everywhere, KMS encryption at rest (Aurora, S3, EBS, Redis, SQS), S3 Block Public Access, retention lifecycle |
| Workspaces | Sysbox user-namespace isolation, per-slot netns + egress allowlist, no IMDS from slots, host recycle 24 h, separate AWS account |
| AI | AI proxy is the only path; short-lived per-workspace tokens; caps + RPM; prompts logged; keys never leave the proxy process |
| Supply chain | Pinned versions, lockfiles, `ignore-scripts`, Dependabot, SBOM (Syft), image scan (Trivy), signed images (cosign), GitHub Actions pinned by SHA |
| Detection | GuardDuty, Security Hub (CIS + AWS FSBP), Inspector, VPC Flow Logs, CloudWatch alarms → on-call |
| CI gates | gitleaks, CodeQL, Semgrep, Trivy fs/config, tfsec/Checkov, dependency review, cross-tenant suite |

See [docs/security/](docs/security/) for the threat model and controls matrix.
