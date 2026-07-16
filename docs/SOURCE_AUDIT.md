# 星月缅因猫舍源码与技术审计

审计日期：2026-07-16

工作分支：`codex/source-audit`

基准分支：`main`

基准提交：`fc6a672e7176a8139e5a55e58f27561a422f3746`（2026-07-16T13:21:17Z，`调整了卡片背景填充色`）

## 执行摘要

本仓库可以访问，实际仓库全名为 `viravoid/starlitsky-cattery`，默认分支为 `main`。当前仓库不是只有 ZIP 压缩包，根目录包含 `.lovable`、`src`、`public`、`package.json`、`bun.lock`、`vite.config.ts` 等 Lovable 导出的完整网页源码。

当前项目是 Lovable / TanStack Start / React / Vite / Tailwind CSS v4 的网页 Demo，不是微信小程序工程。源码已覆盖首页、固定介绍页、我们的猫、小猫和种猫详情、选猫问卷、猫友圈、家长相关页面、猫咪/窝次时光轴和管理后台，但核心数据仍是静态数组或 React 内存 store，没有真实登录、数据库、图片存储、服务端权限或后台持久化。

本轮没有修改业务源码。新增和修改范围仅限于：

- `docs/SOURCE_AUDIT.md`
- `docs/PAGE_MAP.md`
- `AGENTS.md`

## 已读取资料

实际读取到的三份项目资料为：

- `C:\Users\Administrator\Desktop\星月猫舍\项目方案.docx`
- `C:\Users\Administrator\Desktop\星月猫舍\星月缅因猫舍小程序 AI 工作流.docx`
- `C:\Users\Administrator\Desktop\星月猫舍\置顶全文（图片素材在文件夹）(1).docx`

说明：任务文件正文提到 `项目方案(1).docx` 和 `星月缅因猫舍小程序 AI 工作流(1).docx`，但资料目录中实际提供并读取的是上面列出的无 `(1)` 文件名版本。三份文件均可读取，均未嵌入 DOCX 内部图片媒体。

## 仓库与源码确认

- 仓库地址：`https://github.com/viravoid/starlitsky-cattery`
- 实际仓库全名：`viravoid/starlitsky-cattery`
- 默认分支：`main`
- 当前工作分支：`codex/source-audit`
- 本地 HEAD：`fc6a672e7176a8139e5a55e58f27561a422f3746`
- GitHub 权限：`ADMIN`
- 是否包含完整源码：是
- 是否只有 ZIP：否
- Lovable 特有内容：`.lovable/project.json`、`@lovable.dev/vite-tanstack-config`、`vite.config.ts` 中的 Lovable 配置说明、`AGENTS.md` 中的 Lovable 历史规则
- 自动生成文件：`src/routeTree.gen.ts`
- GitHub Actions：未发现 `.github` 自动化配置目录

## 技术栈

- 应用框架：TanStack Start / TanStack Router
- UI 框架：React 19
- 构建工具：Vite 8，通过 `@lovable.dev/vite-tanstack-config`
- 样式：Tailwind CSS v4、`src/styles.css` 的 `@theme inline` 设计变量、`tw-animate-css`
- UI 组件：shadcn/Radix 风格组件，`components.json` 指向 `src/components/ui`
- 图标：`lucide-react` 和自定义 SVG 图标
- 状态：`useState`、`useSyncExternalStore`，无 Redux/Zustand/后端状态
- 数据：`src/lib/cattery-data.ts` 静态猫舍数据，`src/lib/community-store.ts` 模拟猫友圈内存 store
- 服务端：TanStack Start server entry 包装和错误页，无业务 API
- 包管理器：仓库含 `bun.lock` 和 `bunfig.toml`，应优先使用 Bun

## 运行和构建基线

环境：

- Node.js：`v24.16.0`
- 全局 Bun：不可用
- 可用 Bun 可执行文件：npm 缓存中的 `bun.exe`
- Bun 版本：`1.3.14`

实际运行命令与结果：

| 命令 | 结果 |
| --- | --- |
| `git ls-remote --symref https://github.com/viravoid/starlitsky-cattery HEAD` | 成功，HEAD 指向 `refs/heads/main`，hash 为 `fc6a672e7176a8139e5a55e58f27561a422f3746` |
| `gh repo view viravoid/starlitsky-cattery --json nameWithOwner,defaultBranchRef,pushedAt,viewerPermission,url` | 成功，仓库全名和默认分支匹配，权限为 `ADMIN` |
| `git clone https://github.com/viravoid/starlitsky-cattery.git E:\小程序\starlitsky-cattery` | 成功 |
| `git fetch origin main; git checkout -b codex/source-audit origin/main` | 分支创建成功；`fetch` 出现一次 `Empty reply from server`，本地 `origin/main` 仍与已查询远端 hash 一致 |
| `bun --version` | 全局不可用；缓存 Bun 为 `1.3.14` |
| `bun install` | 第一次 120 秒超时但产生 `node_modules`；第二次失败，`@lovable.dev/vite-tanstack-config@2.7.6`、`@lovable.dev/vite-plugin-hmr-gate@1.1.3`、`@lovable.dev/vite-plugin-dev-server-bridge@1.1.1` tarball 下载 `ConnectionRefused` |
| `bun run dev --host 127.0.0.1 --port 5173` | 失败，`vite.config.ts` 无法解析 `@lovable.dev/vite-tanstack-config` |
| `bun run build` | 失败，同上，构建配置依赖缺失 |
| `bun x --bun tsc --noEmit` | 失败，`TS2307: Cannot find module '@lovable.dev/vite-tanstack-config'` |
| `bun run lint` | 失败，ESLint 可运行但报告大量 Prettier 错误 |
| `bun x --bun eslint . --format json` | 失败汇总：89 个文件有错误，10939 个 `prettier/prettier` 错误，6 个 `react-refresh/only-export-components` 警告 |
| `bun run test` | 失败，`package.json` 未定义 `test` 脚本 |

当前结论：

- 不能确认项目可启动或可构建。
- 直接原因是 Lovable 相关构建包未安装成功。
- ESLint 的主要问题是行尾/Prettier 规则，不能在本轮通过大规模格式化修复。
- TypeScript 当前只暴露出构建配置依赖缺失；源码层面的 TS 错误需在依赖完整后重新判断。

## 项目结构

根目录：

- `.lovable/project.json`：Lovable 模板信息，`tanstack_start_ts_current`
- `src/routes`：TanStack 文件路由
- `src/components/mobile`：移动端 Demo 框架、插画、图标、社区组件
- `src/components/ui`：shadcn/Radix UI 组件
- `src/lib`：静态数据、社区 store、错误处理
- `src/assets`：`hero-cats.png`、`placeholder-cat.png`、素材元数据
- `public`：`favicon.ico`、`robots.txt`
- `src/routeTree.gen.ts`：TanStack Router 自动生成路由树，不应手改
- `vite.config.ts`：Lovable TanStack Start 配置入口
- `bun.lock` / `bunfig.toml`：Bun 锁文件和安装策略

前端入口与路由：

- `src/router.tsx` 创建 TanStack Router 和 React Query `QueryClient`
- `src/routes/__root.tsx` 定义根布局、head meta、Google Fonts、错误页、`QueryClientProvider` 和 `<Outlet />`
- `src/routeTree.gen.ts` 注册全部实际路由

服务端入口：

- `src/start.ts` 和 `src/server.ts` 仅做 TanStack Start 错误包装
- 未发现真实业务 API、数据库访问层、认证中间件、上传接口或权限校验层

## 路由与页面概览

完整页面映射见 `docs/PAGE_MAP.md`。实际路由包括：

- `/`
- `/about`
- `/philosophy`
- `/environment`
- `/feeding`
- `/process`
- `/aftercare`
- `/contact`
- `/cats`
- `/kittens/$id`
- `/studs/$id`
- `/questionnaire`
- `/community`
- `/community/post/$id`
- `/community/publish`
- `/community/my-posts`
- `/community/my-cats`
- `/community/cat-edit/$id`
- `/community/cat/$id`
- `/community/litter/$id`
- `/community/parent-onboard`
- `/admin`
- `/sitemap.xml`

隐藏/辅助问题：

- `src/routes/sitemap[.]xml.ts` 中列出了 `/discover`，但路由树中不存在 `/discover` 页面。

## 公共组件与视觉系统

可保留的设计规则：

- 温暖奶油底色、柔和蓝黄点缀、低对比边框和柔和阴影
- 首页、固定页、猫友圈和我们的猫整体移动端视觉方向
- 底部三 Tab：`首页`、`猫友圈`、`我们的猫`
- 猫爪点赞、猫咪圆形头像、占位图和柔和手绘插画的品牌语言
- 小猫结构评分中的第六颗星强调表现

可参考但需要重写的组件：

- `PhoneFrame`、`StatusBar`、`Capsule` 是网页手机壳模拟，不是微信原生导航
- `TabBar` 需要迁移为微信小程序 tabBar 或自定义安全区组件
- `Carousel`、`PostImages`、`Lightbox`、`CommentComposer`、`CopyText` 需要按小程序组件与 API 重写
- shadcn/Radix 组件不可直接搬到小程序

可跨端复用的内容：

- `cattery-data.ts` 中的 TypeScript 类型和部分字段设计
- `community-store.ts` 中的领域对象类型：`Role`、`Post`、`Comment`、`CommunityCat`、`ParentUser`
- 状态枚举、表单状态枚举、猫咪状态枚举
- 部分纯函数：`formatTime`、`categoryTone`、`formStatusTone`

无法直接用于微信小程序的网页代码：

- TanStack 文件路由与 `Link`/`useNavigate`/`useParams`
- React DOM、HTML 表单、`textarea`、`button`、CSS class 体系
- Tailwind CSS、CSS 变量、`@theme inline`
- Google Fonts 外链
- `navigator.clipboard`、`window.matchMedia`、`window.history`、`document.getElementById`、`confirm`、`alert`、`history.back`
- Radix/shadcn UI 组件

## 数据与状态审计

### 猫舍固定资料

- 文件：`src/lib/cattery-data.ts`
- 内容：联系方式、种猫、示例小猫、问卷示例数据
- 类型：静态数组
- 刷新后：不丢失，因为写死在源码
- 后台修改同步：大多数后台按钮不真正修改该数据
- 后续需要：数据库或配置存储、图片存储、后台权限

### 小猫和种猫

- 小猫：`KITTENS` 只有 3 条示例数据，字段多为 `示例文字（缺少...）`
- 种猫：`STUDS` 有 16 条，只有 `重楼` 有完整 story，其余多为简短 trait 或缺少来源/完整介绍
- 图片：全部是占位图
- 筛选：`/cats` 通过 URL search 保存 tab、状态、窝次筛选
- 刷新后：筛选保留，数据不变
- 后续需要：真实数据库、图片存储、父母/窝次关联、价格/状态管理

### 问卷

- 前台提交：`src/routes/questionnaire.tsx` 的 `useState`
- 后台查看：`FORM_ENTRIES` 静态示例数组
- 前后台同步：无。前台提交不会新增到后台列表
- 校验：手机号格式仅在有值时校验，必填项没有统一阻止提交
- 刷新后：前台填写丢失
- 后续需要：真实提交 API、必填校验、防重复提交、隐私告知、后台处理状态与备注持久化

### 猫友圈

- 文件：`src/lib/community-store.ts`
- 存储：模块级内存变量 `state`
- 操作：登录模拟、点赞、评论、发布、编辑、删除、置顶、隐藏、猫咪新增/编辑/删除、家长新增/停用
- 刷新后：全部运行时变更丢失
- 前后台同步：同一内存 store 内可同步，但刷新丢失
- localStorage：未发现
- 后续需要：数据库、图片存储、服务端权限、审核状态、发布和评论安全校验

### 用户、身份和权限

- 角色：`guest`、`user`、`parent`、`keeper`
- 身份来源：Demo 按钮或模拟登录动作
- 管理员：`/admin` 页面内部 `useState` 标记，不与社区角色体系打通
- 邀请码：任意非空字符串都能开通家长，且固定切换到 `PARENT_HUHU`
- 后续需要：微信登录、邀请码校验、管理员/主理人身份配置、服务端权限

### 图片

- 真实图片未接入
- 占位：`Placeholder` + `placeholder-cat.png`
- 上传：发布动态和猫咪编辑只改变 `imageCount`，不选择或上传真实文件
- 后续需要：微信选择图片、压缩、上传、存储、审核、访问控制

## 功能真实性分级

### A：已完整实现的前端展示

- 固定内容页静态展示：`about.tsx`、`philosophy.tsx`、`environment.tsx`、`feeding.tsx`、`process.tsx`、`aftercare.tsx`、`contact.tsx`
- 首页信息架构和入口展示：`index.tsx`
- 我们的猫列表和详情的前端展示框架：`cats.tsx`、`kittens.$id.tsx`、`studs.$id.tsx`
- 猫友圈列表和动态详情的基础展示：`community.index.tsx`、`community.post.$id.tsx`

### B：已有前端交互，但数据只是模拟

- `/cats` 的 tab、状态、窝次筛选
- 猫友圈点赞、评论、发布、编辑、删除
- 我的发布、我的猫咪、猫咪编辑
- 猫咪时光轴和窝次时光轴
- 后台中的猫友圈置顶/隐藏/删除、评论隐藏/删除、家长启停
- 联系方式复制

### C：只有视觉界面，没有完整功能

- 后台登录账号密码
- 首页轮播管理替换/删除/新增按钮
- 小猫管理编辑/改状态/上下架/新增按钮
- 种猫编辑按钮
- 环境图文保存和新增图
- 联系方式保存
- 售后说明保存
- 喂养体系/文章编辑、下架、新增文章
- 图片上传、图片删除、图片预览的真实数据部分
- 选猫问卷提交与后台联动

### D：正式上线必须重新实现

- 微信登录和登录态持久化
- 家长邀请码校验
- 管理后台真实认证
- 服务端/数据库权限校验
- 数据库、图片存储、上传和访问控制
- 问卷提交、处理、备注、搜索筛选
- 前后台数据同步
- 微信小程序工程、页面、导航、安全区和真机适配

## 角色和权限审计

- 游客：可浏览页面；点赞、评论会弹登录提示；但没有服务端限制
- 普通用户：通过模拟微信登录产生；不能发布，但可通过前端状态进入部分用户流程
- 星月家长：通过任意非空邀请码或 Demo 按钮产生；可以发布家长分享、管理自己的猫咪
- 主理人：通过 Demo 按钮产生；可以发布任意分类、关联窝次、操作后台社区数据
- 后台管理员：访问 `/admin` 后任意点击登录按钮即可进入；密码没有校验

主要问题：

- 权限只在前端判断，没有服务端或数据库层验证
- Demo 身份切换控件仍显示在正式页面中
- `/admin` 可以直接通过地址进入，且无真实认证
- 家长是否只能管理自己的猫主要靠前端筛选，不能防止服务端绕过，因为没有服务端
- 普通用户和游客的发布/点赞/评论限制不能视为安全机制

## 管理后台审计

实际后台模块：

- 数据概览
- 首页轮播管理
- 在售小猫 / 状态 / 价格
- 种猫资料管理
- 猫舍环境图文
- 喂养体系 / 文章
- 售后说明管理
- 问卷查看
- 联系方式管理
- 猫友圈内容管理
- 评论审核
- 家长身份管理

可产生前台影响的模块：

- 猫友圈内容管理：置顶、隐藏、删除会影响内存 feed
- 评论审核：隐藏、删除会影响内存 comments
- 家长身份管理：新增/启停会影响内存 users

只属于视觉或局部状态的模块：

- 登录
- 轮播管理
- 小猫管理
- 种猫管理
- 环境图文
- 售后说明
- 联系方式
- 问卷状态修改仅存在 `Dashboard` 组件局部 `forms` 状态中，刷新丢失

范围冲突：

- `喂养体系 / 文章`、文章列表、`+ 新增文章` 与项目方案“不建设文章发布系统/科普文章系统/通用文章编辑器/喂养文章管理系统”冲突。

## 与项目资料的冲突

### 当前源码与项目方案冲突

- 后台存在 `喂养体系 / 文章` 模块、文章列表和 `+ 新增文章`。
- Demo 身份切换控件仍在 `/community` 页面可见。
- 后台登录没有真实认证。
- 前台问卷提交不进入后台。
- 多数后台按钮不能真正同步前台数据。
- 页面中仍大量存在 `示例图片`、`示例文字`、`缺少...`。

### 当前源码与真实业务资料冲突

- `process.tsx` 中退役种猫价格为 `0 – 10000 元`，真实置顶全文为 `0—15000`。
- `process.tsx` 未体现真实资料中的“小偿领养：0—5000”。
- 小猫数据仍是示例小猫 A/B/C，缺少真实在售小猫、父母、生日、颜色、价格和照片。
- 种猫资料只有 `重楼` 较完整，其余多缺少真实置顶全文中的完整介绍。
- 真实资料包含大量环境、喂养、种猫和小猫成长阶段内容，源码只部分转写且多为占位图。

### Demo 功能与正式项目范围冲突

- 项目方案要求 Demo 中已呈现功能最终真实运行，但当前源码仍是网页 Demo。
- 工作流要求正式版不显示 Demo 身份切换，当前仍显示。
- 工作流要求后台真实维护数据，当前多数面板不持久化。

### 文件间需确认的内容

- 任务文件要求本轮只审计，不删除；AI 工作流中“技术审计阶段同时确认删除”不应在本轮执行。当前按任务文件优先，只记录删除项。
- 项目方案要求固定展示页只展示确认内容，但源码中部分真实内容已硬编码、部分仍占位，后续需要确认最终内容来源。

## 已发现错误和风险

- 依赖安装失败：Lovable 构建包下载 `ConnectionRefused`
- 构建失败：缺少 `@lovable.dev/vite-tanstack-config`
- 类型检查失败：同一缺失包导致 `TS2307`
- ESLint 失败：10939 个 `prettier/prettier` 错误，主要是 CRLF/格式问题
- ESLint 警告：6 个 `react-refresh/only-export-components`
- `sitemap.xml` 包含不存在的 `/discover`
- 缺少测试脚本
- 未发现环境变量文档
- 未发现 GitHub Actions
- 无真实业务 API、数据库、权限层

## 微信小程序迁移风险

高风险：

- 当前是网页项目，不是小程序工程
- TanStack Router、React DOM、Tailwind、Radix/shadcn 均不能直接用于原生微信小程序
- 真实登录、数据库、图片上传和权限全部缺失
- 管理后台应与小程序前台分离，不能简单塞入小程序用户端

中风险：

- 页面视觉可参考，但需要重写组件、导航、安全区、长页面滚动和图片预览
- 猫友圈交互复杂，需要重新设计数据模型和服务端权限
- 问卷字段较多，需要移动端表单体验和隐私合规处理

低风险：

- 静态文案结构和页面清单可复用
- 猫咪、动态、评论、问卷等 TypeScript 类型可作为初始数据模型参考

## 需要用户确认的问题

- `项目方案.docx` 是否就是任务文件中 `项目方案(1).docx` 的最终版本？
- `星月缅因猫舍小程序 AI 工作流.docx` 是否就是任务文件中 `星月缅因猫舍小程序 AI 工作流(1).docx` 的最终版本？
- 退役种猫价格以真实置顶全文的 `0—15000` 为准，还是以当前源码的 `0–10000` 为准？
- 是否保留“小偿领养：0—5000”并在正式流程中展示？
- 主理人和后台管理员是否完全同一批人？
- 家长邀请码是一人一码、一次性码，还是可多次使用？
- 后台最终是独立 Web 管理端、微信小程序后台页，还是微信云开发控制台配合配置？
- 正式小程序使用微信云开发、Supabase、自建服务端，还是其他后端方案？
- 真实图片素材的最终命名、压缩和存储策略由谁确认？

## 下一步建议

下一步最合理的单一任务是：先恢复可安装、可启动、可构建的运行基线。

原因：当前 `bun install` 因 Lovable 包下载失败，导致 dev/build/typecheck 都不能可靠区分源码问题与依赖问题。建议下一轮只处理依赖源或网络问题，目标是让 `bun install`、`bun run dev`、`bun run build`、`bun x --bun tsc --noEmit` 形成可信基线；仍不开始视觉修改、小程序迁移或真实业务开发。
