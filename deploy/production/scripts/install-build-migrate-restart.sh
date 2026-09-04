#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/starlitsky}"
APP_DIR="${APP_DIR:-$ROOT_DIR/app}"
DATA_DIR="${DATA_DIR:-$ROOT_DIR/data}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups/sqlite}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
ENV_FILE="${ENV_FILE:-/etc/starlitsky/starlitsky-api.env}"
ADMIN_BUILD_ENV_FILE="${ADMIN_BUILD_ENV_FILE:-/etc/starlitsky/admin-build.env}"
BUN_VERSION="${BUN_VERSION:-1.3.14}"
SERVICE_NAME="${SERVICE_NAME:-starlitsky-api}"

if [[ ! -d "$APP_DIR" ]]; then
  echo "APP_DIR does not exist: $APP_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing API env file: $ENV_FILE" >&2
  exit 1
fi

if [[ ! -f "$ADMIN_BUILD_ENV_FILE" ]]; then
  echo "Missing Admin build env file: $ADMIN_BUILD_ENV_FILE" >&2
  exit 1
fi

mkdir -p "$DATA_DIR" "$BACKUP_DIR" "$LOG_DIR"

cd "$APP_DIR"

run_bun() {
  npm exec --yes --package "bun@$BUN_VERSION" -- bun "$@"
}

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${DATABASE_URL:?DATABASE_URL must be set in the API env file}"

run_bun install --frozen-lockfile

npm run verify:deployment-assets
npm run verify:production-env
run_bun run --cwd services/api db:validate
run_bun run --cwd services/api db:generate
run_bun run --cwd services/api db:migrate:deploy

npm run build

set -a
# shellcheck disable=SC1090
. "$ADMIN_BUILD_ENV_FILE"
set +a

: "${VITE_API_BASE_URL:?VITE_API_BASE_URL must be set in the Admin build env file}"

npm run build:admin

systemctl restart "$SERVICE_NAME"

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:${API_PORT:-8080}/health}" \
  "$APP_DIR/deploy/production/scripts/health-check.sh"
