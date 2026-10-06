#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="${API_HEALTH_URL:-http://127.0.0.1:8080/health}"
API_HEALTH_MAX_WAIT_SECONDS="${API_HEALTH_MAX_WAIT_SECONDS:-30}"
API_HEALTH_RETRY_INTERVAL_SECONDS="${API_HEALTH_RETRY_INTERVAL_SECONDS:-1}"
CURL_BIN="${CURL_BIN:-curl}"

if [[ ! "$API_HEALTH_MAX_WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "API_HEALTH_MAX_WAIT_SECONDS must be a positive integer." >&2
  exit 1
fi

if (( API_HEALTH_MAX_WAIT_SECONDS > 30 )); then
  echo "API_HEALTH_MAX_WAIT_SECONDS must not exceed 30." >&2
  exit 1
fi

if [[ ! "$API_HEALTH_RETRY_INTERVAL_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "API_HEALTH_RETRY_INTERVAL_SECONDS must be a positive integer." >&2
  exit 1
fi

start_time="$(date +%s)"
deadline=$((start_time + API_HEALTH_MAX_WAIT_SECONDS))
attempt=1
completed_attempts=0
last_failure="no attempt completed"

while (( "$(date +%s)" < deadline )); do
  completed_attempts="$attempt"
  if body="$("$CURL_BIN" --fail --show-error --silent --max-time "$API_HEALTH_RETRY_INTERVAL_SECONDS" "$API_HEALTH_URL" 2>&1)"; then
    if [[ "$body" == *'"status":"ok"'* || "$body" == *'"status": "ok"'* ]]; then
      echo "Health check passed on attempt $attempt."
      echo "$body"
      exit 0
    fi

    last_failure="health body did not contain status=ok"
    echo "Health check attempt $attempt returned non-ok body." >&2
  else
    curl_status="$?"
    last_failure="curl exited with status $curl_status"
    echo "Health check attempt $attempt failed: curl exited with status $curl_status." >&2
  fi

  now="$(date +%s)"
  next_attempt_time=$((start_time + attempt * API_HEALTH_RETRY_INTERVAL_SECONDS))
  if (( now >= deadline )); then
    break
  fi
  if (( next_attempt_time > now )); then
    sleep "$((next_attempt_time - now))"
  fi
  attempt=$((attempt + 1))
done

echo "Health check failed after ${API_HEALTH_MAX_WAIT_SECONDS}s and ${completed_attempts} attempt(s): ${last_failure}." >&2
exit 1
