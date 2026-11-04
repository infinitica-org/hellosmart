# Log retention — HelloSmart.ai

Logs are JSON on stdout (Pino). Search and retention are Loki. Live follow is Dozzle only. There is no CloudWatch, Firehose, or S3 log archive.

## Policy

| Dimension | Specification |
|---|---|
| Format | Structured JSON on stdout |
| Live tail | Dozzle (`127.0.0.1:8888`), Docker socket read-only |
| Search | Grafana Explore → Loki |
| Active retention | Loki `retention_period: 168h` (7 days) on local disk |
| Metrics / traces | OpenTelemetry OTLP → collector → Prometheus and Tempo |
| Uptime | Prometheus Blackbox probes of `/api/v1/health/ready` |

## Run locally

```bash
docker compose -f docker-compose.yml -f docker-compose.obs.yml up -d
```

Grafana: `http://127.0.0.1:3001` (admin/admin). Dozzle: `http://127.0.0.1:8888`. On QA, SSH-tunnel those ports; they are not on the public Caddy site.

Config lives in [`infra/observability`](../infra/observability).
