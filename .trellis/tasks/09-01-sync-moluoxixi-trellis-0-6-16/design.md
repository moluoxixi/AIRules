# 技术设计：同步 Moluoxixi 至 Trellis 0.6.16

## 1. 设计目标

在不修改只读上游镜像、不丢失现有 Moluoxixi 适配、也不把未验收产物导入正式 packages 的前提下，将外部基线切换到 Trellis `0.6.16`，生成版本为 `0.6.23` 的 Moluoxixi core 与 CLI。

## 2. 边界与职责

| 边界 | 职责 | 写入规则 |
| --- | --- | --- |
| `roles/moluoxixi/.sync/trellis` | 固定上游源码输入 | 只允许 fetch 与 detached checkout，不修改文件、不提交 |
| `roles/moluoxixi/.sync/rebuild` | 身份转换、Moluoxixi 适配、包级验证 | 唯一适配 worktree；所有有效改造用本地 commit 记录 |
| `roles/moluoxixi/.sync/manifest.json`、`README.md`、`scripts/` | ignored 的本地同步元数据与工具 | 记录目标 commit、分支规则并提供误导出保护 |
| `roles/moluoxixi/packages` | 已验收的正式导出 | 不直接编辑；验收后先清空再完整复制 rebuild packages |
| `roles/moluoxixi/__test__` | 角色专属边界与发布契约 | 覆盖版本、身份、CLI alias、同步保护和导出一致性 |

`.sync` 不进入 AIRules 主仓提交或 npm 包；主仓只记录完整导出的 packages、角色测试和必要的项目级规范或任务文档。

## 3. 数据流与状态转换

```text
upstream v0.6.16 / 88f483...
  -> 只读镜像 detached checkout
  -> 新 rebuild 分支 moluoxixi/rebuild-88f4834449da
  -> 确定性 identity transform commit
  -> 语义重放后的 Moluoxixi adaptation commit(s), version 0.6.23
  -> rebuild 全量验证
  -> 清空并完整导出 roles/moluoxixi/packages
  -> identity、角色、根级与内容一致性验证
  -> AIRules 主仓本地 commit
```

旧 rebuild 分支 `codex/moluoxixi-cli-ml` 与 tip `c8f78016e265457fda3490bdd770560c0f15ff24` 始终保留。新同步不得改写、删除或 force-update 该引用。

## 4. 基线与分支策略

1. 在任何 checkout 前确认主仓、源镜像和 rebuild 状态，并记录旧分支、tip、自动生成基点 `001adcce5de0...` 及最终适配差异。
2. 将 ignored manifest 的 baseline 更新为 `0.6.16` / `88f4834449da9b4f607ec05e322408a0aa66f2ce`。
3. 根据 `rebuildBranchPattern` 展开目标分支 `moluoxixi/rebuild-88f4834449da`。目标分支不存在时从目标 commit 创建；存在但来源或状态不符合预期时停止，不自动覆盖。
4. identity transform 仍由现有 rename 逻辑单点完成，并继续排除 `src/migrations/manifests`。
5. 生成 commit 后再进入适配阶段，禁止此时导出。

## 5. 适配重放策略

以 `001adcce5de0...c8f78016e...` 的最终树差异和提交意图作为清单，不逐个机械 cherry-pick：

- 保留发布预检、manifest continuity、provenance、repository、build/test/lint/publish gates。
- core 与 CLI 统一设置为 `0.6.23`，同步发布脚本、测试常量与版本契约。
- 保留 `moluoxixi` 与 `ml` 两个 CLI bin，移除遗留 `tl` alias，并保留发布后 alias 验证。
- 保留不依赖上游 migration history 的构建能力和 OpenCode template ESM 修正，但先核对上游 `0.6.16` 是否已等价解决，避免重复补丁。
- 对上游和本地同时修改的两个 `package.json` 进行人工语义合并。
- 对 `packages/cli/src/commands/mem.ts` 接受上游恢复 OpenCode reader 后删除旧 warning 的行为，只保留仍适用的 Moluoxixi 命令身份。
- 不重放已经撤回的 knowledge ingestion 功能；历史中的新增与 revert 视为净零决策。

## 6. 同步脚本最小加固

加固只解决本次暴露的适配丢失风险：

- 实际展开并使用 `rebuildBranchPattern`，不再把 rebuild 永久留在无法表达维护身份的 detached 状态。
- 在切换基线前保留当前命名分支引用；工作树 dirty、目标分支状态异常或 checkout 会覆盖内容时立即失败。
- manifest 增加明确的 Moluoxixi 输出版本契约 `0.6.23`，同步后同时校验 core 与 CLI 版本。
- `--export` 前要求：当前 rebuild 分支与目标 revision 匹配、Moluoxixi 输出版本满足契约、身份与发布关键契约检查通过、rebuild 工作树干净。
- 纯 identity transform 产物仍为上游版本 `0.6.16`，因此无法通过 `0.6.23` 输出契约，必须在适配提交完成后才能导出。
- 导出后比较源/目标路径集合和逐文件内容；不一致即失败。

这些检查进入 `roles/moluoxixi/__test__/` 的角色专属测试，不把依赖 `.sync` 资产的测试放进 `scripts/lib/__test__/`。

## 7. 兼容性与专项回归

- 上游声明无强制 migration，但新版 task/context gate 必须覆盖中文 task 文档、`implement.jsonl` / `check.jsonl` 和本项目 Trellis extension。
- OpenCode memory reader 应以 `0.6.16` 新行为为准，验证本地命令身份与错误文案不退回旧 warning。
- channel 的 UTF-8、sequence/watch 与跨平台 adapter 运行既有发布测试。
- 路径 containment、symlink 和 managed removal 运行上游新测试及 Moluoxixi identity scan。
- fresh init 与 update 生成的 runtime templates 都要验证，避免只验证源码树。

## 8. 失败与回滚

- identity 或适配阶段失败：停止在 rebuild，正式 packages 保持不变；回到保留的旧分支继续排查。
- 导出前发现正式 packages 有非本任务改动：立即停止，不覆盖用户工作。
- 导出后验证失败：只回滚本次生成的正式 packages 变更，或从保留的旧 rebuild tip 重新完整导出；不得修改只读镜像或删除旧分支。
- 所有验证通过前不创建主仓提交；本次不执行 npm publish、dist-tag 修改或 push。

## 9. 主要权衡

- 选择语义重放而不是逐提交 cherry-pick，牺牲原始适配提交的逐个历史形状，换取对上游新实现的正确融合并消除 add/revert 噪声。
- 选择输出版本 `0.6.23` 而不是回指旧 `0.6.16`，保持 npm 版本不可变性和版本单调性。
- 只做同步脚本的目标分支与导出门禁加固，不扩展成通用外部基线框架，控制本次变更面。
