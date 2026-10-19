# COS browser upload acceptance

This document defines repeatable acceptance for browser-direct uploads without using production
data. It complements `COS_MIGRATION_RUNBOOK.md`; it does not authorize a real COS write, a cloud
configuration change, a deployment, a production database read, or a migration.

## Environment finding

As of 2026-10-18, this repository does not prove that an independent staging environment exists:

- GitHub has no configured Environments and no Deployment records for this repository.
- The only tracked staging origins use `example.org` and appear in CI verifier input.
- Tracked environment files contain placeholders or localhost values; there is no staging Admin
  origin, staging API URL, staging database target, or staging bucket target.
- A green CI run proves simulated/local verification only. It is not evidence of a deployed
  staging environment or a reachable COS bucket.

Do not treat a host as staging until its owner provides all of: exact Admin origin, exact API
origin, deployment revision, disposable/non-production database identity, bucket and region,
approved credential identity, current CORS rule, and a test account with `admin` or `keeper` role.

## Three different test layers

| Layer                          | Command or probe                                                                                                             | What it proves                                                                                                                                                                          | What it does not prove                                                                                  |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Simulated service verification | `npm run verify:media-upload`, `npm --workspace @starlitsky/api run verify:private-cos-read`, `npm run verify:cos-migration` | Validation, signing shape, HEAD decisions, idempotent completion, pending expiry, allowlisted old/new bucket selection, migration guards                                                | Browser CORS, a real network PUT, COS policy, cloud DNS, cloud credentials                              |
| HTTP preflight                 | Send `OPTIONS` to the API and object URL with the exact Admin `Origin`, requested method, and requested headers              | The current endpoints return the necessary CORS response for that exact request                                                                                                         | The browser can upload, the signature is valid, the object exists, HEAD completes, or Admin can read it |
| Real browser E2E               | `npm run e2e:cos-browser` locally; the same Playwright spec against an approved staging target later                         | Chromium login/auth, API signing request, automatic COS OPTIONS, browser PUT, API HEAD, activation, binding, Admin read, failure, timeout, completion replay, and private old/new reads | Real Tencent COS until the target is explicitly changed and a restricted cloud write is authorized      |

These layers are additive. Passing one must never be reported as passing another.

## Safe local browser acceptance

Run from a clean checkout:

```powershell
npm exec --yes --package bun@1.3.14 -- bun install --frozen-lockfile
npx playwright install chromium
npm run e2e:cos-browser
```

The harness creates a random run identity under the operating-system temp directory, migrates a new
ignored `cos-browser-e2e-<run>.db` SQLite file, starts localhost-only Admin/API/COS fixture
processes, and removes the exact temporary database and run directory on teardown. The object fixture recognizes only `cos-e2e-new-bucket` and
`cos-e2e-legacy-bucket`. New object keys include a random per-run prefix. Credentials and passwords
are synthetic local constants. No Tencent endpoint, production media, or production database is
read or written.

The browser test first performs explicit HTTP preflight probes, clears that evidence, then checks
that Chromium itself issued the COS `OPTIONS` before `PUT`. It also checks that the API issued
`HEAD`, that the media became active with one business binding, that a completion replay returned
the same media and binding, that unsigned private reads failed, and that signed legacy/new reads
succeeded. Injected HTTP 503 and a stalled PUT cover failure and client timeout handling.

## Exact staging browser sequence

When an independent staging environment is supplied, retain a HAR/network trace with secrets and
signature query values redacted, and execute this order:

1. Open the exact staging Admin origin and log in with a disposable `admin`/`keeper` account.
2. Confirm `/auth/me` returns that account and no production identifiers.
3. Select a synthetic 1x1 PNG whose filename and title contain the run ID.
4. Confirm `POST /media/uploads` returns 201, a short expiry, `PUT`, `content-type`, the approved
   bucket, and an object key below the run prefix. Do not log the full signed URL.
5. Confirm the browser automatically sends unsigned `OPTIONS` with the exact Admin `Origin`,
   `Access-Control-Request-Method: PUT`, and `Access-Control-Request-Headers: content-type`.
6. Confirm browser `PUT` returns 200/2xx and targets only the recorded run prefix.
7. Confirm `POST /media/{id}/upload/complete` makes the API perform `HEAD`; size and MIME must match
   before status changes from `pending` to `active`.
8. Confirm exactly one intended binding exists and Admin reload returns a signed private read URL.
9. Replay the identical completion request; it must return the same media ID and not add a binding.
10. Force one non-production PUT failure and one request exceeding the configured browser timeout;
    neither may call completion or activate media.
11. Read one synthetic legacy-bucket record and the new object through Admin and the Miniapp trial;
    unsigned private object URLs must remain inaccessible.
12. Save media IDs, object keys, timestamps, response codes, build SHA, and redacted screenshots in
    the acceptance record. Never save access keys or presigned query strings.

## Conditions for using `starlitsky-cattery-media-1480740947`

The existing standard bucket can be used only after explicit authorization for one restricted test
write and confirmation that it is the intended non-destructive target. A write authorization is not
permission to inspect or change unrelated objects.

Required isolation:

- Prefix: `acceptance/cos-upload-e2e/<UTC timestamp>-<UUID>/`.
- Files: at most three synthetic images, each at most 100 KiB; no customer or production-derived
  content.
- Runtime: disposable SQLite only; `STORAGE_KEY_PREFIX` must equal the exact run prefix.
- Signing identity: allow only `name/cos:PutObject`, `name/cos:HeadObject`, and
  `name/cos:GetObject` on
  `qcs::cos:ap-chengdu:uid/1480740947:starlitsky-cattery-media-1480740947/<run-prefix>/*`.
- Do not grant bucket-list, ACL, CORS, policy, lifecycle, or unrestricted `cos:*` permissions.
- CORS must already allow the exact test Admin origin, `PUT` and `GET`, and the `Content-Type`
  request header, with `Vary: Origin` enabled so non-CORS image cache entries cannot poison later
  CORS reads. The test does not authorize `PutBucketCORS`. If this rule is absent, stop.
- Set a hard test budget of three PUTs/HEADs/GETs plus preflights, 300 KiB stored, and a 30-minute
  execution window. Abort on any target bucket/prefix mismatch.
- Record every created key in a manifest. Cleanup is a separate, explicit action using a temporary
  identity limited to `name/cos:DeleteObject` on the same run prefix; verify each key is absent with
  `HEAD`. Do not give delete permission to the upload runtime. If cleanup is not separately
  authorized, leave the tiny isolated objects and report them instead of deleting anything.

Tencent's official documentation states that browser preflight is unsigned and enforced by the
bucket CORS rule, and that object CAM permissions can be restricted to an exact prefix. References:

- <https://cloud.tencent.com/document/product/436/13318>
- <https://cloud.tencent.com/document/product/436/8288>
- <https://intl.cloud.tencent.com/zh/document/product/436/30580>
- <https://cloud.tencent.com/document/product/436/68284>

## Miniapp domain change scope (do not apply during preparation)

The current code names only
`starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`. This is a checked-in assumption, not
evidence that the legacy LightCOS bucket actually serves objects there. The exact old API and
public/custom object domains are **待真实只读验证**. During an approved migration window, the
validated legacy object host and
`starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com` must both be accepted for `request`
and `downloadFile`. Upload uses `wx.request` with `PUT`, so this is not an `uploadFile` legal-domain
entry.

Reviewed code/documentation scope:

- `apps/miniapp/config/env.ts`: represent both COS hosts in the request/download allowlists.
- `scripts/verify-miniapp-production-config.mjs`: assert both hosts and keep the `wx.request` PUT
  check.
- `docs/MINIAPP_PRODUCTION_READINESS.md`: list both hosts and the observation-period removal rule.
- WeChat Public Platform: add the new request/download legal domain only after separate approval;
  keep the old domain throughout migration and observation.

No production constant or WeChat setting is changed by this acceptance preparation.
