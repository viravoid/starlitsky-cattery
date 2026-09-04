# Production Deployment Prep

This document prepares a repeatable Tencent Cloud Lightweight Application Server deployment. It does not deploy to a real server, request passwords, write secrets, buy services, change schema, migrate PostgreSQL, or expose the internal API port.

## Current Runtime Audit

- API start: `services/api` runs directly with `node src/server.mjs`; root `npm run dev:api` delegates to that entry. There is no API compile/build artifact today.
- API host/port: `services/api/src/config/env.mjs` defaults production to `0.0.0.0:8080`, so production deployment must override `API_HOST=127.0.0.1` behind Nginx.
- API health: `GET /health` returns a process-level JSON health response with `status`, `service`, `environment`, and `timestamp`; it does not verify database connectivity.
- Admin build: `npm run build:admin` runs Vite with `apps/admin/vite.config.ts` and writes `dist/admin`. Production Admin builds require `VITE_API_BASE_URL`.
- Miniapp build/config: `apps/miniapp` is opened and uploaded through WeChat Developer Tools. `apps/miniapp/config/env.ts` currently has local `develop` API URL and empty `trial`/`release` URLs, so final `https://api.<domain>` must be set before WeChat trial/release upload.
- Prisma generate: `npm exec --yes --package bun@1.3.14 -- bun run --cwd services/api db:generate` runs `prisma generate --schema prisma/schema.prisma`.
- Prisma migrate deploy: `db:migrate:deploy` runs `node prisma/ensure-local-sqlite.mjs && prisma migrate deploy --schema prisma/schema.prisma`.
- SQLite location: Prisma uses `DATABASE_URL`. Relative SQLite paths such as `file:dev.db` resolve under `services/api/prisma`; production must use an absolute path outside the release directory, for example `file:/opt/starlitsky/data/starlitsky.sqlite`.
- Env verifier: `npm run verify:production-env` requires `NODE_ENV=production`, `DATABASE_URL`, production-grade auth secret, WeChat credentials, explicit non-wildcard CORS origins, disabled mocks, and COS/S3 storage placeholders replaced with real server-side values.
- Production runtime dependencies: Node.js matching CI (`24.16.0`), npm, Bun `1.3.14` for lockfile installs/build commands, systemd, Nginx, sqlite3 CLI for backups, curl for health checks, and the installed workspace `node_modules`.

## Filesystem Layout

Use a stable root with code, data, backups, and logs separated:

```text
/opt/starlitsky/
  app/          # checked-out or copied application release
  data/         # SQLite database and durable runtime data
  backups/
    sqlite/     # timestamped SQLite backups
  logs/         # optional app/operator logs; systemd journal remains primary
/etc/starlitsky/
  starlitsky-api.env
  admin-build.env
```

The key rule is that `/opt/starlitsky/data/starlitsky.sqlite` is not inside `/opt/starlitsky/app`, so replacing code cannot overwrite the database.

## Repeatable Deployment Commands

These commands are intended to be run on the prepared server by an operator after code is present at `/opt/starlitsky/app` and env files have been created from the templates:

```bash
cd /opt/starlitsky/app
deploy/production/scripts/install-build-migrate-restart.sh
```

The script performs:

- dependency installation from `bun.lock`
- deployment asset verification
- production env verification
- Prisma schema validation
- Prisma generate
- Prisma migrate deploy
- root build
- Admin build
- systemd API restart
- localhost health check

It intentionally performs no SSH, server provisioning, certificate issuance, Docker operation, or secret generation.

## Service Process

Use `deploy/production/systemd/starlitsky-api.service` as the systemd template:

- `WorkingDirectory=/opt/starlitsky/app`
- `EnvironmentFile=/etc/starlitsky/starlitsky-api.env`
- `NODE_ENV=production`
- `API_HOST=127.0.0.1`
- `API_PORT=8080`
- `ExecStart=/usr/bin/node /opt/starlitsky/app/services/api/src/server.mjs`
- `Restart=on-failure`

Install only after replacing placeholders on the server:

```bash
sudo cp deploy/production/systemd/starlitsky-api.service /etc/systemd/system/starlitsky-api.service
sudo systemctl daemon-reload
sudo systemctl enable starlitsky-api
sudo systemctl restart starlitsky-api
```

## Nginx Template

Use `deploy/production/nginx/starlitsky.conf.template` as the starting point after the final domain is known:

- `admin.__DOMAIN__` serves `dist/admin`
- `api.__DOMAIN__` proxies to `127.0.0.1:8080`
- port 80 blocks are structured as future HTTPS redirects
- port 443 blocks are present but commented until certificates exist
- Admin uses SPA fallback with `try_files $uri $uri/ /index.html`
- proxy headers pass `Host`, `X-Real-IP`, and `X-Forwarded-*`
- `client_max_body_size 10m` matches the default `STORAGE_MAX_IMAGE_BYTES=10485760`
- CORS stays in the API env; wildcard CORS is not restored

Firewall/security-group exposure should be limited to Nginx ports 80 and 443. Do not expose API port 8080 publicly.

## SQLite Backup

Use the SQLite online backup API through the sqlite3 CLI:

```bash
deploy/production/scripts/backup-sqlite.sh
```

Behavior:

- reads `DATABASE_URL` from `/etc/starlitsky/starlitsky-api.env`
- requires a `file:` SQLite URL
- creates timestamped backups in `/opt/starlitsky/backups/sqlite`
- uses `.backup` instead of copying a live database file
- compresses backups with gzip and chmods them to `600`
- deletes backups older than `RETENTION_DAYS` only when at least one backup remains

Restore outline:

```bash
sudo systemctl stop starlitsky-api
sudo cp /opt/starlitsky/data/starlitsky.sqlite /opt/starlitsky/backups/sqlite/pre-restore-manual.sqlite
sudo gunzip -c /opt/starlitsky/backups/sqlite/starlitsky-YYYYMMDDTHHMMSSZ.sqlite.gz > /opt/starlitsky/data/starlitsky.sqlite
sudo chown starlitsky:starlitsky /opt/starlitsky/data/starlitsky.sqlite
sudo systemctl start starlitsky-api
curl --fail http://127.0.0.1:8080/health
```

## Env Templates

- API server env: `deploy/production/env/starlitsky-api.env.example`
- Admin public build env: `deploy/production/env/admin-build.env.example`

All sensitive values are placeholders. Real `AUTH_TOKEN_SECRET`, WeChat secret, COS secret, and server passwords must never be committed.

## Pre-Deployment Smoke Checklist

- Health: `curl --fail http://127.0.0.1:8080/health` and then `https://api.<domain>/health` after Nginx/cert setup.
- Migration: `db:migrate:deploy` has completed and `prisma migrate status` shows no pending migration.
- Admin page: `https://admin.<domain>` loads the built `dist/admin` app and refresh/deep-link fallback works.
- CORS: browser requests from `https://admin.<domain>` receive the exact allowed origin; random origins do not.
- Auth: WeChat login and `/auth/me` session behavior work with mocks disabled.
- QR: Admin QR login challenge can be created, scanned, approved, consumed once, and expired/cancelled paths still behave.
- Media: presigned image upload respects the 10 MiB limit, writes metadata, and public media URLs resolve.
- DB persistence: create or update a low-risk record, restart `starlitsky-api`, and confirm the data remains.
- Miniapp: release/trial build uses `https://api.<domain>` and WeChat console request/upload/download domains are configured.

## External Information Needed For Real Deployment

- final domain and DNS records for `admin.<domain>` and `api.<domain>`
- ICP filing/domain readiness status
- Tencent Cloud server public IP and non-secret login method for the operator
- installed Node.js path if not `/usr/bin/node`
- final WeChat Mini Program AppID and secret
- final COS bucket, region, endpoint/public URL, access key ID, and secret
- certificate issuance method and resulting certificate file paths
- intended Linux user/group ownership, if different from `starlitsky`
