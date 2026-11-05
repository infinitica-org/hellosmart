# Staging environment

CloudWatch, Firehose, and S3 log archive are **not** provisioned here.

Logs, metrics, traces, uptime probes, and live tail run from the portable Compose kit:

- [docker-compose.obs.yml](../../../../docker-compose.obs.yml)
- [infra/observability](../../../observability)

Apply this environment only when compute/network modules exist. Do not add vendor logging products.
