# 同步 Moluoxixi 至 Trellis 0.6.16

## Goal

将 Moluoxixi 的 Trellis 外部基线从上游 `0.6.15` 安全升级到 `0.6.16`，保留仍然有效的 Moluoxixi 身份、CLI、发布门禁与 AIRules 扩展，并让 rebuild、正式导出和测试结果可验证地一致。

## Background

- 当前固定上游为 Trellis `0.6.15`，commit `bd454938dc406e2f692a07c3f3888e5375ff674d`。
- 目标 tag `v0.6.16` 是 lightweight tag，对应 commit `88f4834449da9b4f607ec05e322408a0aa66f2ce`；旧基线是其祖先，中间相隔 23 个提交。
- 当前 `.sync/rebuild` 位于 `c8f78016e265457fda3490bdd770560c0f15ff24`，在旧基线自动生成提交之后包含 11 个本地适配提交，且与 `roles/moluoxixi/packages` 内容一致。
- 现有同步脚本切换到新基线后只会生成身份转换提交，不会自动重放本地适配；直接导出会丢失 `ml`、发布门禁和版本等行为。
- 上游 `0.6.16` 声明 `breaking=false`、`recommendMigrate=false`，但 task/context gate、OpenCode memory、channel、路径与 symlink 处理存在需要专项验证的行为变化。

## Requirements

- 将只读源镜像固定到 Trellis `0.6.16` / `88f4834449da9b4f607ec05e322408a0aa66f2ce`，并从该 commit 建立新的 rebuild 维护分支。
- 所有适配仅在 `roles/moluoxixi/.sync/rebuild` 中完成并以本地 commit 记录；只读源镜像不得修改。
- 按语义重放仍然有效的 Moluoxixi 适配，包括包身份、`moluoxixi` / `ml` CLI、发布门禁、provenance 与 AIRules 扩展；不得机械保留已被上游替代的旧实现。
- 接受上游恢复的 OpenCode memory reader，不保留旧的“不支持 OpenCode”警告。
- 对同步脚本进行最小加固：使用声明的 rebuild branch pattern，识别旧基线后的本地适配，并在适配尚未重放或验证时拒绝导出；本次不重写通用同步框架。
- 延续既有 migration manifest 排除规则，不把上游历史 migration manifests 复制到 Moluoxixi。
- rebuild 验证通过后，先清空 `roles/moluoxixi/packages`，再完整复制 `.sync/rebuild/packages`；不得直接编辑正式导出目录。
- 许可证及其它法律文件不在本次评估或变更范围内，已有文件保持原状。
- 本次交付包含本地 rebuild 提交、正式 packages 导出、主仓提交与验证通过。
- Moluoxixi core 与 CLI 的目标版本统一为 `0.6.23`。两个包的 `0.6.16` 均已发布，npm 不允许用相同版本号发布本次升级后的新内容；不得把 `latest` 回指旧的 `0.6.16` 产物。

## Acceptance Criteria

- [ ] `.sync` 清单与文档准确记录上游 `0.6.16` 和完整 commit SHA，源镜像 detached 在该 commit 且保持干净。
- [ ] rebuild 使用符合约定的维护分支，所有本地适配均有明确语义去留，且未丢失 Moluoxixi 身份、`ml` alias、发布门禁或 AIRules 扩展。
- [ ] 同步脚本在未重放或未验证适配时不能误导出纯身份转换产物，并有覆盖该风险的自动化测试。
- [ ] core 与 CLI 使用同一已决版本，角色契约测试与发布清单同步更新。
- [ ] rebuild 的 build、typecheck、测试、lint 与发布预检全部通过。
- [ ] 中文 Trellis extension 的 `implement.jsonl` / `check.jsonl` 任务流程、OpenCode memory、channel、路径与 symlink 相关变更通过专项回归。
- [ ] 正式导出后，`.sync/rebuild/packages` 与 `roles/moluoxixi/packages` 的路径集合和逐文件内容完全一致。
- [ ] Moluoxixi identity 扫描、角色专属测试和相关根级测试全部通过，且未修改无关的现有工作树内容。
- [ ] 未执行 npm 发布或任何远端 push。

## Out of Scope

- npm 发布、dist-tag 修改和远端 push。
- 通用外部基线同步框架的全面重写。
- 许可证、NOTICE、COPYRIGHT 或其它法律材料的审计和维护。
- 把 `.sync` 内容复制到安装项目或 npm 包。

## Key Decisions

- 用户同意采用语义重放、最小同步脚本加固、延续 migration manifest 排除规则，并将发布与远端 push 排除在本次交付之外。
- npm registry 中两个包均已有 `0.6.16`，当前 `latest` 均为 `0.6.21`；本次使用新版本 `0.6.23`，避免覆盖或回指旧产物。
