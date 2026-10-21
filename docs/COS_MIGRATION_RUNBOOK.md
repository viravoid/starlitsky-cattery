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
- Never put access keys in the read-allowlist JSON. The standard target uses
  `STORAGE_ACCESS_KEY_ID` / `STORAGE_ACCESS_KEY_SECRET` (and optional `STORAGE_SESSION_TOKEN`). The
  Lighthouse source uses the separate `STORAGE_LEGACY_ACCESS_KEY_ID` /
  `STORAGE_LEGACY_ACCESS_KEY_SECRET` (and optional `STORAGE_LEGACY_SESSION_TOKEN`). This permits a
  source identity limited to object HEAD/GET and a distinct target identity limited to the required
  destination operations.
- Copy and database switching are separate commands. Both default to dry-run. Every write requires
  an operation-specific confirmation, an exact target confirmation, and matching host/CLI
  environment declarations. Production additionally requires `--confirm-production`.
- The host must explicitly set `COS_MIGRATION_RUNTIME_ENVIRONMENT` to `staging` or `production`.
  There is no writable default, and `--write-environment` must exactly match it. `NODE_ENV` is only
  an additional consistency check and is never the source of write authorization.
- No code in this change deletes source objects or changes bucket ACL/CORS.

Example non-secret shape (values must be supplied through the approved environment process). The
source endpoint is the standard regional COS domain verified for the Lighthouse bucket. Never use
`.light-cos.com`. `publicBaseUrl` and every `historicalBaseUrls` entry must be an exact URL base
found in stored records; they are URL-to-Key mappings, not alternate API endpoints:

```dotenv
STORAGE_BUCKET=starlitsky-cattery-media-1480740947
STORAGE_REGION=ap-chengdu
STORAGE_ACCESS_KEY_ID=<target-only-secret-id>
STORAGE_ACCESS_KEY_SECRET=<target-only-secret-key>
STORAGE_LEGACY_BUCKET=starlitsky-cattery-1480740947
STORAGE_LEGACY_ACCESS_KEY_ID=<source-read-only-secret-id>
STORAGE_LEGACY_ACCESS_KEY_SECRET=<source-read-only-secret-key>
STORAGE_READ_BUCKETS_JSON=[{"bucket":"starlitsky-cattery-1480740947","provider":"lightcos","region":"ap-chengdu","endpoint":"https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com","publicBaseUrl":"https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com","historicalBaseUrls":[]}]
```

`provider: "lightcos"` now means "Lighthouse-origin bucket accessed through standard COS object
APIs". It uses `cos-nodejs-sdk-v5@3.0.0` for HEAD, bounded streaming GET, temporary-session-token
signing, and presigned GET. Bucket listing is deliberately unsupported. PUT and DELETE stop before
an SDK request. The standard COS target continues to use the existing accepted implementation.

## Verified protocol boundary

The owner previously performed exactly one HEAD and one ranged GET against
`starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com` with the official SDK. Both succeeded and
the 656260-byte object produced SHA-256
`4cece66a185b2eba2d04c5a8a0b011332521f248e0ec8b32b3b7fa884ae6c35c`. That evidence establishes
object-level readability through the standard COS endpoint. It does not establish bucket-list
support or full-bucket contents.

- The runtime requires bucket name with APPID, `ap-chengdu`, virtual-host style, and exactly
  `https://<Bucket-APPID>.cos.<region>.myqcloud.com` for a Lighthouse source.
- Inventory and copy never call GetBucket/ListObjects for that provider.
- 404 means the specific Key is missing. Permission and other SDK failures abort the inventory/copy;
  they are not converted to absence.
- Object bodies are consumed as streams with a hard byte ceiling. Copy concurrency is four and
  inventory HEAD concurrency is eight. The selected byte ceiling is embedded in and hash-bound to
  the inventory (default 10 MiB; override with `--max-object-bytes`).

This PR performs synthetic SDK and storage-response tests only. It does not repeat the real reads,
read production data, or validate the future least-privilege identities.

### Bounded real read-only probe (requires separate approval)

The retained probe is object-only and cannot write. It requires an exact Key, expected size,
expected SHA-256, configured standard endpoint confirmation, byte limit, and explicit confirmation.
It performs exactly one HEAD and one bounded GET through the official SDK. Output hashes the Key and
never prints credentials or signed URLs. Do not run it without separate approval; it was not run in
this change.

Do not run this command until the owner separately approves the exact endpoint, Key, byte limit,
expected values, time window, and least-privilege identity:

```powershell
npm run probe:lightcos-read-only -- `
  --source-bucket <exact-BucketName-APPID> `
  --object-key <exact-approved-key> `
  --confirm-endpoint <exact-standard-COS-endpoint> `
  --expected-size-bytes <approved-size> `
  --expected-sha256 <approved-sha256> `
  --max-download-bytes <approved-limit> `
  --confirm-read-only-probe
```

The source identity is separate from the target identity and needs only the object HEAD/GET
permissions accepted by the actual Lighthouse bucket. Temporary credentials are supported through
`STORAGE_LEGACY_SESSION_TOKEN`.

## 1. Preparation and read-only inventory

User approval is required before reading production database or bucket inventory with production
credentials.

Start with the fully offline database-reference workflow in
`docs/OFFLINE_IMAGE_INVENTORY.md`. It reads only an explicit SQLite backup and performs no COS
request. The `media:cos-migration -- inventory` command below is a later **online object-validation
step**: it automatically performs source and target object `HEAD` calls for every discovered Key.
Do not run that command when only offline preparation is authorized.

1. After separate approval, confirm a least-privilege source identity can perform only object HEAD
   and GET on the required source keys. Target write permissions belong to a separate identity and
   are a later, separately approved step. Do not use a root key.
2. Review COS request, storage, egress, and retrieval pricing/budget alerts.
3. Take a consistent SQLite backup while database writes are quiesced long enough to make the
   backup valid. Record its hash and retention location; do not commit it.
4. Quiesce relevant database writes (or use a reviewed database snapshot) so the transaction-level
   inventory snapshot and backup refer to the same operational point.
5. Generate the database-reference inventory. This performs object HEAD requests only for discovered
   keys and does not attempt bucket listing:

```powershell
npm run media:cos-migration -- inventory `
  --source-bucket legacy-source-bucket `
  --target-bucket standard-target-bucket `
  --max-object-bytes 10485760 `
  --output cos-migration-inventory.json
```

The deterministic Key set covers `MediaAsset` upload metadata/source URLs, thumbnails, every media
binding's referenced asset, `User.avatar_url`, `Cat.story_json`, `FixedPage.content_json`, media
metadata, parent-application JSON, kitten structure JSON, litter color JSON, and selection-form JSON.
Every Key is HEADed in source and target. `Cat.story_json`, `FixedPage.content_json`, media metadata,
and `User.avatar_url` have exact optimistic-concurrency switch paths. Legacy URLs in other JSON
fields block for explicit review. Encoded paths are decoded, query/fragment components are
preserved, similar hostnames are not rewritten, and a metadata/URL Key mismatch blocks.

The inventory also records:

- missing Keys, oversized source objects, duplicate-Key metadata conflicts, unresolved strings that
  contain an exact configured legacy origin, and external HTTP(S) URLs for review;
- `coverage.fullBucketCoverage = "unknown"`, `bucketListingAttempted = false`, and
  `orphanObjectCoverage = "unknown"`;
- `orphanSourceObjects = null`, not an empty claim that no orphans exist.

Known Keys outside the database may be added only through a reviewed supplemental manifest:

```json
{
  "schemaVersion": 1,
  "approvalReference": "change ticket or separate approval reference",
  "objects": [
    {
      "objectKey": "exact/source/key.jpg",
      "sizeBytes": 656260,
      "mimeType": "image/jpeg",
      "checksum": "4cece66a185b2eba2d04c5a8a0b011332521f248e0ec8b32b3b7fa884ae6c35c",
      "evidence": "reviewed material manifest and Key mapping"
    }
  ]
}
```

Every object needs non-empty source evidence, and the manifest needs a non-empty approval reference.
Calculate the canonical digest and obtain separate approval for that exact digest:

```powershell
npm run media:cos-migration -- supplemental-manifest-hash `
  --supplemental-manifest cos-migration-supplemental.json
```

Then pass both the artifact and approved digest to inventory generation:

```powershell
npm run media:cos-migration -- inventory `
  --source-bucket legacy-source-bucket `
  --target-bucket standard-target-bucket `
  --supplemental-manifest cos-migration-supplemental.json `
  --approve-supplemental-manifest-sha256 <separately-approved-exact-sha256> `
  --output cos-migration-inventory.json
```

The normalized objects, approval reference, calculated digest, and approved digest are embedded in
the hash-bound inventory. A filename, unapproved digest, blank evidence, or hash without a proven
COS Key is not enough to add an object.

Repository audit boundary:

- `docs/media-source-manifests/environment-2026-09-05.json` and
  `environment-2026-10-08.json` contain filenames, hashes, sizes, and business slots but no legacy
  COS Keys or URLs. They support later hash-based reconciliation but cannot automatically enumerate
  source objects. The already verified 656260-byte hash appears in the 2026-09-05 manifest.
- `public/real-photos/**` and `apps/miniapp/assets/**` are checked-in local/bundled assets. Their
  repository paths are not assumed to be legacy COS Keys. If an import created `MediaAsset` rows,
  those rows are discovered normally; otherwise mapping requires human evidence.
- `public-content-manifest.mjs` explicitly records deferred/unextracted source images, so those
  originals remain a manual completeness item.
- An object with no database reference and no reviewed supplemental Key is an unknowable orphan.
  This tool never claims it was inventoried and never deletes it.

Inventory schema versions before v4 are rejected. Generate a fresh artifact from the approved,
quiesced database rather than editing an old JSON file.

Every copy attempt reads the source bytes and computes SHA-256. An existing or newly written target
is then read back and must produce the same SHA-256; size, MIME, ETag, a successful HTTP response, or
an absent historical checksum can never substitute for this comparison. A JSON URL can enter the
switch plan only when its parsed object key has that byte-verification evidence in the matching copy
report. Every discovered or supplemental source object is a copy action. Missing, changed,
oversized, unreadable, failed, not-yet-processed, or SHA-256-unverified objects block plan generation
and receive a stable exclusion subject. Existing targets are GET-read and SHA-256 compared before
they can be `verified-existing`; size/MIME/ETag/upload success cannot substitute. Copy results
outside the bound inventory are rejected.

Reconcile every missing object, duplicate key, pending/rejected item, archived/deleted item,
thumbnail, user avatar, JSON reference, external URL, supplemental item, and checksum mismatch
before writes. Consistent duplicate
keys are migrated once and all referencing rows are switched; conflicting size/MIME/checksum
metadata blocks. The inventory hash binds later reports to this exact snapshot.

### Required limited-coverage acknowledgement

This inventory can authorize only a safe switch for the known database and approved supplemental
references. It does **not** prove that the entire legacy bucket was inventoried or migrated. Before
generating a switch plan, create a separately reviewed acknowledgement bound to the exact inventory:

```json
{
  "schemaVersion": 1,
  "inventorySha256": "<exact inventorySha256>",
  "switchScope": "known-referenced-objects-only",
  "fullBucketCoverage": "unknown",
  "approvalReference": "change ticket or separate approval reference"
}
```

Calculate its canonical digest and obtain separate approval for that exact digest:

```powershell
npm run media:cos-migration -- coverage-acknowledgement-hash `
  --coverage-acknowledgement cos-migration-coverage-acknowledgement.json
```

Pass the acknowledgement and approved digest to every `switch-plan` command:

```powershell
  --coverage-acknowledgement cos-migration-coverage-acknowledgement.json `
  --approve-coverage-acknowledgement-sha256 <separately-approved-exact-sha256>
```

Missing, stale, malformed, or digest-mismatched acknowledgement data blocks plan generation. The
plan records `switchScope = "known-referenced-objects-only"` and
`fullBucketMigrationComplete = false`; it cannot be used as evidence that the legacy bucket is empty
or ready for retirement. Switch-plan schema versions before v3 are rejected.

### Explicit exclusions

There are no automatic exclusions. If a record/object/reference is intentionally not migrated,
create a separately reviewed JSON artifact:

```json
{
  "schemaVersion": 1,
  "inventorySha256": "<exact inventorySha256>",
  "exclusions": [
    {
      "key": "media:<exact-media-id>",
      "reason": "specific business/data reason",
      "approvalReference": "change ticket or separate approval reference"
    }
  ]
}
```

Allowed subjects are exact items from the bound inventory: `media:<id>`,
`source-object:<object-key>`, `supplemental-object:<object-key>`, or a reported `reference:...`,
`unresolved-reference:...`, or `external-reference:...` key. Unknown subjects, duplicates, blank
reasons, and blank approval references fail. Calculate the canonical digest:

```powershell
npm run media:cos-migration -- exclusions-hash `
  --exclusions cos-migration-exclusions.json
```

Obtain a separate approval for that exact digest, then pass both the artifact and approved digest:

```powershell
npm run media:cos-migration -- switch-plan `
  --inventory cos-migration-inventory.json `
  --copy-report cos-migration-copy-report.json `
  --coverage-acknowledgement cos-migration-coverage-acknowledgement.json `
  --approve-coverage-acknowledgement-sha256 <separately-approved-exact-sha256> `
  --exclusions cos-migration-exclusions.json `
  --approve-exclusions-sha256 <separately-approved-exact-sha256> `
  --output cos-migration-switch-plan.json
```

The plan embeds the approved exclusions, digest, complete findings, verified object keys, duplicate
keys, and the explicit unknown-coverage statement for audit. Excluding a failed media record does
not silently exclude its source object or another reference; each affected subject must have an
explicit conclusion.

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
  --coverage-acknowledgement cos-migration-coverage-acknowledgement.json `
  --approve-coverage-acknowledgement-sha256 <separately-approved-exact-sha256> `
  --output cos-migration-switch-plan.json
```

7. Dry-run the database switch, then apply it only in staging:

```powershell
npm run media:cos-migration -- switch --plan cos-migration-switch-plan.json
npm run media:cos-migration -- switch --plan cos-migration-switch-plan.json `
  --output cos-migration-switch-report.json `
  --apply --confirm-database-write `
  --confirm-database-url-sha256 <sha256-of-exact-DATABASE_URL> `
  --backup-file <separate-sqlite-backup-file> `
  --confirm-backup-sha256 <sha256-of-that-backup> `
  --write-environment staging
```

Calculate the database target fingerprint from the process environment without printing the URL or
placing credentials in command history:

```powershell
node -e "const c=require('node:crypto');process.stdout.write(c.createHash('sha256').update(process.env.DATABASE_URL||'').digest('hex'))"
```

Before any applied switch (forward or rollback), the CLI requires a separate SQLite backup file, an
exact approved SHA-256, successful read-only `PRAGMA integrity_check` and
`PRAGMA foreign_key_check`, plus the Prisma migration table and core `User`/`MediaAsset` tables. A missing,
empty, corrupt, hash-mismatched, structurally unrelated, or live-database path fails before the
switch transaction. These checks cannot prove snapshot recency, so the quiesced-backup procedure
and separate digest approval remain mandatory. Keep the immutable backup and its digest with the
inventory/report evidence.

The inventory binds a SHA-256 snapshot of every migration-relevant database row and field, including
all media rows/bindings and every inspected JSON/avatar field. The switch transaction updates only
records whose object copy was verified, normalizes its own exact planned replacements, and compares
the complete current snapshot with the inventory before commit. A new media row, a new legacy JSON
reference, a deletion, or an unplanned change therefore rolls back the entire transaction instead of
being left outside the plan. It also checks each selected `updated_at` value, preserves
IDs/bindings/sort/visibility/presentation data, and rewrites only enumerated legacy URL fields and
exact JSON paths. Repeating an already completed switch is idempotent when every selected field still
equals the plan. Rollback intentionally remains per-record so post-cutover rows are preserved.

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
6. Approve the exact limited-coverage acknowledgement digest, generate the per-record switch plan,
   and approve per-record database switching. This is approval to switch known references, not a
   declaration that the legacy bucket was fully migrated. The production switch command requires
   `--apply --confirm-database-write --confirm-database-url-sha256 <exact-current-fingerprint>
--backup-file <separate-backup> --confirm-backup-sha256 <exact-backup-sha256>
--write-environment production --confirm-production`. A missing environment declaration, target
   mismatch, backup verification, operation confirmation, or production confirmation stops before
   object/database writes.
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
re-verify the corresponding legacy objects and take/verify a new pre-rollback SQLite backup. The
offline regression covers exact media/JSON/avatar restoration, missing rollback state rejection,
preservation of post-cutover rows, and corrupt/hash-mismatched backup rejection. This is not a real
production rollback rehearsal. If upload acceptance fails, stop new uploads, keep both buckets
readable, and repair forward or switch only affected records back.

## Miniapp domain inventory

The checked-in miniapp currently has one hard-coded COS hostname,
`starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`, in
`apps/miniapp/config/env.ts`. The automated verifier proves only that:

- API and COS uploads use `wx.request`; uploads do not use `wx.uploadFile`.
- Remote images/preview paths exist and there is no direct `wx.downloadFile` call.
- The checked-in legal-domain matrix includes that hostname for request/download and the API host
  for request.

The standard COS source hostname has been verified for object HEAD/GET, but these code assertions do
**not** prove that WeChat has accepted it or that every stored row uses that exact base. The target
hostname is documented in `COS_UPLOAD_ACCEPTANCE.md`; changing the checked-in matrix or WeChat
console remains a separate approved release. Before cutover, inventory the real stored URL bases,
configure any exact historical aliases, and validate both old and new request/download domains on a
WeChat trial/release and real devices.

## 5. Observation and eventual retirement

During the observation period, monitor read-signing errors, HEAD completion failures, missing media,
Admin upload errors, miniapp download failures, COS costs, and new legacy-bucket writes. Retain the
SQLite backup, inventories, copy reports, and switch plan outside Git.

The database-reference inventory cannot authorize bucket retirement because orphan coverage is
unknown. Retirement requires a separately obtained authoritative full-bucket inventory/export (or
equivalent provider evidence), reconciliation against the database/supplemental manifest, and an
approved retention period. Disabling legacy reads, removing WeChat legacy domains, revoking legacy
CAM permissions, and deleting any old object are separate destructive changes and are not
authorized by this runbook or PR.
