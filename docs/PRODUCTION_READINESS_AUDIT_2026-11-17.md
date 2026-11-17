# Production readiness audit — 2026-11-17

This is a read-only production audit and isolated rehearsal. No production service,
database, Nginx configuration, Admin asset, COS object, or WeChat release was changed.

## Observed versions

| Component                      | Observed version                                                 | Evidence and limit                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub main                    | `e343cded4d4bf2d1466b2475ce64b2bc6fce7c65`                       | Remote main ref; Release gates passed.                                                                                                                   |
| Production API                 | `70976579e58598bd6a523b297f4d94869c75ad87`                       | systemd PID 1237959 ran Node with cwd equal to active release symlink; all 580 tracked source files matched that commit after line-ending normalization. |
| Production Admin               | `70976579e58598bd6a523b297f4d94869c75ad87`                       | Nginx root was `/opt/starlitsky/app/dist/admin`; rebuilt from that commit with production API URL, all 3 asset SHA-256 hashes matched.                   |
| Trial API                      | `81f1af32cd7d6ff67e6050487f829c7674b7db0e` (source corroborated) | systemd process cwd was that archive; 3 selected API source files matched. Full release-tree check was not run.                                          |
| WeChat trial package           | **UNKNOWN**                                                      | Current platform session requires QR login; prior upload records do not establish current status.                                                        |
| WeChat formal package / review | **UNKNOWN**                                                      | Current platform session requires QR login.                                                                                                              |

The production API and Admin are a matching older pair. The API health endpoint has
no commit identifier; `scripts/verify-release-readonly.py` provides a reproducible
artifact and process check. From a clean checkout of the candidate SHA, build Admin
with `VITE_API_BASE_URL=https://api.starlitskycattery.top`, then run
`python scripts/verify-release-readonly.py --commit <full-SHA>`. It only reads the
server and fails on source or Admin hash mismatch. A future release manifest injected
at packaging time would make routine version checks easier; it must identify both
API source and Admin bundle without exposing configuration.

## Database and recovery

Production uses `/opt/starlitsky/data/starlitsky.sqlite`. Its `_prisma_migrations`
contained 12 finished, non-rolled-back entries through
`20261027190000_unlisted_parent_cat_claims`. Main contains 14 migrations. Pending:

1. `20261030090000_parent_application_gender` adds nullable gender to applications,
   users and parent profiles, plus nullable city and WeChat contact to users.
2. `20261114180000_parent_admin_events` adds an audited parent-operation table and
   index, revokes surplus simultaneously active parent role grants, then adds a
   partial unique index. This is a data-changing migration. The production read-only
   query found zero duplicate active parent grants at audit time.
3. The proposed idempotency fix adds
   `20261117190000_litter_create_idempotency`: two nullable litter columns and a
   unique index. This is **not in main** until its PR is merged. Existing litter
   records retain null keys.

The earlier `20261027180000_direct_parent_applications` migration rebuilt
`parent_applications` and `parent_profiles`; production has already applied it.
The two main-pending migrations do not rebuild tables or delete user, cat, media,
litter, parent or community rows. The parent role update is conditional. The proposed
litter migration is additive. Production migration state must be rechecked at the
actual cutover, as it may change after this audit.

A protected, local copy was created from a production **read-only** SQLite dump; it
was never placed in Git. Before migration, `PRAGMA integrity_check` returned `ok`
and `PRAGMA foreign_key_check` returned no rows. Main's two migrations and the
proposed litter migration applied successfully in isolation. Counts before and after
were identical: users 7, cats 25, litters 1, parent applications 0, parent profiles
0, media assets 156, posts 0, user roles 7. The migrated copy had 15 finished
migrations, `integrity_check=ok`, and zero foreign-key violations. The new API started
against it: `/health` and `/litters` returned 200; unauthenticated Admin dashboard
returned 401. The old `70976579` Prisma client passed a read smoke against the
migrated copy, supporting code-only rollback. This does not prove every old API write
path against all future data.

Failure rehearsal used a separate copy with a conflicting `parent_admin_events`
table. Prisma applied the first pending migration, then stopped with P3018 on the
second. Replacing that **isolated, still unwritten** failed copy from the preserved
pre-migration copy restored byte-identical data, 12 finished migrations,
`integrity_check=ok`, and zero foreign-key violations.

The three rehearsal SQLite files remain in an Administrator-only OS temp directory
outside this repository. The automated command policy rejected deletion outside the
workspace. ACL inspection showed only SYSTEM, Administrators and owner rights. The
exact local path is given in the private operator handoff, not in Git. The operator
should remove the directory after confirming this report; do not attach or commit
these files.

Recovery rules:

- **Before writes resume:** keep API stopped; preserve the failed file and logs;
  restore the verified pre-migration snapshot only if schema recovery is needed.
  Recheck integrity, foreign keys, counts and migration status before service start.
- **Code rollback:** switch API and Admin back to the verified old release; leave the
  additive migrated schema intact if the old code passes smoke. Reverting code does
  not itself revert schema or data.
- **After writes resume:** do not overwrite the live file with a pre-deployment
  backup. Stop further writes, preserve a fresh current snapshot, and use a reviewed
  forward repair or record-level replay that retains new business records.

## Litter POST and security checks

Main's `POST /litters` inserts without server-side request identity or a uniqueness
constraint. Two keyless identical POSTs produce two litters; the browser's disabled
save control does not protect independent clients or lost responses. The proposed
fix stores a hash of actor plus optional `Idempotency-Key` under a unique SQLite
index. Same actor/key/body reuses the litter; same key with different body returns
409; different keys permit legitimate same-name litters. Old keyless clients still
work and therefore retain the duplicate-retry risk until upgraded. Litter creation
does not itself create kittens or upload media, so duplicate records are the primary
direct consequence; later associations could be split between those records.

The synthetic HTTP verification covered sequential and concurrent duplicate POST,
discarded first response, a subsequent network retry, changed body, different key,
keyless compatibility, and ordinary-user 403. API and Admin typechecks, Admin build,
Prisma validate/diff, migration smoke, security and cat-admin regression passed.

Production read-only checks: `/admin/users` without a session returned 401; an
allowed Admin origin received CORS while an unrelated origin did not. HTTPS
certificate verification passed; Admin root and hash route returned 200. The live
Admin bundle called `https://api.starlitskycattery.top`. The production database
had one active Admin role and no active parent roles. No production login or mutation
was attempted. Existing authenticated session, parent disable, cross-user access and
real Admin uploads therefore remain production smoke items after authorization.

Production COS configuration selected the current media bucket in Chengdu and kept
the legacy bucket as a read source. Signed reads expire after 3600 seconds and
upload URLs after 600 seconds. Credential presence was confirmed without exposing
their values. Effective IAM scope, bucket policy, upload failure behavior in the
live environment, and whether trial and production credentials overlap remain
unverified; inspect policy read-only before cutover and use synthetic media only
after separate deployment approval. No COS object was changed in this audit.

Admin asset names are content-hashed and currently cached for seven days. The HTML
entry has no explicit `no-store` or short cache header. Preserve old hashed assets
during the switch, serve the new HTML only after the new API is healthy, and verify
cache behavior and deep-link refresh. The existing in-place deployment helper is
not an atomic release switch and should not be used for this cutover.

## WeChat and phone status

The current WeChat platform page showed QR login, so current trial version/time,
QR validity, request/download/upload legal domains, review, formal release, filing
status/rejection reason, phone API eligibility, quota, billing and privacy-guide
status are **UNKNOWN**. The repo AppID is `wx6d3a94b9d6eadeaa`; this identifies
configuration, not platform state. Historical QR images and upload logs are not
current evidence. The负责人 must log in to the platform for a read-only review; no
filing resubmission, review submission or formal publication is authorized here.

Production `WECHAT_PHONE_VERIFICATION_ENABLED=false`; trial API has it `true`.
Actual trial phone calls were not made. The service distinguishes manually entered
numbers from `wechat_verified`; Admin edits reset source to `admin_entered` and
clear verification time. Phone verification does not grant parent identity or cat
ownership. Actual free balance, current price, interface eligibility and privacy
setup must be read from the account before any paid verification. Enabling it needs
separate authorization; switch it off with the same feature flag if necessary.

## Lint and release decision

Full Windows `npm run lint` **failed**: 91,950 errors and 6 warnings; 91,944 errors
were CRLF/Prettier and 6 were pre-existing `any` errors in
`apps/miniapp/pages/home/index.ts`. Changed source files passed ESLint with the
Prettier rule disabled, and `git diff --check` passed. Do not reformat the repo to
make the full lint appear green. Release gates currently do not run full lint.

**BLOCKED for production deployment approval** until the proposed idempotency PR
passes Release gates, is reviewed and merged, and its migration is included in the
approved release. Production and trial code are older than main. WeChat formal
release status is independently blocked by missing current platform evidence.

Controlled cutover, only after explicit production authorization:

1. Freeze a reviewed SHA and build API dependencies and Admin in a **new immutable
   release directory**; verify Admin's API URL and source/artifact hashes. Retain the
   existing release and its hashed static assets.
2. Obtain maintenance window and write freeze. Recheck systemd/Nginx paths, env
   presence, production migration ledger, SQLite integrity/foreign keys, storage
   policy, and available disk space. Stop API writes. Make a verified SQLite online
   backup and preserve a separate copy; test that it can be read.
3. Run only the reviewed, ordered pending Prisma migrations against production while
   writes are stopped. Verify status, integrity, foreign keys and key counts. On any
   failure, keep service stopped and follow the recovery rules above.
4. Switch the active API release symlink, restart API, and verify exact process cwd,
   health and authenticated read smoke. Then switch Admin HTML/assets with old
   hashed assets retained. Verify TLS, CORS, login, roles, parent visibility, media
   signed reads, Admin navigation and the selected WeChat trial compatibility.
5. Resume writes only after checks pass. Watch errors and business records. Roll
   code back to the prior release if needed; never restore the old SQLite snapshot
   after new writes without a reviewed data-preserving recovery plan.

Approval needed: merge the reviewed PR; execute production maintenance/backup,
migration, API/Admin switch and restart; obtain a WeChat platform read-only login or
screenshots from the负责人. Separate approval is required for any real phone charge,
filing submission, WeChat review or formal release.
