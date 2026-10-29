# QA Environment on AWS EC2

The `dev` branch deploys here automatically. QA tests here Thu–Fri every sprint. Everything runs in AWS (`ap-south-1`). Production runs on AWS (`main`).

## Why an AWS EC2 Host for QA
- Runs the complete stack with Docker Compose and Sysbox runtime on an Ubuntu 24.04 EC2 instance.
- Kernel virtualization gives identical runtime behavior to production EC2 workspace hosts.
- AWS-only services (S3, SQS, Secrets Manager, SES, EventBridge, Step Functions) run on **LocalStack**; email goes to **Mailpit**. Same adapters as prod, different endpoints.

## Minimum EC2 Instance Spec
| | Minimum | Recommended |
|---|---|---|
| Instance Type | `c6i.2xlarge` | `c6i.4xlarge` / `m7i.2xlarge` |
| vCPU | 8 | 16 |
| RAM | 16 GB | 32 GB |
| Disk | 160 GB GP3 | 300 GB GP3 |
| OS | Ubuntu 24.04 LTS | same |
| Network | Elastic IP (IPv4) | + IPv6 |

32 GB fits the complete platform stack + ~4 concurrent workspace slots for QA.

## DNS
Point these to the Elastic IP (A records):
`qa.hellosmart.ai`, `api.qa.hellosmart.ai`, `ws.qa.hellosmart.ai`, `mail.qa.hellosmart.ai`

## One-time Setup (Architecture & Platform)
```bash
# as root on a fresh Ubuntu 24.04 EC2 instance
curl -fsSLO https://raw.githubusercontent.com/infinitica-org/hellosmart/dev/infra/qa-vps/bootstrap.sh
less bootstrap.sh           # read it first
bash bootstrap.sh
```
Then:
1. Add the deploy public key to `/home/deploy/.ssh/authorized_keys` (bootstrap prints where).
2. Create `/srv/hellosmart/.env.qa` from `env.qa.example` (secrets only on the box, mode 600).
3. In GitHub → Settings → Environments → `qa`: add secrets `QA_SSH_HOST`, `QA_SSH_USER`, `QA_SSH_KEY`, `QA_SSH_KNOWN_HOSTS`.

## Access Control
- `qa.hellosmart.ai` is behind **basic auth + IP allowlist** in Caddy (team office/VPN IPs). Never public.
- SSH: key-only, no root login, port changed, fail2ban, `deploy` user can only run `docker compose` in `/srv/hellosmart`.
- QA data is synthetic only (`@hs/fixtures`). **Never copy production data to QA.**

## Reset QA Data
`ssh deploy@qa 'cd /srv/hellosmart && ./qa.sh reset'` → drops DB, re-runs migrations + seed.
