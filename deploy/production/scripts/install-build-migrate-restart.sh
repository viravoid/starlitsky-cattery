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
RUNTIME_USER="${RUNTIME_USER:-starlitsky}"
RUNTIME_GROUP="${RUNTIME_GROUP:-starlitsky}"

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

cd "$APP_DIR"

run_bun() {
  npm exec --yes --package "bun@$BUN_VERSION" -- bun "$@"
}

sqlite_path_from_url() {
  local database_url="$1"
  if [[ "$database_url" != file:* ]]; then
    echo "DATABASE_URL must be a file: SQLite URL for this deployment script." >&2
    exit 1
  fi

  local database_path="${database_url#file:}"
  database_path="${database_path%%\?*}"
  database_path="${database_path%\"}"
  database_path="${database_path#\"}"

  if [[ "$database_path" != /* ]]; then
    echo "Production SQLite DATABASE_URL must use an absolute path: $database_url" >&2
    exit 1
  fi

  printf '%s\n' "$database_path"
}

ensure_runtime_user_and_paths() {
  if (( EUID != 0 )); then
    echo "This deployment script must run as root so it can provision runtime ownership and restart systemd." >&2
    exit 1
  fi

  if ! getent group "$RUNTIME_GROUP" >/dev/null; then
    groupadd --system "$RUNTIME_GROUP"
  fi

  if ! id -u "$RUNTIME_USER" >/dev/null 2>&1; then
    useradd --system --gid "$RUNTIME_GROUP" --home-dir "$ROOT_DIR" --shell /usr/sbin/nologin "$RUNTIME_USER"
  fi

  install -d -o "$RUNTIME_USER" -g "$RUNTIME_GROUP" -m 0750 "$DATA_DIR" "$BACKUP_DIR" "$LOG_DIR"

  local database_path="$1"
  case "$database_path" in
    "$DATA_DIR"/*) ;;
    *)
      echo "DATABASE_URL SQLite path must live under DATA_DIR ($DATA_DIR): $database_path" >&2
      exit 1
      ;;
  esac

  install -d -o "$RUNTIME_USER" -g "$RUNTIME_GROUP" -m 0750 "$(dirname "$database_path")"

  local sqlite_runtime_file
  for sqlite_runtime_file in "$database_path" "$database_path-journal" "$database_path-wal" "$database_path-shm"; do
    if [[ -e "$sqlite_runtime_file" ]]; then
      chown "$RUNTIME_USER:$RUNTIME_GROUP" "$sqlite_runtime_file"
      chmod 0640 "$sqlite_runtime_file"
    fi
  done
}

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${DATABASE_URL:?DATABASE_URL must be set in the API env file}"
DATABASE_PATH="$(sqlite_path_from_url "$DATABASE_URL")"
ensure_runtime_user_and_paths "$DATABASE_PATH"

run_bun install --frozen-lockfile

npm run verify:deployment-assets
npm run verify:production-env
run_bun run --cwd services/api db:validate
run_bun run --cwd services/api db:generate

if [[ -f "$DATABASE_PATH" ]]; then
  ENV_FILE="$ENV_FILE" BACKUP_DIR="$BACKUP_DIR" "$APP_DIR/deploy/production/scripts/backup-sqlite.sh"
else
  echo "SQLite database does not exist yet; skipping pre-migration backup for first deploy: $DATABASE_PATH"
fi

run_bun run --cwd services/api db:migrate:deploy
run_bun run --cwd services/api db:status
ensure_runtime_user_and_paths "$DATABASE_PATH"

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
