# Release Readiness Runbook

This runbook records the engineering steps required before staging and production acceptance. It does not choose a cloud provider and does not require real WeChat, database, or object-storage credentials to be committed.

## Secrets rule

- Never commit real secrets, private keys, WeChat credentials, admin credentials, production database URLs, production user data, or storage credentials.
- Keep real values in the deployment platform secret store only.
- Treat `.env.example` files as templates. Placeholder values are expected there and must fail production verification.

## API deployment

1. Configure production env in the deployment platform:
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `AUTH_TOKEN_SECRET` or `JWT_SECRET`
   - `WECHAT_APP_ID`
   - `WECHAT_APP_SECRET`
   - `WECHAT_MOCK_LOGIN_ENABLED=false`
   - `WECHAT_MOCK_QR_ENABLED=false`
   - `CORS_ALLOWED_ORIGINS` with the exact Admin web origin list
   - `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_ACCESS_KEY_SECRET`
   - `STORAGE_ENDPOINT` when the selected provider cannot be derived by the API
   - `STORAGE_PUBLIC_BASE_URL` when public media should use a CDN or custom domain
2. Install dependencies from the lockfile.
3. Run `npm run verify:production-env` with production env loaded.
4. Run `npm exec --yes --package bun@1.3.14 -- bun run --cwd services/api db:validate`.
5. Run `npm exec --yes --package bun@1.3.14 -- bun run --cwd services/api db:migrate:deploy`.
6. Build deployable artifacts according to the chosen host.
7. Start the API with `npm exec --yes --package bun@1.3.14 -- bun run --cwd services/api start`.
8. Verify `GET /health` on the deployed API origin.

## Admin deployment

1. Set `VITE_API_BASE_URL` to the deployed API base URL.
2. Ensure the same deployed Admin origin is listed in API `CORS_ALLOWED_ORIGINS`.
3. Build with `npm run build:admin`.
4. Deploy the generated Admin assets to the selected static hosting platform.
5. Confirm browser requests from the production Admin origin receive expected CORS headers.
6. Product decision needed before production operator handoff: Admin credential/login product must be decided before production operator handoff.

## Miniapp release

1. Set the Miniapp API domain to the deployed API base URL in the Miniapp environment config used for release.
2. Configure WeChat Mini Program server domain prerequisites in the WeChat console:
   - request domain for the API
   - upload/download domains if storage or CDN domains are used directly by the Miniapp
3. Build the Miniapp package.
4. Import `apps/miniapp` in WeChat Developer Tools.
5. Use the real AppID for staging or production checks.
6. Run preview and upload flows in WeChat Developer Tools according to the operator release process.

## Storage readiness

1. Select S3-compatible storage or Tencent COS during deployment planning.
2. Configure bucket, region, access key, secret, and endpoint/public URL values in the deployment secret store.
3. Configure bucket CORS to allow presigned `PUT` uploads from the Admin origin and Miniapp prerequisites where applicable.
4. Confirm public media URL behavior:
   - direct bucket public URL, or
   - CDN/custom domain in `STORAGE_PUBLIC_BASE_URL`
5. Do not store production object-storage credentials in the repo.

## Staging smoke order

1. Apply database migrations with `prisma migrate deploy`.
2. Run API production env verification.
3. Start the API and verify `/health`.
4. Open Admin against the staging API.
5. Import/open Miniapp against the staging API.
6. Run WeChat login, parent invite, parent approval, media upload, questionnaire, public content, and community flows from `docs/EXTERNAL_E2E_CHECKLIST.md`.

## Migration order

1. Back up the target database before schema changes.
2. Deploy migrations with the API stopped or traffic drained when the selected host requires it.
3. Run `prisma migrate deploy`.
4. Start the new API version after migrations complete.
5. Verify `/health` and smoke test critical write flows.

## Rollback basics

1. Stop or drain traffic to the failed release.
2. Roll back application code to the previous known-good deployment.
3. Restore database from backup if the release introduced incompatible data or schema changes.
4. Keep object-storage uploads made during the failed window quarantined or audited before deletion.
5. Record the failed version, migration state, and smoke-test failure before retrying.

## Prisma conclusion

Windows fresh SQLite and Ubuntu/Linux CI `prisma migrate deploy` have both succeeded, so the earlier Schema engine error is no longer treated as a migration blocker.
