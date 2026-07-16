<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## 星月缅因猫舍长期项目规则

- 当前 GitHub 仓库 `viravoid/starlitsky-cattery` 是正式代码来源。
- Lovable Demo 只作为视觉、页面结构、交互和源码参考。
- 正式功能范围以项目方案为准；不要自行增加 Demo 和项目方案之外的模块。
- 不增加文章、科普文章、通用文章编辑器、喂养文章管理、支付、订单等范围外模块。
- 每次只处理一个边界清楚、可以独立检查的任务。
- 不直接修改 `main`。
- 每次使用独立开发分支。
- 修改后运行与本次任务相关的检查、测试和构建；如果检查失败，记录真实错误，不用无关改动掩盖问题。
- 检查完成后提交并推送 GitHub。
- 创建 Pull Request 供用户检查。
- 不自动合并 Pull Request。
- 不提交密钥、微信密钥、管理员密码、真实用户隐私数据或生产数据库内容。
- 不 force push，不重写远程 Git 历史，不删除远程分支，除非用户明确要求并确认风险。
- 不修改 `src/routeTree.gen.ts` 等自动生成文件，除非对应生成流程本身是本次任务范围。
- 业务源码改动必须优先保持现有架构和视觉基线；范围冲突先记录并让用户确认，不擅自删除。
