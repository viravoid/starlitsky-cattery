#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/starlitsky/starlitsky-api.env}"
BACKUP_DIR="${BACKUP_DIR:-/opt/starlitsky/backups/sqlite}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

DATABASE_URL="${DATABASE_URL:-}"
DATABASE_PATH="${DATABASE_PATH:-}"

if [[ -z "$DATABASE_PATH" ]]; then
  if [[ "$DATABASE_URL" != file:* ]]; then
    echo "DATABASE_URL must be a file: SQLite URL, or DATABASE_PATH must be set." >&2
    exit 1
  fi
  DATABASE_PATH="${DATABASE_URL#file:}"
  DATABASE_PATH="${DATABASE_PATH%\"}"
  DATABASE_PATH="${DATABASE_PATH#\"}"
fi

if [[ "$DATABASE_PATH" == *"'"* ]]; then
  echo "DATABASE_PATH must not contain a single quote for this simple backup script." >&2
  exit 1
fi

if [[ "$BACKUP_DIR" == *"'"* ]]; then
  echo "BACKUP_DIR must not contain a single quote for this simple backup script." >&2
  exit 1
fi

if [[ ! -f "$DATABASE_PATH" ]]; then
  echo "SQLite database does not exist: $DATABASE_PATH" >&2
  exit 1
fi

command -v sqlite3 >/dev/null 2>&1 || {
  echo "sqlite3 CLI is required for safe SQLite online backups." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
database_name="$(basename "$DATABASE_PATH" .sqlite)"
backup_file="$BACKUP_DIR/${database_name}-${timestamp}.sqlite"
compressed_file="${backup_file}.gz"

if [[ "$backup_file" == *"'"* ]]; then
  echo "backup_file must not contain a single quote for this simple backup script." >&2
  exit 1
fi

sqlite3 "$DATABASE_PATH" <<SQL
.timeout 5000
.backup '${backup_file}'
SQL

gzip -9 "$backup_file"
chmod 600 "$compressed_file"

echo "Created SQLite backup: $compressed_file"

mapfile -t expired_backups < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${database_name}-*.sqlite.gz" -mtime +"$RETENTION_DAYS" | sort
)

mapfile -t all_backups < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${database_name}-*.sqlite.gz" | sort
)

if (( ${#all_backups[@]} <= 1 )); then
  echo "Retention skipped: only one backup exists."
  exit 0
fi

for old_backup in "${expired_backups[@]}"; do
  mapfile -t remaining_backups < <(
    find "$BACKUP_DIR" -maxdepth 1 -type f -name "${database_name}-*.sqlite.gz" | sort
  )
  if (( ${#remaining_backups[@]} <= 1 )); then
    echo "Retention stopped before deleting the final remaining backup."
    break
  fi
  rm -f -- "$old_backup"
  echo "Deleted expired SQLite backup: $old_backup"
done
