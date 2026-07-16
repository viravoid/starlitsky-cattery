# 星月缅因猫舍页面与路由映射

本文件记录当前仓库实际存在的 TanStack Router 路由。正式微信小程序页面名为迁移时建议映射，不代表本轮已创建小程序页面。

## 路由总表

| 源码文件 | 网页路由 | 页面名称 | 页面用途 | 主要组件/依赖 | 当前数据来源 | 当前交互 | 模拟数据 | 刷新后状态 | 用户身份 | 正式数据库 | 服务端能力 | 图片存储 | 小程序迁移难度 | 风险和备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/routes/index.tsx` | `/` | 首页 | 品牌首页、固定页面入口、我们的猫入口 | `PhoneFrame`、`Carousel`、`Section`、自定义插画 | 文件内 `GROUPS` 静态常量 | 轮播、页面跳转 | 是，占位轮播图 | 无运行状态需保留 | 全部用户 | 部分，轮播/内容若后台可配需数据库 | 部分，后台同步需要 | 是 | 中 | 视觉可参考；当前轮播图片全是占位 |
| `src/routes/about.tsx` | `/about` | 猫舍介绍 | 固定猫舍介绍 | `PhoneFrame`、`Card`、`Placeholder`、插画 | 页面硬编码真实文案片段 | 返回 | 部分，占位主图 | 无运行状态需保留 | 全部用户 | 否，除非后台可编辑 | 否 | 是 | 低 | 文案接近真实资料，但图片未接入 |
| `src/routes/philosophy.tsx` | `/philosophy` | 繁育理念 | 固定理念长文 | `PhoneFrame`、`Section` | 页面硬编码真实文案片段 | 返回 | 否，主要是固定内容 | 无运行状态需保留 | 全部用户 | 否，除非后台可编辑 | 否 | 否 | 低 | 大量硬编码颜色和排版需小程序重写 |
| `src/routes/environment.tsx` | `/environment` | 猫舍环境 | 展示区域分区和面积 | `PhoneFrame`、`Card`、`Pill`、`Placeholder` | 文件内 `ZONES` 静态数组 | 返回 | 是，占位环境图片 | 无运行状态需保留 | 全部用户 | 后台管理环境图文时需要 | 需要后台同步 | 是 | 中 | 真实空间资料存在，但当前仅文字和占位图 |
| `src/routes/feeding.tsx` | `/feeding` | 猫舍喂养 | 固定喂养体系展示 | `PhoneFrame`、`Placeholder` | 文件内 `MODULES` 静态数组 | 横向滚动图片位、返回 | 是，占位图片 | 无运行状态需保留 | 全部用户 | 否，方案不建设文章系统 | 否 | 是 | 中 | 只应是固定页，不应扩展文章后台 |
| `src/routes/process.tsx` | `/process` | 价格与接猫流程 | 展示价格、福利、购买步骤、新家礼包 | `PhoneFrame`、`SectionTitle`、`Card`、图标 | 文件内 `PRICES`、`BREEDING`、`STEPS` | 返回 | 部分 | 无运行状态需保留 | 全部用户 | 否，除非后台可编辑 | 否 | 否 | 低 | 退役种猫价格与真实资料冲突；缺小偿领养 |
| `src/routes/aftercare.tsx` | `/aftercare` | 售后保障 | 展示繁育承诺和去新家前项目 | `PhoneFrame`、`Card`、图标 | 文件内 `PROMISES`、`HEALTH` | 返回 | 部分摘要 | 无运行状态需保留 | 全部用户 | 否，除非后台可编辑 | 否 | 否 | 低 | 页面注明以《合同模板2026》为准，但合同未在仓库中 |
| `src/routes/contact.tsx` | `/contact` | 联系方式 | 展示并复制社交账号 | `PhoneFrame`、`CopyText`、`SOCIALS` | `src/lib/cattery-data.ts` | 复制账号 | 否，账号来自真实资料 | 复制反馈刷新后消失 | 全部用户 | 后台可维护时需要 | 可能需要 | 否 | 中 | 依赖 `navigator.clipboard`，小程序需用 `wx.setClipboardData` |
| `src/routes/cats.tsx` | `/cats` | 我们的猫 | 小猫/种猫列表和筛选 | `PhoneFrame`、`CatCard`、`Placeholder`、TanStack search | `KITTENS`、`STUDS`、`LITTERS` | tab 切换、状态筛选、窝次筛选、跳详情、问卷入口 | 是，小猫和图片大量占位 | 筛选存在 URL search，可保留；数据不变 | 全部用户 | 是 | 是 | 是 | 中 | 列表逻辑可参考；真实筛选需来自数据库 |
| `src/routes/kittens.$id.tsx` | `/kittens/$id` | 小猫详情 | 展示小猫资料、结构评分、关联动态入口 | `PhoneFrame`、`Carousel`、`StructureBlock`、`KITTENS` | `KITTENS` 静态数组 | 轮播、问卷入口、猫咪/窝次时光轴入口 | 是 | 无运行状态需保留 | 全部用户 | 是 | 是 | 是 | 中 | id 不存在时回退第一只小猫，不是真实 404 |
| `src/routes/studs.$id.tsx` | `/studs/$id` | 种猫详情 | 展示种猫资料、主理人手记、动态入口 | `PhoneFrame`、`Carousel`、`STUDS` | `STUDS` 静态数组 | 轮播、问卷入口、猫咪时光轴入口 | 是，多数 story 缺失 | 无运行状态需保留 | 全部用户 | 是 | 是 | 是 | 中 | id 不存在时回退第一只种猫，不是真实 404 |
| `src/routes/questionnaire.tsx` | `/questionnaire` | 选猫问卷 | 用户填写选猫意向和饲养条件 | `PhoneFrame`、本地 `TextField`/`RadioField`/`CommitBlock` | 页面 `useState` | 输入、单选、手机号格式校验、提交成功态 | 是，没有真实提交 | 刷新丢失 | 全部用户 | 是 | 是 | 否 | 高 | 必填未真正拦截；提交不进入后台 |
| `src/routes/community.index.tsx` | `/community` | 猫友圈 | 动态 feed、分类筛选、登录和发布入口 | `PhoneFrame`、`PostCard`、`LoginSheet`、`Lightbox`、`community-store` | `community-store` 内存 posts/users/cats | 分类筛选、点赞、评论入口、Demo 身份切换、发布入口 | 是 | 刷新丢失所有运行时变化；filter 丢失 | 游客、普通用户、家长、主理人 | 是 | 是 | 是 | 高 | Demo 身份切换仍在页面；权限仅前端 |
| `src/routes/community.post.$id.tsx` | `/community/post/$id` | 动态详情 | 查看动态、评论、点赞、删除自己的动态 | `PhoneFrame`、`PostImages`、`CommentComposer`、`community-store` | `community-store` 内存 posts/comments | 点赞、评论、删除、滚动到评论 | 是 | 刷新回到 seed 数据 | 登录用户、家长、主理人 | 是 | 是 | 是 | 高 | 使用 `document`、`history`、`confirm` |
| `src/routes/community.publish.tsx` | `/community/publish` | 发布动态 | 家长/主理人发布动态并关联猫咪/窝次 | `PhoneFrame`、`Placeholder`、`community-store`、`LITTERS` | 内存 users/cats/litters | 输入内容、设置图片数量、关联猫、关联窝次、创建动态 | 是 | 刷新丢失新动态 | 家长、主理人 | 是 | 是 | 是 | 高 | 图片只是数量；无上传；权限仅前端 |
| `src/routes/community.my-posts.tsx` | `/community/my-posts` | 我的发布 | 查看、编辑、删除当前用户动态 | `PhoneFrame`、`PostCard`、`EditPanel`、`community-store` | 内存 posts | 编辑内容、图片数量、关联猫/窝次、删除 | 是 | 刷新丢失修改 | 登录用户、家长、主理人 | 是 | 是 | 是 | 高 | 普通登录用户可进入但一般无发布 |
| `src/routes/community.my-cats.tsx` | `/community/my-cats` | 我的猫咪 | 家长管理自己的猫咪 | `PhoneFrame`、`Placeholder`、`community-store` | 内存 cats/currentUserId | 查看、编辑、删除、添加入口、时光轴入口 | 是 | 刷新丢失新增/删除/编辑 | 星月家长 | 是 | 是 | 是 | 高 | 删除会直接移除关联，不是归档 |
| `src/routes/community.cat-edit.$id.tsx` | `/community/cat-edit/$id` | 猫咪编辑 | 添加或编辑家长猫咪资料 | `PhoneFrame`、`Placeholder`、`community-store` | 内存 cats | 输入、保存、跳回我的猫咪 | 是 | 刷新丢失 | 星月家长 | 是 | 是 | 是 | 高 | 图片上传未接入；只检查名字 |
| `src/routes/community.cat.$id.tsx` | `/community/cat/$id` | 猫咪时光轴 | 聚合某只猫关联动态 | `PhoneFrame`、`PostCard`、`KITTENS`、`STUDS`、`community-store` | 内存 posts/cats + 静态猫数据 | 查看动态、跳我们的猫 | 是 | 刷新回到 seed 数据 | 全部用户 | 是 | 是 | 是 | 高 | 同时兼容社区猫、小猫、种猫 id |
| `src/routes/community.litter.$id.tsx` | `/community/litter/$id` | 窝次时光轴 | 聚合某个窝次关联动态 | `PhoneFrame`、`PostCard`、`community-store` | 内存 posts.litterIds | 查看动态、跳我们的猫 | 是 | 刷新回到 seed 数据 | 全部用户 | 是 | 是 | 是 | 高 | 窝次没有独立数据表，仅字符串 |
| `src/routes/community.parent-onboard.tsx` | `/community/parent-onboard` | 家长身份开通 | 输入邀请码开通家长身份 | `PhoneFrame`、`community-store` | 页面 `useState` + 内存 role | 输入邀请码、模拟开通、跳我的猫咪 | 是 | 刷新丢失身份 | 普通用户、家长 | 是 | 是 | 否 | 高 | 任意非空邀请码有效，且固定切换到示例家长 |
| `src/routes/admin.tsx` | `/admin` | 管理后台 | 管理内容、问卷、猫友圈、评论、家长身份 | 自定义后台 shell、`KITTENS`、`STUDS`、`FORM_ENTRIES`、`community-store` | 静态数组、组件局部 state、内存 store | 切换模块、假登录、部分内存管理操作 | 是 | 刷新全部丢失；登录状态也丢失 | 后台管理员 | 是 | 是 | 是 | 高 | 无真实认证；含范围外文章管理 |
| `src/routes/sitemap[.]xml.ts` | `/sitemap.xml` | Sitemap | 输出 XML sitemap | TanStack server handler | 文件内 `entries` 静态数组 | GET XML | 部分 | 无状态 | 搜索引擎/访问者 | 否 | 是 | 否 | 中 | 包含不存在的 `/discover`，`BASE_URL` 为空 |

## 管理后台模块细分

| 后台模块 | 当前数据来源 | 按钮是否生效 | 是否同步到前台 | 刷新后是否保留 | 范围判断 |
| --- | --- | --- | --- | --- | --- |
| 数据概览 | `KITTENS`、`FORM_ENTRIES` | 无操作 | 只展示 | 是，静态 | 范围内 |
| 首页轮播管理 | 占位循环 `[1,2,3]` | 替换/删除/新增无 handler | 否 | 否 | 范围内但未实现 |
| 小猫管理 | `KITTENS` | 编辑/改状态/上下架/新增无 handler | 否 | 否 | 范围内但未实现 |
| 种猫管理 | `STUDS` | 编辑无 handler | 否 | 否 | 范围内但未实现 |
| 猫舍环境图文 | textarea defaultValue + 占位图 | 保存/新增无真实保存 | 否 | 否 | 范围内但未实现 |
| 喂养体系 / 文章 | 文件内文章标题数组 | 编辑/下架/新增文章无真实保存 | 否 | 否 | 范围外，应后续删除或改为固定内容配置 |
| 售后说明管理 | textarea defaultValue | 保存无真实保存 | 否 | 否 | 范围内但未实现 |
| 问卷查看 | `FORM_ENTRIES` 复制到组件 state | 状态修改只影响本页 state | 否 | 否 | 范围内但未持久化 |
| 联系方式管理 | `SOCIALS` | 保存无 handler | 否 | 否 | 范围内但未实现 |
| 猫友圈内容管理 | `community-store.posts` | 置顶/隐藏/删除生效 | 是，同内存 store | 否 | 范围内但需重写 |
| 评论审核 | `community-store.posts.comments` | 隐藏/删除生效 | 是，同内存 store | 否 | 范围内但需重写 |
| 家长身份管理 | `community-store.users` | 新增/启停生效 | 是，同内存 store | 否 | 范围内但需重写 |

## 数据来源速查

| 数据类型 | 当前位置 | 当前性质 | 正式化要求 |
| --- | --- | --- | --- |
| 联系方式 | `src/lib/cattery-data.ts` `SOCIALS` | 静态真实账号 | 后台可配或配置表 |
| 小猫 | `KITTENS` | 示例数据 | 数据库、图片、父母和窝次关联 |
| 种猫 | `STUDS` | 部分真实、部分缺失 | 数据库、完整介绍、图片 |
| 窝次 | `LITTERS` | 字符串数组 | 独立窝次表 |
| 问卷 | `FORM_ENTRIES` + 前台 `useState` | 前后台割裂 | 提交 API 和后台处理 |
| 用户/家长/主理人 | `community-store.ts` seedUsers | 模拟 | 微信用户、角色和权限表 |
| 猫友圈动态 | `community-store.ts` seedPosts | 内存模拟 | 数据库、审核、权限 |
| 评论/点赞 | `community-store.ts` | 内存模拟 | 服务端写入和防刷 |
| 图片 | `Placeholder` + 本地占位图 | 未接入 | 微信上传和对象存储 |
| 后台认证 | `admin.tsx` `useState` | 假登录 | 真实认证和权限 |
