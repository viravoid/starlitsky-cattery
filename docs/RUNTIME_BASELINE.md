# 运行基线恢复记录

日期：2026-07-16

分支：`codex/runtime-baseline`

基于 `main` 提交：`e6cc614b3474c5016267fda73a2161490b0d424a`

## 原始问题和根因

项目原先通过 `@lovable.dev/vite-tanstack-config` 封装 TanStack Start、React、Tailwind、Vite paths 和 Lovable 开发插件。`bun.lock` 中该包及其子依赖指向 `europe-west4-npm.pkg.dev/lovable-core-prod/sandbox-npm-cache` tarball。

重新验证时，`bun install` 仍然无法下载以下 Lovable tarball，并返回 `ConnectionRefused`：

- `@lovable.dev/vite-tanstack-config@2.7.6`
- `@lovable.dev/vite-plugin-dev-server-bridge@1.1.1`
- `@lovable.dev/vite-plugin-hmr-gate@1.1.3`

因此安装失败会连带阻断 `bun run dev`、`bun run build` 和 TypeScript 检查。根因不是业务源码，而是运行基线依赖了不可稳定获取的 Lovable 构建封装。

## Lovable 构建依赖处理

已移除 Lovable 构建依赖。

理由：

- 当前 GitHub + Codex 环境无法稳定下载 Lovable tarball。
- 该封装不是运行 Demo 必需的业务依赖。
- 项目已经直接声明了公开依赖：TanStack Start、React、Vite、Tailwind CSS、TypeScript。
- 使用公开插件组合后，安装、开发服务器、生产构建和 TypeScript 检查均可重复成功。

保留 `.lovable/project.json` 和 `AGENTS.md` 中的 Lovable 历史说明；本轮没有迁移或删除 Lovable 项目信息。

## 修改文件

- `package.json`
  - 移除 `@lovable.dev/vite-tanstack-config`
  - 移除不再需要的 `vite-tsconfig-paths`
  - 新增 `typecheck` 脚本
- `bun.lock`
  - 由 `bun install` 自动更新
  - 移除 Lovable 构建包及不再需要的 paths 插件锁定项
- `bunfig.toml`
  - 删除只服务于 Lovable 包的 `minimumReleaseAgeExcludes`
- `vite.config.ts`
  - 改为公开 Vite 插件组合：
    - `@tanstack/react-start/plugin/vite`
    - `@vitejs/plugin-react`
    - `@tailwindcss/vite`
    - Vite 8 原生 `resolve.tsconfigPaths`
  - 保留 TanStack Start SSR，并继续使用 `src/server.ts` 作为 server entry
- `src/routeTree.gen.ts`
  - TanStack Start 公开插件自动追加类型注册 footer
  - 这是生成器要求的 Start 类型注册；尝试关闭 route generation 会导致 build 失败：`Crawling result not available`
  - 未改动业务路由、页面、视觉、文案或数据
- `docs/RUNTIME_BASELINE.md`
  - 记录本轮运行基线恢复过程和验证结果

## 标准命令

```bash
bun install
bun run dev
bun run build
bun run typecheck
bun run lint
```

本机当前 shell 没有全局 `bun`，验证时使用 `npm exec --yes --package bun@1.3.14 -- bun ...` 临时调用 Bun。项目本身仍以 Bun 为包管理器。

## Smoke test

开发服务器命令：

```bash
bun run dev --host 127.0.0.1 --port 5173
```

HTTP smoke test 结果：

| 路由 | 状态 |
| --- | --- |
| `/` | 200 |
| `/cats` | 200 |
| `/community` | 200 |
| `/admin` | 200 |

## 构建和 TypeScript

| 命令 | 结果 |
| --- | --- |
| `bun install` | 通过 |
| `bun run build` | 通过，完成 client 和 SSR server 构建 |
| `bun run typecheck` | 通过，`tsc --noEmit` 无错误 |

## ESLint 状态

`bun run lint` 仍失败，但失败不是本轮新增业务或构建错误。

分类：

| 类别 | 数量 | 说明 |
| --- | ---: | --- |
| Prettier/行尾错误 | 10924 | 全部为 `prettier/prettier`，主要是历史 CRLF/格式问题 |
| 真正 ESLint 规则错误 | 0 | 未发现非 Prettier error |
| React Refresh 警告 | 6 | `react-refresh/only-export-components` |
| 本轮新增 lint 错误 | 0 | 本轮改动文件无 lint message |

本轮未进行全仓库格式化，避免引入大量无关行尾和视觉/源码 diff。

## 仍未解决的问题

- ESLint 仍被历史 Prettier/CRLF 问题阻断。
- 仍存在 6 个 React Refresh 警告。
- 仓库未配置测试脚本。
- 当前 Demo 仍是网页项目，不是微信小程序工程。
- 后台、猫友圈、问卷、登录、权限、数据库、图片上传等仍是审计文档中记录的 Demo/模拟状态。

## 后续开发者启动方法

1. 安装 Bun。
2. 在仓库根目录运行 `bun install`。
3. 本地开发运行 `bun run dev`。
4. 提交前至少运行：
   - `bun run build`
   - `bun run typecheck`
   - `git diff --check`
5. `bun run lint` 的失败应先按历史 Prettier/CRLF 与 React Refresh 警告分类，不要通过全仓库格式化掩盖业务改动。
