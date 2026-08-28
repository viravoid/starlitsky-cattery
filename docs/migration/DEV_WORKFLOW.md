# 迁移开发流程

## Branches

- Keep the existing React Demo intact.
- Use `chore/wechat-miniapp-foundation` for the foundation work.
- Create later feature branches per module after the foundation is reviewed.

## Module Rhythm

Each module should follow:

```text
one module
↓
local verification
↓
small Git commit
↓
review
```

## First Phase Verification

- `apps/miniapp` opens in WeChat Developer Tools.
- `services/api` starts and `GET /health` returns a normal JSON response.
- `apps/admin` starts and renders the placeholder page.
- `packages/shared` passes TypeScript type checking.

## Scope Guardrails

Do not implement:

- cat list or cat detail migration
- community features
- WeChat login
- database business tables
- role permission system
- image upload
- admin business features
- article systems
- payment or orders
