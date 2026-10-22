# Data classification

| Class | Examples | Storage | Encryption | Access | Retention |
|---|---|---|---|---|---|
| **Secret** | Provider API keys, env slot secrets, OAuth/Razorpay secrets, MFA seeds | Secrets Manager / SSM SecureString | KMS CMK `hs-secrets` | ai-proxy / api roles only; never human-readable in UI (last 4 only) | Until deleted/rotated |
| **Candidate-sensitive** | Recordings, terminal logs, AI transcripts, submissions, scores, notes | S3 `hs-candidate-<env>` (org-prefixed), Aurora | KMS CMK `hs-candidate` | Owning org + platform admin (audited) | 90 days after assessment closes (configurable, BR-27) |
| **Personal** | Names, emails, IPs, consent records, user agents | Aurora | KMS CMK `hs-data` | Owning org; candidate sees own | Account life + legal hold; erasure on request |
| **Commercial** | Templates, rubrics, quotes, invoices | Aurora, S3, ECR | KMS CMK `hs-data` | Assigned org + platform | Contract life; invoices 8 years (tax) |
| **Internal** | Metrics, non-PII logs | CloudWatch | AWS-managed KMS | Engineering | 30–90 days |
| **Public** | Landing page content | S3/CloudFront | n/a | Anyone | n/a |

Rules: logs never contain Secret or Candidate-sensitive content (refs only). Lower environments never receive production data. Fixtures are synthetic.
