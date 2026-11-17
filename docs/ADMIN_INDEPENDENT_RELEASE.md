# Independent Admin and API production cutover

This procedure prepares a release for approval. It does not authorize a production
change. The currently active API is `/opt/starlitsky/app -> /opt/starlitsky/releases/<sha>`;
the old Nginx Admin root is `/opt/starlitsky/app/dist/admin`. Change the Admin root
to `/opt/starlitsky/admin/current` **while current still points to the old Admin**,
before switching the API link.

## Release layout

- API: `/opt/starlitsky/releases/<sha>`; active link `/opt/starlitsky/app`.
- Admin: `/opt/starlitsky/admin/releases/<sha>`; active link
  `/opt/starlitsky/admin/current`.
- Shared hashed assets: `/opt/starlitsky/admin/assets`. Keep assets referenced by
  both old and new HTML. Do not prune assets during cutover or rollback.
- Persistent SQLite, uploads, backup and env files remain outside both release
  directories. Switching code must never remove them.

`stage-admin-release.sh` accepts an already built Admin directory and a full source
SHA. It verifies the expected API URL appears in the bundle, copies the versioned
HTML and assets, and preserves old hashed assets. It does not switch the active
link. Build with the reviewed `/etc/starlitsky/admin-build.env` value; record the
source SHA, `index.html` and asset SHA-256 hashes before staging. Check the built
JavaScript has the intended production API URL and no unintended trial/local API
URL. The API must be installed and built in a new immutable release directory;
do not run `install-build-migrate-restart.sh` through `/opt/starlitsky/app`.

## Approved window sequence

1. Confirm the release SHA, CI, migration set, disk space, exact current API process
   cwd, Nginx roots, Admin asset hashes, COS policy and selected trial compatibility.
   Stop if any differ from the reviewed values.
2. Build the API in `/opt/starlitsky/releases/<new-sha>` and Admin from the same
   source with the reviewed `VITE_API_BASE_URL`. Do dependency installation,
   Prisma generation and builds here. Use `stage-admin-release.sh` first for the
   verified old bundle, then for the new bundle. Preserve both version directories.
3. Point `admin/current` to the **old** Admin with `switch-release-link.sh admin
   <old-sha>`. Prepare actual production and trial Nginx site files with path-only
   access logs. The log format must be defined exactly once in the `http` context;
   compare `deploy/production/nginx/starlitsky-https-cutover.conf.template` with the
   current live four-server site and `starlitsky-trial.conf.template` with the
   separate trial site. Confirm no format-name collision in `nginx -T`. Run
   `nginx -t`, then reload Nginx only
   in the approved window. Verify the Admin root resolves outside `app`, both
   HTTP/HTTPS site access logs use the new format, and old Admin deep links/assets
   work. The template alone never updates live Nginx.
4. Freeze writes and stop API writers. Verify SQLite migration ledger, schema,
   integrity, foreign keys and disk space against the rehearsal. Run
   `RETENTION_DAYS=36500 /opt/starlitsky/app/deploy/production/scripts/backup-sqlite.sh`
   with a window-specific retention override so this backup
   does not prune existing archives; verify the compressed backup can be opened,
   passes `PRAGMA integrity_check` and `foreign_key_check`, and has matching
   counts/ledger. Record its SHA-256 and restore-test a protected copy.
   Keep a separately protected backup copy. Apply only the reviewed ordered
   migrations while writes remain frozen; verify them before starting new code.
5. Switch `/opt/starlitsky/app` with `switch-release-link.sh api <new-sha>`, restart
   the API, and confirm process cwd, exact release SHA, health, authenticated
   read/role checks, CORS and signed media reads. Old Admin must still load and
   call the new API. A 200 from `/health` alone is insufficient.
6. Switch `admin/current` with `switch-release-link.sh admin <new-sha>`. Check
   `index.html` and deep links have `Cache-Control: no-store`; new HTML calls the
   intended API; both old and new hashed assets remain reachable. Run Admin login,
   permissions, navigation and selected business read smoke. Resume writes only
   after these checks pass.

`switch-release-link.sh` changes only one symlink atomically. It never migrates,
restarts, changes Nginx, deletes a release, or restores SQLite. It reports the old
target; record that target before each switch. To roll back code, switch Admin and
API back to their recorded old SHAs and restart API, while keeping the migrated
schema. If writes have resumed, **do not** overwrite the live SQLite with a
pre-deployment snapshot. Stop writes, preserve a fresh snapshot and use reviewed
forward repair or data-preserving replay if needed.

## Stop conditions

Stop the cutover if the actual schema/ledger differs, a new migration appears,
backup verification fails, writes cannot be frozen, Nginx syntax fails, an Admin
hash or API source SHA differs, the links cannot switch independently, a sensitive
credential remains in an access-log path, a critical auth/role check fails, COS
write scope is wrong, or rollback would require discarding new business records.

The current GET invite-verification route may put credentials in query strings.
The templates use path-only access logs and suppress Nginx errors in that exact
location, since an upstream failure otherwise logs the complete request line.
Errors before location selection, other virtual hosts and historical logs remain
possible exposure paths. Inspect the effective default/global access log and all
actual production/trial sites during the approved Nginx change. Keep error logs
access-restricted with a defined retention and rotation policy, review historical
logs only under restricted access, and invalidate exposed credentials where needed.
Do not copy raw logs to GitHub or delete production logs without authorization.
Moving legacy clients from query credentials to a body-based request is a separate
compatibility change.

Run `bash deploy/production/scripts/verify-independent-release.sh` on an isolated
Linux host with Nginx, curl and Python to rehearse old/new Admin and API switches,
deep-link refresh, hashed assets, cache headers and rollback. This synthetic test
does not prove production credentials, auth, COS, migration or WeChat behavior.
