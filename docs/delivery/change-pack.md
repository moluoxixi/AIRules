# L2 变更包契约

AIRules 自身的 L2 变更使用变更包记录意图、层级 delta、设计、任务和验证证据。该目录属于 `repo-maintenance`，不得注入下游项目规则。

## 适用范围

- 修改 `rules/`、`skills/`、初始化流程、默认分发配置、宿主投影或交付门禁。
- 调整公共协议、权限模型、状态机、数据一致性、安全边界或跨模块行为。
- 用户明确要求对方案进行可审计留痕。

L0/L1 小修可不建变更包，但交付说明仍需写清分级、范围和验证。

## 目录结构

```text
docs/changes/
  index.md
  <change-id>/
    proposal.md
    layer-delta.md
    design.md
    tasks.md
    verification.md
  archive/
    <date>-<change-id>/
      proposal.md
      layer-delta.md
      design.md
      tasks.md
      verification.md
```

## 文件职责

| 文件 | 必填内容 |
|---|---|
| `proposal.md` | 目标、范围、非目标、变更分级、影响层级、风险 / MISSING |
| `layer-delta.md` | 按 `repo-maintenance`、`global-baseline`、`project-init`、`generated-project` 记录 `ADDED` / `MODIFIED` / `REMOVED` |
| `design.md` | 技术方案、兼容性、迁移 / 回滚、验证策略 |
| `tasks.md` | 可执行任务清单，任务必须可核对 |
| `verification.md` | 实际运行命令与 `PASS` / `FAIL` / `MISSING` / `NOT RUN` / `N/A` 状态 |

## 生命周期

1. L2 变更经用户确认后创建 `docs/changes/<change-id>/`。
2. 实现过程中保持变更包与实际 diff 同步；范围变化时更新 `proposal.md` 和 `layer-delta.md`。
3. 交付前运行 `npm run verify:changes`，并把其它验证命令写入 `verification.md`。
4. 完成并合入后，将目录移动到 `docs/changes/archive/<date>-<change-id>/`，保留上下文。

## 禁止事项

- 不把 AIRules 仓库维护规则写进 `skills/init-project/references/**`。
- 不用变更包替代用户确认；L2 仍必须先走澄清门禁。
- 不把 `NOT RUN`、`MISSING` 或失败命令改写成 `PASS`。
