# Portable observability kit

Grafana, Loki, Tempo, Prometheus, Blackbox, Grafana Alloy, and Dozzle.

```bash
pnpm obs:up
```

- Grafana: http://127.0.0.1:3001
- Dozzle (live tail only): http://127.0.0.1:8888

UIs bind to localhost. QA uses an SSH tunnel; they are not on Caddy.
