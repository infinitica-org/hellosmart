#!/bin/sh
set -eu
# Client budget: API replicas * PG_POOL_MAX plus worker. Server budget is default_pool_size (20).
# Migrations must connect to postgres:5432, never here.
umask 077
{
  printf '"%s" "%s"\n' "${PGBOUNCER_APP_USER:-hs_app}" "${PGBOUNCER_APP_PASSWORD:-hs_app_local}"
  printf '"%s" "%s"\n' "${PGBOUNCER_PLATFORM_USER:-hs_platform}" "${PGBOUNCER_PLATFORM_PASSWORD:-hs_platform_local}"
} > /tmp/pgbouncer-userlist.txt
exec pgbouncer /etc/pgbouncer/pgbouncer.ini
