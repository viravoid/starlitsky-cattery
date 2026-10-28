# Parent application compatibility rollout

## Compatibility boundary

The transition API accepts both direct applications and the published miniapp's
`inviteCode`, `inviteToken`, or `qrCredential` payload. An existing invitation is
validated and consumed in the same transaction as the application. The old
`GET /parent-invites/verify` and admin list/create/revoke endpoints are available.
The old search request still requires login and a valid invitation, and returns
only visible cats with `id` and `name`.

The published miniapp cannot claim a hidden cat by ID. The old admin bundle can
review existing-cat applications and manage invitations, but it cannot approve
applications containing `newCats` or `unlistedCatClaims` because it has no
per-cat confirmation controls. Use the updated admin bundle for those reviews.
Do not weaken these checks to preserve the old UI behavior.

## Deployment order

1. In an isolated copy, run `npm run verify:parent-flow` and the migration smoke
   check. Verify `PRAGMA integrity_check` and `PRAGMA foreign_key_check`. Test
   old API code against the migrated copy before production change approval.
2. In an approved production window, identify the exact `DATABASE_URL`, take an
   online SQLite `.backup` with the existing `backup-sqlite.sh`, and verify the
   archive and extracted database before migration. Preserve the last known
   working API release and environment file.
3. Deploy the compatibility API with the existing script, which backs up before
   `db:migrate:deploy` and restarts only after builds complete. If migration or
   build fails, keep the old API running if it is healthy. If a schema rollback
   is required, stop API writes, restore the verified backup, and restart the
   matching old API release. A code-only rollback after writes to the migrated
   schema requires a separate data decision.
4. Check old miniapp login, invite verification, public cat search, submission,
   and old admin invite management and existing-cat review. Check the new direct
   application path before proceeding to trial.
5. Provision a separate test API process, SQLite file, auth secret, and restricted
   environment on existing server capacity. Use a distinct HTTPS virtual host
   and certificate. Set real WeChat login credentials, disable mock login and
   `WECHAT_PHONE_VERIFICATION_ENABLED=false`. Keep test database and media
   mutations isolated from production.
6. Register the exact test HTTPS request host in WeChat, verify certificate and
   `/health`, then set `MINIAPP_TRIAL_API_BASE_URL` and include that host in
   `MINIAPP_WECHAT_LEGAL_DOMAINS`. `npm run verify:miniapp-trial-ready` must pass
   before trial upload. Verify the generated trial package URL, real `wx.login`,
   and both test and production data boundaries on devices.
7. Record device results separately from automated and mock tests. Request
   separate authorization for the formal miniapp release after trial acceptance.

The server host, available port, test domain, certificate coverage, and WeChat
legal-domain registration require operator verification. No trial upload is
safe while the trial URL remains blank.
