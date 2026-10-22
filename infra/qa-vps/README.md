# QA environment on a KVM VPS

The `dev` branch deploys here automatically. QA tests here Thu–Fri every sprint. Production stays on AWS (`main`).

## Why a VPS for QA
- Cheap, always-on, one box: the whole stack runs with Docker Compose.
- KVM gives a real kernel, so **Sysbox workspace slots run exactly as on AWS hosts**.
- AWS-only services (S3, SQS, Secrets Manager, SES, EventBridge, Step Functions) run on **LocalStack**; email goes to **Mailpit**. Same adapters as prod, different endpoints.

## Minimum VPS spec
| | Minimum | Recommended |
|---|---|---|
| vCPU | 8 | 12 |
| RAM | 16 GB | 32 GB |
| Disk | 160 GB NVMe | 300 GB NVMe |
| OS | Ubuntu 24.04 LTS (KVM, not OpenVZ/LXC) | same |
| Network | Static IPv4 | + IPv6 |

32 GB fits the stack + ~4 concurrent workspace slots for QA.

## DNS
Point these to the VPS IP (A records):
`qa.hellosmart.ai`, `api.qa.hellosmart.ai`, `ws.qa.hellosmart.ai`, `mail.qa.hellosmart.ai`

## One-time setup (Architecture & Platform)
```bash
# as root on a fresh VPS
curl -fsSLO https://raw.githubusercontent.com/infinitica-org/hellosmart/dev/infra/qa-vps/bootstrap.sh
less bootstrap.sh           # read it first
bash bootstrap.sh
```
Then:
1. Add the deploy public key to `/home/deploy/.ssh/authorized_keys` (bootstrap prints where).
2. Create `/srv/hellosmart/.env.qa` from `env.qa.example` (secrets only on the box, mode 600).
3. In GitHub → Settings → Environments → `qa`: add secrets `QA_SSH_HOST`, `QA_SSH_USER`, `QA_SSH_KEY`, `QA_SSH_KNOWN_HOSTS`.

## Access control
- `qa.hellosmart.ai` is behind **basic auth + IP allowlist** in Caddy (team office/VPN IPs). Never public.
- SSH: key-only, no root login, port changed, fail2ban, `deploy` user can only run `docker compose` in `/srv/hellosmart`.
- QA data is synthetic only (`@hs/fixtures`). **Never copy production data to QA.**

## Reset QA data
`ssh deploy@qa 'cd /srv/hellosmart && ./qa.sh reset'` → drops DB, re-runs migrations + seed.
