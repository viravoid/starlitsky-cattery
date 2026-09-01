# 星月缅因猫舍

This repository contains the existing React/TanStack Start visual Demo and the foundation for the formal WeChat mini program migration. The Demo remains the visual and content reference; it is not converted in place.

## Project Structure

- `src/`: existing React/TanStack Start Demo. Keep it intact as the visual reference.
- `apps/miniapp/`: WeChat mini program frontend foundation.
- `apps/admin/`: independent browser-based admin foundation.
- `services/api/`: HTTP API service foundation.
- `packages/shared/`: shared TypeScript contracts and non-business common types.
- `docs/migration/`: migration architecture and development workflow notes.

## Current Checkpoint

Completed foundation stages:

- Miniapp shell: app config, global style entry, theme placeholders, final tabBar placeholders, request wrapper, and session/token placeholder directories.
- Admin shell: basic layout, placeholder Dashboard route, API baseURL config, and request wrapper.
- API shell: environment config, request logging, global error handling, unified response helpers, and `GET /health`.
- Shared contracts: API response contracts and non-business common types.

Not implemented yet:

- WeChat login
- Admin login or permissions
- Database schema or database connection
- Cat, community, questionnaire, upload, or admin business features
- Article system
- Payment or orders

## Start Commands

React Demo:

```bash
bun run dev
```

Miniapp:

1. Open WeChat Developer Tools.
2. Choose Import Project.
3. Select `apps/miniapp` as the project directory.
4. Use the placeholder AppID `touristappid` for local foundation checks, or replace it locally with the real AppID without committing secrets.

Admin:

```bash
bun run dev:admin
```

API:

```bash
bun run dev:api
```

Health check:

```bash
curl http://127.0.0.1:4310/health
```

Production API hardening:

- Set `CORS_ALLOWED_ORIGINS` to the exact deployed admin web origin list. The API no longer emits wildcard browser CORS headers; WeChat mini program requests do not rely on browser CORS.
- Keep `WECHAT_MOCK_LOGIN_ENABLED=false` and `WECHAT_MOCK_QR_ENABLED=false` in production. Production already disables these mocks unless explicitly changed in code.
- Tune `WECHAT_LOGIN_RATE_LIMIT_WINDOW_MS` and `WECHAT_LOGIN_RATE_LIMIT_MAX` for the deployment edge. The built-in limiter protects `/auth/wechat/login` per client IP in-process.
- `WECHAT_UPSTREAM_TIMEOUT_MS` controls WeChat API request timeouts for login and invite QR generation.
- Expired sessions are cleaned opportunistically during login. `AUTH_SESSION_CLEANUP_INTERVAL_MS` controls how often this runs; revoked sessions older than `AUTH_REVOKED_SESSION_CLEANUP_DAYS` are also deleted.

Shared type check:

```bash
bun run typecheck:shared
```

## Environment Files

- Root template: `.env.example`
- Admin template: `apps/admin/.env.example`
- API template: `services/api/.env.example`

These files are templates only. Do not commit real WeChat secrets, database passwords, object storage keys, admin credentials, production user data, or production database content.

## Development Workflow

Use small, verifiable steps:

```text
one infrastructure or product module
↓
local verification
↓
small Git commit
↓
review
```

`packages/shared` is for API contracts and non-business common types shared by miniapp, admin, and API code. It is not the place for user, cat, post, questionnaire, permission, login, upload, or database models until those schemas are designed in their own phases.
