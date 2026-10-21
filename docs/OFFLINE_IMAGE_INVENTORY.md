# Offline historical-image inventory

This workflow prepares an evidence-based list of image references from a separately obtained SQLite
backup. It does not connect to the production database, load COS configuration or credentials, call
COS, validate that an object exists, copy an object, change production configuration, or claim full
legacy-bucket coverage.

## Proven deployment boundary

Repository evidence describes the intended production layout:

- `DATABASE_URL` is a `file:` URL and the documented production example is
  `/opt/starlitsky/data/starlitsky.sqlite`.
- the systemd service runs from `/opt/starlitsky/app` as the `starlitsky` user;
- `deploy/production/scripts/backup-sqlite.sh` uses SQLite `.backup`, writes under
  `/opt/starlitsky/backups/sqlite`, compresses with gzip, and applies mode `0600`;
- deployment backs up before `prisma migrate deploy`.

Those are code and documentation facts, not observations of the real server. The actual
`DATABASE_URL`, database path, WAL state, deployed commit, applied Prisma migrations, backup
recency, backup digest, ownership, free space, and whether writes were quiesced can only be checked
on the real server by an authorized operator. This tool does not perform those checks remotely.

## Command separation

The commands have intentionally different trust boundaries:

| Stage                       | Command                            | Database                        | COS network                             | Writes                                       |
| --------------------------- | ---------------------------------- | ------------------------------- | --------------------------------------- | -------------------------------------------- |
| Offline reference discovery | `media:offline-image-inventory`    | explicit backup path, read-only | none                                    | optional new report file only                |
| Online object validation    | `media:cos-migration -- inventory` | configured Prisma database      | HEAD in source and target               | no object/database writes                    |
| Copy                        | `media:cos-migration -- copy`      | inventory artifact              | GET/HEAD/PUT when separately authorized | target objects only with apply confirmations |

The existing `media:cos-migration -- inventory` command is **not offline**. It calls `HEAD` for every
Key discovered from the database and approved supplemental manifest in both the source and target
buckets. Do not use it for the offline preparation stage.

## Inputs

1. An uncompressed, consistent SQLite backup at an explicit local path. The tool rejects `.gz`;
   decompress a protected working copy first. Never point the command at a live production path.
2. A reviewed legacy source map. It is mapping evidence only and contains no credentials:

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "id": "legacy-lightcos-primary",
      "bucket": "starlitsky-cattery-1480740947",
      "baseUrls": ["https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com"]
    }
  ]
}
```

Add a historical domain or path-prefix alias only after it is observed in the backup or supported by
separate evidence. Similar-looking hosts are not aliases. Overlapping mappings that produce
different Keys are reported as ambiguous instead of being guessed.

3. Optionally, the same approved supplemental manifest format used by the online migration. The
   exact canonical SHA-256 must be passed with the manifest. A filename, display path, hash, or
   repository path without a proven COS Key cannot be promoted into this manifest.

Calculate a supplemental digest without COS access:

```powershell
npm run media:cos-migration -- supplemental-manifest-hash `
  --supplemental-manifest cos-migration-supplemental.json
```

The digest format is shared with the offline command. The normal approval reference and exact
digest remain mandatory; the tool does not invent either.

## Run

```powershell
npm run media:offline-image-inventory -- `
  --database C:\protected\starlitsky-consistent-backup.sqlite `
  --legacy-source-map C:\protected\legacy-source-map.json `
  --output C:\protected\cos-offline-image-inventory.json
```

With a supplemental manifest:

```powershell
npm run media:offline-image-inventory -- `
  --database C:\protected\starlitsky-consistent-backup.sqlite `
  --legacy-source-map C:\protected\legacy-source-map.json `
  --supplemental-manifest C:\protected\cos-migration-supplemental.json `
  --approve-supplemental-manifest-sha256 <approved-exact-sha256> `
  --output C:\protected\cos-offline-image-inventory.json
```

The report path must not already exist and cannot equal the database path. Standard output contains
only the summary. The full report is created as a new file and includes the input database SHA-256
and a report SHA-256. The database is opened with SQLite read-only mode plus `query_only`; bytes are
hashed before and after the run and any change aborts.

## Discovery coverage

The tool inspects every application table's non-secret text/JSON columns and has explicit handling
for:

- `media_assets.source_url`, `thumbnail_url`, `metadata_json`, checksum/MIME/size metadata;
- every `media_bindings` relationship, dangling media references, and missing binding owners;
- `users.avatar_url`;
- `cats.story_json` and `fixed_pages.content_json`;
- parent-application, kitten-profile, litter, selection-application, post, and future text/JSON
  fields that contain HTTP(S) or image-like path references.

It reports configured-legacy Keys, relationship counts, duplicates, metadata/URL mismatches,
duplicate metadata conflicts, supplemental/database conflicts, invalid JSON, unresolved known-host
URLs, unassigned metadata Keys, relative image paths, external hosts, host/path-format statistics,
and manual-review items.

Unknown external URLs remain external. A relative path remains a mapping candidate. Neither is
automatically treated as a legacy-bucket object.

## Privacy and repository evidence

The report does not emit arbitrary database strings, names, application answers, URL query strings,
or raw external/unresolved URLs. It keeps a row locator, host, coarse path format, and SHA-256 of the
original value so an authorized operator can find the row without copying personal data into the
report. Known legacy object Keys are retained because they are the purpose of the inventory.

The repository-evidence section hashes checked-in `public/real-photos` files and reads
`docs/media-source-manifests`. It marks their filenames, hashes, local paths, and business slots as
manual mapping candidates. The Web Demo manifest maps local `/real-photos` paths and source
filenames; the public-content manifest explicitly defers some original images; Lovable asset
metadata identifies R2 rather than COS. None currently proves a historical COS Key. Repository
evidence therefore contributes zero automatic supplemental Keys until an operator supplies a
reviewed Key mapping and approval.

## What remains unknown

The database can reveal only stored references. It cannot reveal unreferenced/orphaned legacy
objects, deleted historical rows, objects referenced only by an unavailable old release, or files
that were uploaded but never persisted. Full-bucket coverage remains `unknown` until an
authoritative provider inventory/export or equivalent evidence is separately obtained and
reconciled.

After the offline report and mappings are reviewed, the next production action is for an authorized
operator to create a quiesced SQLite online backup, record its SHA-256, transfer the backup to the
protected offline workstation, and run this command against that copy. Online COS `HEAD` validation
is a later, separately authorized stage.
