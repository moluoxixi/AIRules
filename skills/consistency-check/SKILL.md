---
name: consistency-check
---

# 一致性核对 rubric

由 `consistency-reviewer` 按名加载的方法论。在编码后、测试验证前，核对最终 diff 是否忠实落地需求/计划/验收用例，不评代码质量。

## 触发条件

- 由 `consistency-reviewer` 加载，对实现编码后的最终 diff 做需求符合度核对
- 上游事实源（需求、计划、验收用例、bugfix 诊断）已就绪

## 不适合场景

- 主代理在普通对话里不主动加载本 skill（故省略 description）
- 代码质量评审 → 由 `requesting-code-review` 承担
- 纯文档、纯注释、纯格式或无行为配置改动 → 标 `N/A`
- 上游事实源缺失或冲突 → 标 `MISSING blocked`，不臆造上游事实

## 核对维度

- **需求覆盖**：每条需求/验收标准是否都有对应实现
- **计划符合**：实现是否落在计划冻结的范围内，有无未授权的范围蔓延
- **验收用例**：验收用例清单是否都被实现覆盖
- **遗漏与多余**：是否漏实现某条需求，或实现了需求外的内容
- **诊断符合**（bugfix）：修复是否对准 debugger 给出的根因

## 结构化打勾（有验收清单时）

若上游 `test-design` 产出了机器可解析验收清单（YAML，含 `id`/`description`/`acceptance_condition`），逐条按 `id` 对最终 diff 打勾，给结构化结论而非纯自然语言印象：

- `COVERED`：diff 中能指认满足 `acceptance_condition` 的实现。
- `NOT_COVERED`：无对应实现。
- `PARTIAL`：部分满足——必须写明缺口。

每条结论附 diff 中的证据位置（文件:行 或函数名）。有 `NOT_COVERED`/`PARTIAL` 即整体不符，回 coder。无 YAML 清单时退回按自然语言矩阵逐条核对，结论仍须逐条可追溯到验收点，不给笼统"基本符合"。

## 输出边界

- 只读核对，可写 `docs/consistency/*-implementation-review.md`，不改生产代码。
- 结论逐条对照上游事实源，不符项明确指出对应的需求/计划条目。
- 评审实例必须与编码实例不同；不得伪装 PASS。
