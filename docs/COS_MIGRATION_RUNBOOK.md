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

Example non-secret shape (values must be supplied through the approved environment process). The
legacy `publicBaseUrl` must be the exact old URL base found in stored records; do not infer it from
the API endpoint:

```dotenv
STORAGE_BUCKET=standard-target-bucket
STORAGE_LEGACY_BUCKET=legacy-source-bucket-1234567890
STORAGE_READ_BUCKETS_JSON=[{"bucket":"legacy-source-bucket-1234567890","provider":"lightcos","endpoint":"https://legacy-source-bucket-1234567890.light-cos.com","publicBaseUrl":"https://legacy-domain.example"}]
```

`provider: "lightcos"` is read-only in this code. It supports signed ListObjects, HEAD, GET, and
presigned GET only. PUT and DELETE stop before an HTTP request. The standard COS target continues to
use the already accepted implementation.

## LightCOS protocol assumptions and validation boundary

The compatibility code follows these Tencent Cloud documents:

- LightCOS API requests use `<BucketName-APPID>.light-cos.com` as the documented Host. An explicit
  `endpoint` remains supported for a reviewed API endpoint. The configured `bucket` is assumed to
  be the complete `BucketName-APPID`, and requests use virtual-host style rather than path style.
- LightCOS authentication uses the COS XML HMAC-SHA1 `q-sign-*` algorithm. The implementation signs
  only the automatically sent `host` header for GET/HEAD and signs every ListObjects query
  parameter. It reuses the server-side SecretId/SecretKey configured for storage; per-bucket
  credentials and temporary session-token signing are not implemented.
- LightCOS GetBucket is ListObjects V1: the request uses `marker` and `max-keys`, and a truncated XML
  response must contain `NextMarker`. The next request sends that value as `marker`. It does not send
  standard COS/S3 V2 `list-type=2` or `continuation-token`.
- Listing asks for `encoding-type=url`; object keys and `NextMarker` are URL-decoded after XML entity
- The XML reader expects the unprefixed element names shown in the official response examples
  (`Contents`, `Key`, `IsTruncated`, and `NextMarker`). A namespaced or structurally different real
  response must fail the read-only probe and be handled before migration.
- 404 means an individual HEAD/GET object is absent. 401/403 are permission failures, not absence.
  Other non-2xx responses are errors.

All of the above has automated synthetic-response coverage only. No request in this PR was sent to a
real LightCOS bucket. The exact production API endpoint, stored legacy public/custom domain, signing
acceptance, response headers, object-key edge cases, and IAM behavior are **待真实只读验证**.

The synthetic signer test also pins one fixed Unicode/space/percent/query vector generated
independently by `cos-nodejs-sdk-v5@3.0.0`. This cross-checks the repository implementation against
Tencent's SDK; it is still not evidence that the real legacy bucket accepts the request.

### Bounded real read-only probe (requires separate approval)

The existing provider is exposed through one narrow CLI for the future real compatibility check.
It is not an inventory command and cannot write. Before it starts, it requires an allowlisted
`provider: "lightcos"` bucket, a non-empty prefix, two exact expected keys under that prefix, one of
those keys as the object probe target, an exact configured endpoint confirmation, and the explicit
`--confirm-read-only-probe` flag. The command performs exactly five requests on success:

1. `GET Bucket` with `max-keys=1` and the approved prefix.
2. `GET Bucket` with `max-keys=1`, the same prefix, and only the first response's `NextMarker`.
3. One signed `HEAD` for the approved object.
4. One Authorization-header `GET` for that object.
5. One presigned `GET` for that object.

It has no retries, uses a 10-second timeout per request, refuses redirects and cross-origin requests,
blocks every method except GET/HEAD, limits each list body to 128 KiB, defaults object downloads to
256 KiB, and has a hard 1 MiB ceiling. It compares the two GET bodies by SHA-256. Output contains
only the confirmed origin, key/prefix hashes, sizes, MIME, ETag presence, status codes, error code
when safely available, and RequestId. It never prints keys, SecretId, SecretKey, Authorization, or a
presigned URL.

Do not run this command until the owner separately approves the exact endpoint, prefix, two keys,
object key, byte limit, time window, and least-privilege identity:

```powershell
npm run probe:lightcos-read-only -- `
  --source-bucket <exact-BucketName-APPID> `
  --prefix <exact-approved-prefix> `
  --expected-first-key <exact-first-key> `
  --expected-second-key <exact-second-key> `
  --object-key <one-of-those-two-keys> `
  --confirm-endpoint <exact-HTTPS-LightCOS-API-endpoint> `
  --max-download-bytes 262144 `
  --confirm-read-only-probe
```

The command reuses `STORAGE_ACCESS_KEY_ID` and `STORAGE_ACCESS_KEY_SECRET`; the read-bucket JSON must
not contain credentials. The approved identity needs only `lightcos:GetBucket`,
`lightcos:HeadObject`, and `lightcos:GetObject` for this probe. Temporary-session-token signing is
not implemented, so a temporary key that requires `x-cos-security-token` must not be supplied until
that support is explicitly added and tested.

## 1. Preparation and read-only inventory

User approval is required before reading production database or bucket inventory with production
credentials.

1. After separate approval, confirm a least-privilege CAM identity can perform only
   `lightcos:GetBucket`, `lightcos:HeadObject`, and `lightcos:GetObject` on the source. Target write
   permissions are a later, separately approved step. Do not use a root key or a previously issued
   test key.
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
deleted state, duplicate keys and conflicting duplicate metadata, missing records, orphan source
objects, `User.avatar_url`, and exact legacy-host references across every current Prisma JSON field,
including `MediaAsset.metadata_json`. `Cat.story_json`, `FixedPage.content_json`, media metadata, and
`User.avatar_url` have exact, optimistic-concurrency switch paths. A legacy URL in any other JSON
field blocks switch-plan generation for explicit review instead of being silently skipped. JSON
strings are recognized only when the entire value is a URL with an exact configured source origin
and object path. Encoded paths are decoded to the object key and query/fragment components are
preserved. Similar hostnames and legacy-looking prose are not rewritten. If a managed media
`source_url` resolves to a different key from its upload metadata, switch planning blocks rather
than choosing one silently.

Inventories and switch plans generated before the database snapshot field was introduced are
intentionally rejected. No production inventory existed at the time of this change; future work
must generate fresh artifacts from the approved, quiesced database instead of adapting an older
JSON file by hand.

Every copy attempt reads the source bytes and computes SHA-256. An existing or newly written target
is then read back and must produce the same SHA-256; size, MIME, ETag, a successful HTTP response, or
an absent historical checksum can never substitute for this comparison. A JSON URL can enter the
switch plan only when its parsed object key has that byte-verification evidence in the matching copy
report. Every source-list object, including an orphan, is a copy action by default. Untracked,
missing, changed, unreadable, failed, not-yet-processed, or SHA-256-unverified objects block plan
generation and are listed with a stable exclusion subject. Copy results outside the bound
inventory are rejected. A successful status label without the SHA-256 evidence is not sufficient.

Reconcile every missing object, duplicate key, orphan, pending/rejected item, archived/deleted item,
thumbnail, user avatar, JSON reference, and checksum mismatch before writes. Consistent duplicate
keys are migrated once and all referencing rows are switched; conflicting size/MIME/checksum
metadata blocks. The inventory hash binds later reports to this exact snapshot.

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
`source-object:<object-key>`, or the `reference:...` key reported by switch-plan. Unknown subjects,
duplicates, blank reasons, and blank approval references fail. Calculate the canonical digest:

```powershell
npm run media:cos-migration -- exclusions-hash `
  --exclusions cos-migration-exclusions.json
```

Obtain a separate approval for that exact digest, then pass both the artifact and approved digest:

```powershell
npm run media:cos-migration -- switch-plan `
  --inventory cos-migration-inventory.json `
  --copy-report cos-migration-copy-report.json `
  --exclusions cos-migration-exclusions.json `
  --approve-exclusions-sha256 <separately-approved-exact-sha256> `
  --output cos-migration-switch-plan.json
```

The plan embeds the approved exclusions, digest, complete findings, verified object keys, duplicate
keys, and orphan keys for audit. Excluding a failed media record does not silently exclude its
source object or another reference; each affected subject must have an explicit conclusion.

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
6. Approve per-record database switching. The production switch command requires
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

Those code assertions do **not** prove that this hostname is the real LightCOS object-access domain,
that a LightCOS custom domain is configured, or that WeChat has accepted it. The expected standard
COS target hostname is documented in `COS_UPLOAD_ACCEPTANCE.md`, but changing the checked-in matrix
or WeChat console remains a separate approved release. Before cutover, the read-only probe must
identify the exact old API endpoint and the exact old public/custom hostname; then a WeChat
trial/release on real devices must validate both old and new request/download domains. Until that
evidence exists, the old domain is **待真实只读验证**.

## 5. Observation and eventual retirement

During the observation period, monitor read-signing errors, HEAD completion failures, missing media,
Admin upload errors, miniapp download failures, COS costs, and new legacy-bucket writes. Retain the
SQLite backup, inventories, copy reports, and switch plan outside Git.

Only after a separately approved retention period and a fresh zero-difference inventory may the old
bucket be considered for retirement. Disabling legacy reads, removing WeChat legacy domains,
revoking legacy CAM permissions, and deleting any old object are separate destructive changes and
are not authorized by this runbook or PR.
