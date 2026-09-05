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
- 所有最终要进入 `main` 的功能或修复仍必须创建真实 GitHub Pull Request。
- 必须等待并读取真实 GitHub Actions 结果。
- 如果当前任务 Prompt 明确授权自动合并，并且最终审计无 Blocker / High、required gates 全部 PASS、GitHub Actions SUCCESS，则允许通过 GitHub Pull Request 使用 ordinary merge commit 自动合并。
- 禁止 squash merge。
- 禁止 rebase merge。
- 禁止绕过 GitHub Pull Request 的本地直接 merge。
- 如果当前任务 Prompt 没有明确授权自动合并，则停在 Pull Request ready 状态等待用户检查。
- 遇到危险 Git 操作、无法解决的 Blocker / High 或真正产品决策时仍必须停止。
- 不提交密钥、微信密钥、管理员密码、真实用户隐私数据或生产数据库内容。
- 不 force push，不重写远程 Git 历史，不删除远程分支，除非用户明确要求并确认风险。
- 不修改 `src/routeTree.gen.ts` 等自动生成文件，除非对应生成流程本身是本次任务范围。
- 业务源码改动必须优先保持现有架构和视觉基线；范围冲突先记录并让用户确认，不擅自删除。
