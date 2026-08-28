# 微信小程序正式迁移架构

## Boundary

The existing React/TanStack Start Demo remains a visual and data-structure reference. It is not converted in place into a WeChat mini program.

## Runtime Architecture

```text
普通用户 / 星月家长
↓
微信小程序前台 apps/miniapp
↓
服务端 API services/api
↓
数据库
↓
对象存储
```

```text
管理员 / 主理人
↓
独立后台管理端 apps/admin
↓
服务端 API services/api
↓
数据库
↓
对象存储
```

## Responsibilities

- `apps/miniapp`: WeChat mini program shell and future user-facing pages.
- `apps/admin`: independent browser-based admin shell.
- `services/api`: shared HTTP API boundary for the mini program and admin.
- `packages/shared`: shared non-business types, response contracts, and constants.
- Database layer: future persistent data for users, roles, cats, litters, questionnaire submissions, posts, comments, likes, and content settings.
- Object storage layer: future storage for cat photos, environment photos, community images, and fixed-page images.

## First Phase Scope

This phase only establishes the engineering foundation. It does not implement business features, login, database business tables, image uploads, permissions, page migration, article systems, or payments.
