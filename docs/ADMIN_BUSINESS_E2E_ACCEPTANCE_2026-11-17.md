# 管理后台真实业务隔离 E2E 验收（2026-11-17）

接手基线：`77eb6c42b0965ce72063a1a9958305a12462722e`。本轮使用 `e2e/cos-browser/global-setup.ts` 启动的本地 API、后台、COS 模拟服务及独立 SQLite；管理员通过测试账号正常登录。下表的 PASS 只代表列出的隔离场景，不代表生产部署或微信真机验收。

## 浏览器、API、SQLite 验收矩阵

| 模块 / 场景                      | 浏览器操作与预期                                                                                                          | 实际、API 与 SQLite 核对                                                                                                                                                    | 证据                                                                                | 结果 |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| 猫咪全字段创建与编辑             | 其它猫咪 → 新增；填写名字、性别、闰日生日、颜色、生命周期、可见性、性格与结构化故事；刷新后编辑，清空性格、保留其他字段。 | 创建与修改请求分别返回 201/200；`cats` 和 `story_json` 保留字段、日期与枚举；刷新读回正确。                                                                                 | `e2e/cos-browser/admin-business-workflows.spec.ts`：`cat profile can be created...` | PASS |
| 猫咪隐藏、归档与权限             | 隐藏后公开读取应为 404、管理员仍可读；归档并刷新，勾选“显示归档”后可查看且不可编辑。                                      | 公开 API 对隐藏及归档猫返回 404；管理员 API 可读取；`cats.deleted_at` 有值。首次红灯证实归档详情曾报 404，修复后绿灯。                                                      | 同上；`services/api/src/routes/cats.mjs`、`cat-service.mjs`                         | PASS |
| 猫咪搜索、状态、可见性与分页     | 其它猫咪中搜索 21 条专用数据，切到第 2 页并筛选退休/隐藏。                                                                | 列表行数为 20+1，筛选结果与 SQLite 所插入状态一致；管理员 `/cats` 返回 21 条。                                                                                              | 同一 spec：`cat list search...`                                                     | PASS |
| 种猫资料                         | 种猫 → 新增母猫及繁育状态；刷新后编辑为半退休。                                                                           | `/cats/with-breeding-profile` 返回 201，`breeding_cat_profiles` 的角色、状态、文案正确，修改后保留角色。                                                                    | 同一 spec：`breeding cat profile...`                                                | PASS |
| 窝次、小猫与无效父猫             | UI 创建父母猫关联的窝次、预产期、可能颜色与备注；更新出生日期、状态；新增小猫并改找家状态；刷新读回。                     | `/litters` 201/200；无效父猫 ID 的 PATCH 返回 400 且父猫未被覆盖；`litters`、`kitten_profiles` 关系及状态正确。                                                             | 同一 spec：`litter and kitten relationship...`                                      | PASS |
| 选猫问卷审核与筛选               | API 提交专用问卷，后台打开完整详情、填写备注、标记已审核、刷新读回；再提交 20 条专用记录，搜索、状态筛选并翻页。          | 重放相同去重键仍为同一 ID；长文本与特殊字符完整显示；未认证 PATCH 为 401；`selection_applications` 的状态、备注、审核人、审核时间正确；分页为 20+1，已审核/未查看筛选正确。 | 同一 spec：`submitted questionnaire...`                                             | PASS |
| 猫友圈动态与评论                 | 后台按分类和内容搜索；对专用动态置顶、隐藏、恢复、删除、恢复，对评论搜索、隐藏、恢复；再用 21 条动态翻页。                | `posts`、`comments` 的状态变更持久化；隐藏或删除动态的公开 API 为 404，恢复后为 200；分页为 20+1。                                                                          | 同一 spec：`community post and comment...`                                          | PASS |
| 猫友圈异常与会话失效             | 浏览器模拟一次 500 响应，随后把本地会话令牌改为失效值再尝试隐藏专用动态；恢复有效令牌并刷新。                             | UI 显示失败提示；失效令牌的 PATCH 返回 401；两次失败后 SQLite 动态仍可见，刷新后操作按钮状态正确。                                                                          | 同一 spec：`community moderation failure...`                                        | PASS |
| 后台直接认证家长                 | 已存在测试用户关联隐藏猫，后台填写手机号、选择猫咪并认证；停用、刷新、恢复。                                              | `parent_profiles`、有效 `user_roles`、`parent_cat_links` 各只有预期记录；用户 `/me/cats` 权限从 403→200→403→200；号码来源为 `admin_entered`。                               | 同一 spec：`admin directly certifies...`                                            | PASS |
| 家长自主申请、拒绝与再申请       | 两个测试用户提交申请；后台分别通过、拒绝；通过者停用后再次申请并通过。                                                    | 只有通过者获得 `/me/cats` 200；审核状态、备注持久化；再申请后只有一个资料和一条有效猫咪关系。为满足冷却期，仅调整隔离库测试申请时间。                                       | 同一 spec：`self submitted parent applications...`                                  | PASS |
| 媒体库                           | 搜索、类型/状态筛选、预览测试图片、绑定测试猫、刷新后解绑。                                                               | `media_bindings` 从 1→2→1 条有效引用；目标绑定删除，原有引用与文件仍保留。                                                                                                  | 同一 spec：`media library finds...`                                                 | PASS |
| 概览统计                         | 打开概览，将评论总数视为统计而非待处理事项。                                                                              | `/admin/dashboard` 的评论数与 SQLite `comments` 非删除记录计数一致；UI 文案位置符合含义。                                                                                   | 同一 spec：`dashboard labels...`；`DashboardPage.tsx`                               | PASS |
| 既有照片、固定页面、COS 上传回归 | 执行原有相册替换、草稿预览、双桶上传等 6 个浏览器用例。                                                                   | 本轮最终全套 `npm run e2e:cos-browser` 17/17 通过；相册用例改为先搜索目标猫以适配分页。                                                                                     | `e2e/cos-browser/admin-photo-workflows.spec.ts` 等既有 spec                         | PASS |

## 已修复缺陷

1. **归档猫详情不可查看（P2）**：归档列表仍有“查看”，但详情 API 无条件排除 `deleted_at`，刷新后打开触发 404。管理员读取选项增加 `includeDeleted`，公开读取规则保持不变；归档列表和详情均隐藏编辑入口。E2E 曾先复现失败，修复后通过。
2. **猫咪列表无法按业务字段筛选及翻页（P2）**：列表有全部数据但缺搜索、状态、可见性和分页操作。增加模式对应状态筛选与 20 条/页，并用 21 条独立记录验证。数据加载仍沿用已有 `listAllPages`，不会仅筛选 API 第一页。
3. **概览“评论总数”误列待处理（P2）**：统计值来自全部未删除评论，不是待审核数。移动到统计卡片，保持原 API 计数。

## 证据范围和未验证项

- 记录的浏览器、API、数据库证据全部来自隔离测试；COS 为模拟对象存储。测试失败时 Playwright 在系统临时目录生成截图、`error-context.md` 和 trace，修复后最终通过的可复现证据为上述 spec 和 CI 日志。
- **未验证**：问卷重复审核策略；窝次重复提交与归档；家长新增猫时的确认、关系结束与历史、手机号微信验证来源/历史未知来源的后台展示；媒体库失败提示。这些不能依据现有 PASS 推定通过。
- **外部阻断**：真实微信手机号付费调用、微信体验版及正式版信息和生产真实业务操作均不在本轮授权范围。本轮没有向生产 API、数据库、COS 写入或重新部署。
- 2026-11-17 只读检查：`https://api.starlitskycattery.top/health` 和 `https://admin.starlitskycattery.top/` 均返回 HTTP 200；健康响应仅含环境与时间戳，没有部署 SHA，生产版本未知。微信版本亦未知。

## 本地验证

`npm run e2e:cos-browser` 最终 17/17；`typecheck:admin`、`typecheck:api`、`typecheck:e2e:cos-browser`、`build:admin`、`verify:cat-admin-hardening`、`verify:parent-flow`、`verify:community` 均通过。Windows 工作树的全量 `npm run lint` 受既有 CRLF 检出影响出现大批 Prettier 换行报错；关闭该规则后仅既有 `apps/miniapp/pages/home/index.ts` 的 6 处 `any` 报错。此项不作为通过，PR 的 Linux Release gates 需按原始配置独立验证。
