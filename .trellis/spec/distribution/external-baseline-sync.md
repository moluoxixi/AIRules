# 外部基线同步契约

## 1. Scope / Trigger

当 `roles/<role>/.sync` 固定的外部源码 commit 发生变化，或需要从该基线重新生成 `roles/<role>/packages` 时，必须遵循本契约。

本契约解决的是“升级时不静默丢失本地适配”。它不承诺自动同步可以理解上游变化，也不授权借升级重构同步系统。

## 2. Signatures

同步清单至少固定以下输入：

```json
{
  "upstream": {
    "baseline": {
      "version": "<upstream-version>",
      "revision": "<40-character-commit-sha>"
    }
  },
  "workingClone": "roles/<role>/.sync/<source>",
  "rebuildWorktree": "roles/<role>/.sync/rebuild",
  "finalizedPackagesPath": "roles/<role>/packages"
}
```

标准状态转换：

```text
固定 commit -> 确定性 identity transform -> 人工语义重放 -> 定向验证 -> 完整导出
```

Moluoxixi 当前入口：

```powershell
node roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs
node roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs --export --dry-run
node roles/moluoxixi/.sync/scripts/sync-moluoxixi-upstream.mjs --export
```

## 3. Contracts

- `roles/<role>/.sync/<source>` 是指定 commit 的只读、干净输入，不在其中修改或提交。
- `.sync/rebuild` 是唯一适配 worktree。identity transform、本地适配和纠正都在这里提交。
- identity transform 只负责可重复的包名、产品名和路径转换，不等于语义适配完成。
- 每次上游升级都必须由人判断已有适配应当保留、改写还是删除。工具不能替代这个判断。
- 只重放完成当前升级验收所必需的适配。发现的非阻塞问题记录后延后，除非用户明确批准扩展范围。
- 真正阻塞项仅包括：目标包无法构建或类型检查、既有角色契约丢失、导出不一致，或会破坏本契约边界的状态。
- 工具可以通过固定 commit、clean worktree、关键身份/版本断言和导出 hash 比较阻止静默丢失，但不得宣称“自动保留全部适配”。
- rebuild 验证通过后，先清空整个 `roles/<role>/packages`，再完整复制 `.sync/rebuild/packages`；正式导出目录不得直接编辑。
- 升级任务不得被重新解释为同步框架重设计、发布测试分类或仓库级治理改造。

### Design Decision: 人工语义审查是不可替代的门禁

上游 Trellis 会持续改变文件结构和行为。相同文本补丁可能已经由上游实现、需要换一种实现，或应当删除，因此不存在能长期保证语义适配不丢失的通用自动同步。项目选择“确定性生成 + 人工语义审查 + 定向契约测试”，而不是为每次升级扩建自动推断系统。

## 4. Validation & Error Matrix

| 条件 | 必须行为 |
| --- | --- |
| 固定 revision 不是完整 commit SHA 或无法解析 | 停止同步 |
| 源镜像 dirty 或不在固定 commit | 停止，不修改镜像 |
| rebuild 有未审查改动 | 停止，先审查并提交或明确放弃 |
| identity transform 后尚未完成语义审查 | 不导出 |
| 上游与本地适配冲突 | 人工决定保留、改写或删除 |
| 发现与验收无关的测试/治理问题 | 记录并延后，不扩大当前任务 |
| 发现真实阻塞项 | 只做解除阻塞所需的最小修复并重新验证 |
| rebuild 与正式 packages 路径或 hash 不同 | 导出失败，重新完整导出 |

## 5. Good / Base / Bad Cases

- Good：固定新 commit，生成 identity commit，仅重放 `moluoxixi` / `ml`、包身份、版本和必要发布契约，运行定向测试后完整导出。
- Base：上游已经等价实现某个旧适配。人工审查后不再重放，并在任务记录中说明该适配由上游接管。
- Bad：看到上游新增测试或潜在风险后，未经批准扩建通用 publish suite、同步纯度框架或完整测试分类系统。

## 6. Tests Required

- 断言 core 与 CLI 的包名和目标版本一致。
- 断言 CLI 保留角色要求的 bin（Moluoxixi 为 `moluoxixi` 与 `ml`，且没有 `tl`）。
- 运行与实际适配有关的 build、typecheck、lint 和定向测试；仓库专属且与发布包无关的失败不自动扩大范围。
- 运行角色 identity 检查，确认正式包没有遗留上游身份。
- 比较 `.sync/rebuild/packages` 与 `roles/<role>/packages` 的完整相对路径集合和逐文件 hash。
- 确认源镜像与 rebuild worktree 均 clean，rebuild 提交链从固定 commit 派生。

不要求创建一个试图证明“所有未来语义适配都不会丢失”的通用同步测试，因为该命题无法由固定断言证明。

## 7. Wrong vs Correct

### Wrong

```text
上游新增了行为 -> 扩展同步脚本和发布测试覆盖所有发现 -> 宣称以后自动同步不会丢适配
```

这把一次版本升级扩大成同步系统设计，而且给出了工具无法兑现的语义保证。

### Correct

```text
固定上游 commit -> 生成确定性身份转换 -> 人工审查旧适配 ->
只重放必要差异 -> 定向测试 -> 完整导出
```

工具负责让丢失可见并阻止未验收导出，人负责语义取舍。
