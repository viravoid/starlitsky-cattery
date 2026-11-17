#!/usr/bin/env bash
set -euo pipefail

# Isolated rehearsal: no production path, database, upload or service is touched.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(mktemp -d /tmp/starlitsky-release-rehearsal.XXXXXXXX)"
OLD="$(printf 'a%.0s' {1..40})"
NEW="$(printf 'b%.0s' {1..40})"
PORT=18431
API_PORT=18432

cleanup() {
  nginx -s stop -c "$ROOT/nginx.conf" -p "$ROOT/" >/dev/null 2>&1 || true
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  [[ "$ROOT" == /tmp/starlitsky-release-rehearsal.* ]] && rm -rf -- "$ROOT"
}
trap cleanup EXIT

mkdir -p "$ROOT/releases/$OLD" "$ROOT/releases/$NEW" "$ROOT/bundle-old/assets" "$ROOT/bundle-new/assets" "$ROOT/data" "$ROOT/uploads"
printf 'old-api' > "$ROOT/releases/$OLD/api-version"
printf 'new-api' > "$ROOT/releases/$NEW/api-version"
printf 'data-unchanged' > "$ROOT/data/marker"
printf 'uploads-unchanged' > "$ROOT/uploads/marker"
ln -s "$ROOT/releases/$OLD" "$ROOT/app"

API_URL="http://127.0.0.1:$PORT/api"
printf '<html>old-admin<script src="/assets/old-hash.js"></script></html>' > "$ROOT/bundle-old/index.html"
printf 'window.API_URL="%s";window.ADMIN_VERSION="old";' "$API_URL" > "$ROOT/bundle-old/assets/old-hash.js"
printf '<html>new-admin<script src="/assets/new-hash.js"></script></html>' > "$ROOT/bundle-new/index.html"
printf 'window.API_URL="%s";window.ADMIN_VERSION="new";' "$API_URL" > "$ROOT/bundle-new/assets/new-hash.js"

ROOT_DIR="$ROOT" EXPECTED_API_BASE_URL="$API_URL" bash "$SCRIPT_DIR/stage-admin-release.sh" "$OLD" "$ROOT/bundle-old"
ROOT_DIR="$ROOT" bash "$SCRIPT_DIR/switch-release-link.sh" admin "$OLD"

cat > "$ROOT/api.py" <<'PY'
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import os
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = (Path(os.environ['REHEARSAL_ROOT']) / 'app' / 'api-version').read_bytes()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_):
        pass
HTTPServer(('127.0.0.1', int(os.environ['REHEARSAL_API_PORT'])), Handler).serve_forever()
PY
REHEARSAL_ROOT="$ROOT" REHEARSAL_API_PORT="$API_PORT" python3 "$ROOT/api.py" &
API_PID=$!

cat > "$ROOT/nginx.conf" <<EOF
worker_processes 1;
pid $ROOT/nginx.pid;
error_log $ROOT/nginx-error.log warn;
events { worker_connections 32; }
http {
    include /etc/nginx/mime.types;
    server {
        listen 127.0.0.1:$PORT;
        access_log $ROOT/nginx-access.log;
        root $ROOT/admin/current;
        index index.html;
        location = /index.html { add_header Cache-Control "no-store" always; }
        location ^~ /assets/ {
            root $ROOT/admin;
            try_files \$uri =404;
            expires 7d;
            add_header Cache-Control "public, max-age=604800";
        }
        location /api/ { proxy_pass http://127.0.0.1:$API_PORT/; }
        location / { try_files \$uri \$uri/ /index.html; }
    }
}
EOF
nginx -t -c "$ROOT/nginx.conf" -p "$ROOT/"
nginx -c "$ROOT/nginx.conf" -p "$ROOT/"
BASE="http://127.0.0.1:$PORT"
for _ in {1..20}; do curl -fsS "$BASE/api/health" >/dev/null 2>&1 && break || sleep 0.1; done
[[ "$(curl -fsS "$BASE/api/health")" == 'old-api' ]]
curl -fsS "$BASE/" | grep -q 'old-admin'
curl -fsS "$BASE/assets/old-hash.js" | grep -q "$API_URL"

ROOT_DIR="$ROOT" EXPECTED_API_BASE_URL="$API_URL" bash "$SCRIPT_DIR/stage-admin-release.sh" "$NEW" "$ROOT/bundle-new"
curl -fsS "$BASE/" | grep -q 'old-admin'
ROOT_DIR="$ROOT" bash "$SCRIPT_DIR/switch-release-link.sh" api "$NEW"
[[ "$(curl -fsS "$BASE/api/health")" == 'new-api' ]]
curl -fsS "$BASE/" | grep -q 'old-admin'
curl -fsS "$BASE/assets/old-hash.js" | grep -q 'ADMIN_VERSION="old"'

ROOT_DIR="$ROOT" bash "$SCRIPT_DIR/switch-release-link.sh" admin "$NEW"
curl -fsS "$BASE/" | grep -q 'new-admin'
curl -fsS "$BASE/settings/parents" | grep -q 'new-admin'
curl -fsSI "$BASE/settings/parents" | grep -qi 'Cache-Control: no-store'
curl -fsS "$BASE/assets/new-hash.js" | grep -q 'ADMIN_VERSION="new"'
curl -fsS "$BASE/assets/old-hash.js" | grep -q 'ADMIN_VERSION="old"'

ROOT_DIR="$ROOT" bash "$SCRIPT_DIR/switch-release-link.sh" admin "$OLD"
ROOT_DIR="$ROOT" bash "$SCRIPT_DIR/switch-release-link.sh" api "$OLD"
curl -fsS "$BASE/" | grep -q 'old-admin'
[[ "$(curl -fsS "$BASE/api/health")" == 'old-api' ]]
[[ "$(cat "$ROOT/data/marker")" == 'data-unchanged' ]]
[[ "$(cat "$ROOT/uploads/marker")" == 'uploads-unchanged' ]]
echo 'Independent Admin/API switch and rollback rehearsal passed'
