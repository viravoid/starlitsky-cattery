# Production SQLite backup and offline inventory handoff

This runbook is an operator handoff for creating one transaction-consistent SQLite backup and
running the historical-image inventory on a separate offline workstation. It is not authorization
to access production, stop the API, transfer data, read COS, change configuration, deploy, or
migrate objects. The production owner must approve the window, operator, paths, transfer channel,
retention period, and evidence destination before execution.

Use this runbook only after the owner or an authorized server operator confirms that a current
production deployment and its SQLite database actually exist and that the database is a relevant
source of historical image references. Deployment templates, configured production domains, old
API captures, and a local development database do not establish that current server state. If no
current production database exists, or an inspected database contains no relevant legacy
references, do not schedule a write freeze or maintenance window. Follow the case-B evidence route
in `docs/OFFLINE_IMAGE_INVENTORY.md` instead.

## What consistency means

`deploy/production/scripts/backup-sqlite.sh` uses SQLite's online `.backup` API. The resulting
database is a transaction-consistent SQLite snapshot even when the live database uses WAL or has
concurrent readers and writers. Do not copy the live `.sqlite`, `-wal`, or `-shm` files separately.

A write freeze is still recommended when this inventory will be used as migration evidence. The
freeze is not needed to make `.backup` structurally consistent; it creates an unambiguous business
cutoff and prevents new or changed image references from immediately making the inventory stale.
If writes cannot be frozen, record the cutoff time and plan a separately approved delta backup and
inventory before any cutover.

## Separation of duties and artifacts

The authorized production operator creates and validates:

- one `*.sqlite.gz` archive produced by `backup-sqlite.sh`;
- one checksum file containing SHA-256 for both the compressed archive and its uncompressed SQLite
  bytes;
- one non-secret handoff note with UTC time, deployed Git commit, change/approval reference,
  whether writes were frozen, and the exact archive/checksum filenames.

The offline analyst receives only the archive, checksum file, approved legacy source map, and any
separately approved supplemental manifest. Do not transfer the production env file, credentials,
logs, WAL/SHM files, or unrelated backups.

The backup, source map, supplemental manifest, full inventory report, and hashes are sensitive
operational evidence. None belongs in Git, GitHub Actions artifacts, chat, email, tickets that are
not approved for production data, or a consumer cloud-sync folder.

## 1. Production operator procedure

Run only after the production owner approves the exact window and write-control method.

1. Confirm the checked-out release and record the full commit without changing it:

   ```bash
   cd /opt/starlitsky/app
   git rev-parse HEAD
   git status --short
   ```

   Stop if the commit is not the approved release or tracked files are modified. Do not print or
   copy `/etc/starlitsky/starlitsky-api.env`.

2. If an approved write freeze is required, block every API/Admin/community path that can change
   image references. A short API stop is the simplest complete freeze, but it creates an outage and
   therefore requires explicit production approval:

   ```bash
   sudo systemctl stop starlitsky-api
   sudo systemctl is-active starlitsky-api
   ```

   The expected second command result is `inactive`. Record the freeze start in UTC. If another
   reviewed maintenance control is used, record it instead.

3. Create a dedicated root-only handoff directory and run the existing online backup command. Use
   the exact `Created SQLite backup:` path printed by the command in the following steps.

   ```bash
   umask 077
   HANDOFF_DIR="/opt/starlitsky/backups/sqlite/offline-inventory-$(date -u +%Y%m%dT%H%M%SZ)"
   sudo install -d -o root -g root -m 0700 "$HANDOFF_DIR"
   sudo env BACKUP_DIR="$HANDOFF_DIR" RETENTION_DAYS=30 \
     /opt/starlitsky/app/deploy/production/scripts/backup-sqlite.sh
   ```

4. Set `ARCHIVE` to that exact printed path. Decompress a protected validation copy without
   overwriting an existing file, then validate the archive and SQLite structure.

   ```bash
   sudo -i
   umask 077
   ARCHIVE="/opt/starlitsky/backups/sqlite/offline-inventory-<UTC>/<exact-file>.sqlite.gz"
   RAW_BACKUP="${ARCHIVE%.gz}"
   CHECKSUMS="${ARCHIVE}.sha256"

   gzip -t -- "$ARCHIVE"
   test ! -e "$RAW_BACKUP"
   (set -o noclobber; gzip -cd -- "$ARCHIVE" > "$RAW_BACKUP")
   chmod 0600 "$ARCHIVE" "$RAW_BACKUP"

   integrity_result="$(sqlite3 -readonly "$RAW_BACKUP" 'PRAGMA integrity_check;')"
   test "$integrity_result" = "ok"
   foreign_key_failures="$(sqlite3 -readonly "$RAW_BACKUP" 'PRAGMA foreign_key_check;')"
   test -z "$foreign_key_failures"
   schema_anchors="$(sqlite3 -readonly "$RAW_BACKUP" \
     "SELECT group_concat(name, ',') FROM (SELECT name FROM sqlite_master WHERE type='table' AND name IN ('_prisma_migrations','users','media_assets') ORDER BY name);")"
   test "$schema_anchors" = "_prisma_migrations,media_assets,users"

   archive_name="$(basename "$ARCHIVE")"
   raw_name="$(basename "$RAW_BACKUP")"
   archive_sha256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
   raw_sha256="$(sha256sum "$RAW_BACKUP" | awk '{print $1}')"
   printf '%s  %s\n%s  %s\n' \
     "$archive_sha256" "$archive_name" "$raw_sha256" "$raw_name" > "$CHECKSUMS"
   chmod 0600 "$CHECKSUMS"
   ```

   Any failed command invalidates the handoff. Do not waive `gzip -t`, `integrity_check`,
   `foreign_key_check`, schema anchors, or either digest.

5. Remove only the temporary uncompressed validation copy after its digest is recorded. Retain the
   compressed archive and checksum file in the protected directory.

   ```bash
   rm -f -- "$RAW_BACKUP"
   ```

6. End the approved write freeze immediately after the snapshot and checks. If the API was stopped:

   ```bash
   sudo systemctl start starlitsky-api
   sudo systemctl is-active starlitsky-api
   curl --fail --show-error --silent http://127.0.0.1:8080/health
   ```

   Record the UTC restart time and health result. A failed restart/health check is a production
   incident and must not be hidden by continuing the inventory.

## 2. Transfer and receipt

Use a project-approved encrypted transfer channel with authenticated endpoints. Transfer exactly
the `.sqlite.gz` archive and `.sha256` file; transfer the handoff note through the approved evidence
channel. Do not place credentials in a command line or copy the production env file.

At the destination:

1. Store the files on an encrypted volume in a directory accessible only to the assigned analyst.
2. Compare the received archive SHA-256 with the production checksum file before decompression.
3. Decompress to a new `0600` working file and compare its SHA-256 with the recorded uncompressed
   digest.
4. Re-run `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, and the three schema-anchor check.
5. Record the destination verification time and analyst identity in the protected handoff note.

A mismatch means the transfer is rejected. Do not “repair,” edit, or re-compress the database to
make hashes match; request a fresh production handoff.

Example receipt checks on Windows PowerShell, with `gzip` and `sqlite3` installed, are below. Set
only the two explicit input paths; the command refuses to overwrite an existing raw database.

```powershell
$archive = "C:\protected\handoff\starlitsky-<UTC>.sqlite.gz"
$checksums = "${archive}.sha256"
$rawBackup = $archive -replace '\.gz$', ''

if (Test-Path -LiteralPath $rawBackup) { throw "Raw backup already exists: $rawBackup" }
$archiveName = Split-Path -Leaf $archive
$rawName = Split-Path -Leaf $rawBackup
$checksumLines = Get-Content -LiteralPath $checksums
$expectedArchive = (($checksumLines | Where-Object { $_ -match "  $([regex]::Escape($archiveName))$" }) -split '\s+')[0]
$expectedRaw = (($checksumLines | Where-Object { $_ -match "  $([regex]::Escape($rawName))$" }) -split '\s+')[0]
if (-not $expectedArchive -or -not $expectedRaw) { throw "Checksum entries are incomplete" }

$actualArchive = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualArchive -ne $expectedArchive) { throw "Compressed archive SHA-256 mismatch" }
& gzip -dk -- $archive
if ($LASTEXITCODE -ne 0) { throw "gzip decompression failed" }
$actualRaw = (Get-FileHash -LiteralPath $rawBackup -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualRaw -ne $expectedRaw) { throw "Uncompressed SQLite SHA-256 mismatch" }

$integrity = (& sqlite3 -readonly $rawBackup 'PRAGMA integrity_check;') -join "`n"
if ($LASTEXITCODE -ne 0 -or $integrity.Trim() -ne 'ok') { throw "SQLite integrity_check failed" }
$foreignKeys = (& sqlite3 -readonly $rawBackup 'PRAGMA foreign_key_check;') -join "`n"
if ($LASTEXITCODE -ne 0 -or $foreignKeys.Trim()) { throw "SQLite foreign_key_check failed" }
$anchors = (& sqlite3 -readonly $rawBackup "SELECT group_concat(name, ',') FROM (SELECT name FROM sqlite_master WHERE type='table' AND name IN ('_prisma_migrations','users','media_assets') ORDER BY name);") -join "`n"
if ($LASTEXITCODE -ne 0 -or $anchors.Trim() -ne '_prisma_migrations,media_assets,users') {
  throw "SQLite schema-anchor check failed"
}
```

## 3. Offline execution

Use a clean checkout at the approved commit. Disable network access at the workstation or isolated
runtime level, and ensure no production/COS credentials are present. Keep the checkout separate
from the protected evidence directory.

On Windows PowerShell, after independently verifying the two received hashes and SQLite checks:

```powershell
Remove-Item Env:STORAGE_ACCESS_KEY_ID,Env:STORAGE_ACCESS_KEY_SECRET,Env:STORAGE_SESSION_TOKEN,Env:STORAGE_LEGACY_ACCESS_KEY_ID,Env:STORAGE_LEGACY_ACCESS_KEY_SECRET,Env:STORAGE_LEGACY_SESSION_TOKEN -ErrorAction SilentlyContinue

npm run media:offline-image-inventory -- `
  --database C:\protected\handoff\starlitsky-<UTC>.sqlite `
  --legacy-source-map C:\protected\handoff\legacy-source-map.json `
  --output C:\protected\results\cos-offline-image-inventory.json

Get-FileHash -Algorithm SHA256 C:\protected\handoff\starlitsky-<UTC>.sqlite
Get-FileHash -Algorithm SHA256 C:\protected\results\cos-offline-image-inventory.json
```

If a supplemental manifest is separately approved, use the exact digest-bound flags documented in
`docs/OFFLINE_IMAGE_INVENTORY.md`. The output path must be new. Do not redirect verbose database
content to a log; standard output is deliberately a privacy-minimized summary.

The tool reopens the backup read-only, runs SQLite integrity/foreign-key checks, hashes database
bytes before and after inspection, and fails if they change. This is defense in depth and does not
replace the production and receipt checks above.

## 4. Result protection and acceptance

Accept the run only when all of the following are recorded:

- approved production commit and approval/change reference;
- freeze/cutoff start and end UTC times, or an explicit delta-inventory requirement;
- archive and uncompressed SQLite SHA-256 values matching at production and destination;
- `gzip -t`, `integrity_check`, `foreign_key_check`, and schema-anchor success at both sides;
- offline command exit code `0`;
- report-embedded database SHA-256 equal to the received uncompressed database digest;
- the report's embedded logical `reportSha256` and a separate SHA-256 of the saved report file are
  both recorded (they cover different byte representations and are not expected to be equal);
- manual-review and coverage limitations acknowledged, including unknown orphan-bucket coverage.

Keep the original archive and checksum file immutable for the approved retention period. Keep one
read-only report copy and its digest; perform analysis on a separate working copy. Prefer an
encrypted volume whose key can be destroyed at retention expiry; file deletion alone is not a
reliable secure-erasure method on SSDs or snapshots. Access logs and backups of the evidence store
must follow the same retention and least-privilege policy.

Never commit the database, checksum file, handoff note, source map containing production mappings,
supplemental manifest, full report, or excerpts containing real Keys/row locators. A GitHub update
may contain only a privacy-safe summary: tool version/commit, success or failure class, counts that
the owner approves for disclosure, and opaque approval references.

## Abort conditions

Abort and preserve evidence without further processing if any of these occurs:

- deployed commit or working tree is not the approved release;
- the backup command, archive test, SQLite checks, or schema-anchor check fails;
- a hash differs at any boundary;
- the API cannot be restored after an approved stop;
- the destination is not encrypted/private or network isolation cannot be established;
- the inventory detects database mutation, corrupt JSON that requires review, unresolved known-host
  URLs, metadata conflicts, missing owners/assets, or any other blocking/manual-review finding;
- the requested next step would require COS access, a production write, configuration change, or
  disclosure not covered by a separate approval.
