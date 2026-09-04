#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8080/health}"

body="$(curl --fail --show-error --silent --max-time 10 "$API_HEALTH_URL")"

if [[ "$body" != *'"status":"ok"'* && "$body" != *'"status": "ok"'* ]]; then
  echo "Health endpoint did not report status=ok." >&2
  echo "$body" >&2
  exit 1
fi

echo "$body"
