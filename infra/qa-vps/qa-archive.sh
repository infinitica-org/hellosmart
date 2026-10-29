#!/usr/bin/env bash
# Runs the HelloSmart QA Log Ingestion & 7-Day Archival Job on the QA Host.
# Can be executed manually by user deploy or scheduled via systemd timer / cron.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "${SCRIPT_DIR}/../../scripts/qa-log-archive.mjs" ]]; then
  APP_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
elif [[ -f "${SCRIPT_DIR}/scripts/qa-log-archive.mjs" ]]; then
  APP_DIR="${SCRIPT_DIR}"
elif [[ -d "/srv/hellosmart" ]]; then
  APP_DIR="/srv/hellosmart"
else
  APP_DIR="$(pwd)"
fi

LOG_DIR="${QA_LOG_DIR:-${APP_DIR}/logs}"
if [[ -f "${APP_DIR}/docker-compose.qa.yml" ]]; then
  COMPOSE_FILE="${APP_DIR}/docker-compose.qa.yml"
else
  COMPOSE_FILE="${APP_DIR}/infra/qa-vps/docker-compose.qa.yml"
fi

cd "${APP_DIR}"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting HelloSmart QA log retention and archival run..."

# Run archival tool
node scripts/qa-log-archive.mjs \
  --log-dir "${LOG_DIR}" \
  --compose-file "${COMPOSE_FILE}" \
  --retention-days 7

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] QA log retention and archival run completed successfully."
