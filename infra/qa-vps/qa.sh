#!/usr/bin/env bash
# QA helper, run on the VPS in /srv/hellosmart as user deploy.
#   ./qa.sh deploy <sha>   pull images for <sha>, migrate, restart, smoke
#   ./qa.sh reset          wipe QA data, migrate, seed fixtures
#   ./qa.sh logs <svc>     tail logs
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.qa.yml --env-file .env.qa)

case "${1:-}" in
  deploy)
    sha="${2:?usage: qa.sh deploy <sha>}"
    [[ "$sha" =~ ^[0-9a-f]{7,40}$ ]] || { echo "invalid sha"; exit 1; }
    sed -i "s/^TAG=.*/TAG=${sha}/" .env.qa
    "${COMPOSE[@]}" pull
    "${COMPOSE[@]}" run --rm api node dist/db/migrate.js
    "${COMPOSE[@]}" up -d --remove-orphans
    sleep 10
    curl -fsS -o /dev/null http://localhost/healthz -H "Host: api.qa.hellosmart.ai" || { echo "smoke failed"; exit 1; }
    echo "deployed ${sha}"
    ;;
  reset)
    "${COMPOSE[@]}" down
    docker volume rm hellosmart-qa_pgdata hellosmart-qa_localstack || true
    "${COMPOSE[@]}" up -d postgres redis localstack mailpit
    sleep 8
    "${COMPOSE[@]}" run --rm api node dist/db/migrate.js
    "${COMPOSE[@]}" run --rm api node dist/db/seed.js
    "${COMPOSE[@]}" up -d
    ;;
  logs)
    "${COMPOSE[@]}" logs -f --tail=200 "${2:-api}"
    ;;
  *)
    echo "usage: qa.sh deploy <sha> | reset | logs <service>"; exit 1 ;;
esac
