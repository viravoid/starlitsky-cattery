# Standard COS migration runbook

This runbook prepares a controlled migration from the legacy lightweight bucket to standard
Tencent COS. It does not authorize production writes, configuration changes, deployment, bucket
deletion, or PR merge.

## Safety model

- `STORAGE_BUCKET` is the destination for new browser-direct uploads only.
- Managed reads use `metadata_json.upload.bucket`; that bucket must equal `STORAGE_BUCKET` or appear
  in the server-side `STORAGE_READ_BUCKETS_JSON` allowlist.
- Records without a bucket first use an exact configured storage URL origin match, then the explicit
  `STORAGE_LEGACY_BUCKET` fallback. If neither is available, the stored URL is returned unchanged.
- Unknown bucket names are rejected. Client input cannot select bucket, endpoint, or credentials.
- The read allowlist inherits server-side credentials. Never put access keys in its JSON.
- Copy and database switching are separate commands. Both default to dry-run. Every write requires
  an operation-specific confirmation, an exact target confirmation, and matching host/CLI
  environment declarations. Production additionally requires `--confirm-production`.
- The host must explicitly set `COS_MIGRATION_RUNTIME_ENVIRONMENT` to `staging` or `production`.
  There is no writable default, and `--write-environment` must exactly match it. `NODE_ENV` is only
  an additional consistency check and is never the source of write authorization.
- No code in this change deletes source objects or changes bucket ACL/CORS.

Example non-secret shape (values must be supplied through the approved environment process):

```dotenv
STORAGE_BUCKET=standard-target-bucket
STORAGE_LEGACY_BUCKET=legacy-source-bucket
STORAGE_READ_BUCKETS_JSON=[{"bucket":"legacy-source-bucket","provider":"cos","region":"ap-chengdu"}]
```

The current miniapp production-domain constants still name the legacy host. Do not change them as
part of preparation. During the approved migration window, add both the legacy and standard COS
hosts to WeChat request/download legal domains; after the observation period, remove the legacy host
in a separate reviewed release.

## 1. Preparation and read-only inventory

User approval is required before reading production database or bucket inventory with production
credentials.

1. Confirm a least-privilege CAM identity can list/read the source and list/read/write/head the
   target. Do not replace the existing production root secret automatically.
2. Review COS request, storage, egress, and retrieval pricing/budget alerts.
3. Take a consistent SQLite backup while database writes are quiesced long enough to make the
   backup valid. Record its hash and retention location; do not commit it.
4. Capture the old bucket's read-only object listing.
5. Generate the joined database/object inventory:

```powershell
npm run media:cos-migration -- inventory `
  --source-bucket legacy-source-bucket `
  --target-bucket standard-target-bucket `
  --output cos-migration-inventory.json
```

The inventory contains media ID, object key, declared and observed bucket, stable source and
thumbnail URLs, database size/MIME/checksum, storage list/HEAD metadata, bindings, record status,
deleted state, duplicate keys, missing records, orphan source objects, and exact legacy-host
references across every current Prisma JSON field. `Cat.story_json` and `FixedPage.content_json`
have exact-path automatic switching; a legacy URL in any other JSON field blocks switch-plan
generation for explicit review instead of being silently skipped. JSON strings are recognized only
when the entire value is a URL with an exact configured source origin and object path. Encoded paths
are decoded to the object key and query/fragment components are preserved. Similar hostnames and
legacy-looking prose are not rewritten.

Every copy attempt reads the source bytes and computes SHA-256. An existing or newly written target
is then read back and must produce the same SHA-256; size, MIME, ETag, a successful HTTP response, or
an absent historical checksum can never substitute for this comparison. A JSON URL can enter the
switch plan only when its parsed object key has that byte-verification evidence in the matching copy
report. Untracked, orphan, missing, changed, unreadable, or unverified objects block plan generation
and are listed with a reason.

Reconcile every missing object, duplicate key, orphan, pending/rejected item, archived/deleted item,
and checksum mismatch before writes. The inventory hash binds later reports to this exact snapshot.

## 2. Staging rehearsal

1. Use two non-production buckets and a copied/synthetic database.
2. Run copy without `--apply`; confirm target objects and database are unchanged.
3. Simulate a failed object write and retry the same inventory. Failed items must not enter the
   switch plan.
4. Run an authorized staging copy:

```powershell
npm run media:cos-migration -- copy `
  --inventory cos-migration-inventory.json `
  --output cos-migration-copy-report.json `
  --apply --confirm-object-write `
  --confirm-target-bucket standard-target-bucket `
  --write-environment staging
```

5. Repeat the same command. Existing target objects are read and SHA-256 compared with freshly read
   source bytes before being skipped. Any byte, size, or MIME mismatch is a conflict, not success.
6. Build the per-record switch plan:

```powershell
npm run media:cos-migration -- switch-plan `
  --inventory cos-migration-inventory.json `
  --copy-report cos-migration-copy-report.json `
  --output cos-migration-switch-plan.json
```

7. Dry-run the database switch, then apply it only in staging:

```powershell
npm run media:cos-migration -- switch --plan cos-migration-switch-plan.json
npm run media:cos-migration -- switch --plan cos-migration-switch-plan.json `
  --output cos-migration-switch-report.json `
  --apply --confirm-database-write `
  --confirm-database-url-sha256 <sha256-of-exact-DATABASE_URL> `
  --write-environment staging
```

Calculate the database target fingerprint from the process environment without printing the URL or
placing credentials in command history:

```powershell
node -e "const c=require('node:crypto');process.stdout.write(c.createHash('sha256').update(process.env.DATABASE_URL||'').digest('hex'))"
```

The switch transaction updates only records whose object copy was verified. It checks each
`updated_at` value from inventory, preserves IDs/bindings/sort/visibility/presentation data, and
rewrites only enumerated legacy URL fields and exact JSON paths. Any concurrent change aborts the
transaction; there is no whole-database string replacement. Repeating an already completed switch
is idempotent when every selected field still equals the plan.

## 3. New-upload acceptance in staging

Verify the complete browser path, not only OPTIONS:

1. API authenticates/authorizes and returns a short-lived PUT signed for the standard bucket.
2. Browser preflight succeeds from the Admin origin.
3. Browser PUT succeeds with the signed content type and no server secret is exposed.
4. API HEAD completion verifies existence, exact byte count, allowed MIME, and requested MIME/size.
5. Media becomes active and the intended cat cover/carousel/fixed-page/community binding is kept.
6. Admin reads the signed standard-bucket URL.
7. Miniapp reads both an unswitched legacy record and a switched/new standard record.
8. WeChat trial validates both COS hostnames, real devices, cache behavior, and review implications.

## 4. Production copy and cutover (separate approvals)

Each numbered write/configuration action requires explicit user approval at that time.

1. Approve production allowlist/legacy fallback configuration and deploy the compatibility code.
2. Approve a read-only production inventory and reconcile it.
3. Set `COS_MIGRATION_RUNTIME_ENVIRONMENT=production` through the approved runtime configuration.
   Approve production target-bucket object writes. The production copy command requires
   `--apply --confirm-object-write --confirm-target-bucket <exact-target-bucket>
--write-environment production --confirm-production`; save its immutable report. The flags are
   safeguards and evidence of target selection, not substitutes for the separate human approval.
4. Prevent missed uploads using one of these reviewed controls:
   - preferred: a short Admin/community media-upload freeze for the final delta; or
   - keep uploads on the legacy bucket, regenerate inventory, and copy all records created/updated
     after the first inventory cutoff before switching.
5. Approve the final delta copy and verification.
6. Approve per-record database switching. The production switch command requires
   `--apply --confirm-database-write --confirm-database-url-sha256 <exact-current-fingerprint>
--write-environment production --confirm-production`. A missing environment declaration, target
   mismatch, operation confirmation, or production confirmation stops before object/database writes.
7. Approve changing `STORAGE_BUCKET` so subsequent browser-direct uploads target standard COS.
8. Execute the full acceptance checklist above and begin the observation period.

Do not restore an old database backup as routine rollback after new media writes have resumed; that
would discard new media and business changes. The applied switch output records the post-switch
concurrency tokens. Generate an audited inverse plan from the exact forward plan and report:

```powershell
npm run media:cos-migration -- rollback-plan `
  --plan cos-migration-switch-plan.json `
  --switch-report cos-migration-switch-report.json `
  --output cos-migration-rollback-plan.json
```

Dry-run and, after separate approval, apply that plan through the normal `switch` command. It touches
only the original per-record fields and exact JSON paths, so post-cutover rows are preserved. First
re-verify the corresponding legacy objects. If upload acceptance fails, stop new uploads, keep both
buckets readable, and repair forward or switch only affected records back.

## 5. Observation and eventual retirement

During the observation period, monitor read-signing errors, HEAD completion failures, missing media,
Admin upload errors, miniapp download failures, COS costs, and new legacy-bucket writes. Retain the
SQLite backup, inventories, copy reports, and switch plan outside Git.

Only after a separately approved retention period and a fresh zero-difference inventory may the old
bucket be considered for retirement. Disabling legacy reads, removing WeChat legacy domains,
revoking legacy CAM permissions, and deleting any old object are separate destructive changes and
are not authorized by this runbook or PR.
