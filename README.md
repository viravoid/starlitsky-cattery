# 星月缅因猫舍

This repository currently contains the React/TanStack Start visual Demo and the foundation for the formal WeChat mini program migration.

## Current Layout

- `src/`: existing React/TanStack Start Demo. Keep it as the visual and content reference.
- `apps/miniapp/`: formal WeChat mini program frontend foundation.
- `apps/admin/`: independent web admin foundation.
- `services/api/`: future API service foundation.
- `packages/shared/`: shared non-business types and constants.
- `docs/migration/`: migration architecture and workflow notes.

## Development

React Demo:

```bash
bun run dev
```

Admin foundation:

```bash
bun run dev:admin
```

API foundation:

```bash
bun run dev:api
```

Mini program:

Open `apps/miniapp` in WeChat Developer Tools.

## Secrets

Use `.env.example` as the template only. Do not commit real WeChat secrets, database passwords, object storage keys, production user data, or production database content.
