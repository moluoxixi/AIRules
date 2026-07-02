---
name: test-design
description: 当计划阶段需要把验收标准转成测试用例清单时使用。产出单测点矩阵与交互场景矩阵，作为连接需求与实现的可执行契约。
---

# 测试设计（用例先行）

在实现前把验收标准转成测试用例清单。清单是 spec 契约，规定"测什么"，由实现阶段的 `test-driven-development` / `unit-testing` / `interaction-testing` 落实"怎么测"。

## 触发条件

- 计划阶段、验收标准已就绪、尚未编写实现
- 需要在实现前固化测试覆盖范围作为需求契约

## 不适合场景

- 验收标准缺失或为草案 → 先回到需求分析/计划
- 测试的实际编写与运行 → 由实现阶段与测试验证承担
- 探索性原型且明确不需要测试契约 → 可跳过

## 产出：两类用例矩阵

**单测点矩阵**（纯逻辑/后端）：

- 正常路径：每条验收标准对应的预期行为
- 边界条件：空值、极值、临界输入
- 异常分支：错误输入、失败依赖、超时
- 隔离点：需要 mock 的外部依赖

**交互场景矩阵**（前端/交互）：

- 组件交互：点击、输入、提交等用户操作的预期反馈
- 表单校验：合法/非法输入的校验反馈
- 状态流转：加载、成功、空、错误态
- 关键 E2E 流程：贯穿多组件的用户旅程

## 机器可解析验收清单

除自然语言矩阵外，同时产出一份机器可解析的验收清单（YAML），给一致性评审作可逐条打勾的结构化锚点——避免评审退化为纯自然语言语义比对、易遗漏或误判。每条含稳定 `id`、`description`、`acceptance_condition`：

```yaml
acceptance_checklist:
  - id: AC-1
    description: <这条验收点测什么>
    acceptance_condition: <可判定的通过条件——具体到可观察行为/返回值/状态，不写"正确处理">
    traces_to: <对应的需求/验收标准来源>
  - id: AC-2
    description: ...
    acceptance_condition: ...
    traces_to: ...
```

`id` 是清单内稳定标识，下游 `consistency-check` 据此逐条标 `COVERED` / `NOT_COVERED` / `PARTIAL`。每条 `acceptance_condition` 必须可判定（能明确说出"满足/不满足"），不可写成含糊目标。清单与上面两个矩阵是同一批验收点的两种视图——矩阵供人读、清单供评审机械核对，不得二者覆盖范围不一致。

计划中可判定的**产物形态与性能边界**（如页面布局区域是否齐、组件是否按计划复用、首屏/接口耗时阈值、列表虚拟化行数、查询无 N+1）也纳入本清单，作为可逐条核对的验收点：能实际运行度量的（bundle 体积、性能测试、查询计数断言）交 `verification-before-completion` 跑；只能结构性核对的（目录/布局/复用是否如计划）交 `consistency-check` 比对 diff。

## 测试用例落档

产出完成后，验收清单必须落盘到 `.airules/tests/`，不能只停留在对话里或附在计划文本中：

- **人类可读文件**：`.airules/tests/<feature-or-change>.md`——自然语言矩阵 + 说明。
- **机器可解析清单**：可以是独立 `.airules/tests/<feature-or-change>.yaml`，也可以是上述 `.md` 文件中的 YAML 代码块；两种形式等价，选一即可。

每条测试用例落档时必须包含以下字段（无关字段标 `N/A` 并注明原因）：

| 字段 | 说明 |
|---|---|
| `id` | 稳定测试用例 ID，如 `TC-1`（可与 `AC-id` 对齐） |
| `traces_to` | 对应的需求 / 验收标准来源 |
| `task_id` | 对应的任务 ID（来自 `.airules/tasks/`） |
| `type` | `unit` / `interaction` / `integration` / `e2e` / `static` / `doc-check` / `script-check` |
| `preconditions` | 前置条件，无则写"无" |
| `steps_or_input` | 操作步骤或输入 |
| `expected` | 预期结果（可判定） |
| `coverage_status` | `PLANNED` / `IMPLEMENTED` / `N/A` / `BLOCKED` |
| `test_file_or_command` | 对应测试文件路径或验证命令，未知时填 `PLANNED` |

`id` 应能被任务文件（`.airules/tasks/<task>.md`）的"测试设计 / 验收用例映射"字段引用；任务文件也应反向列出自己覆盖的测试用例 ID，形成双向可追溯链。

## 输出边界

- 只产出用例清单，不编写测试实现代码。
- 每条用例必须可追溯到一条验收标准；覆盖不足时补用例或标 `MISSING`，不得删减验收标准。
- 机器可解析清单（YAML）与自然语言矩阵覆盖范围必须一致；每条 `acceptance_condition` 可判定，`id` 稳定供下游打勾。
- 矩阵中的示例条目仅供格式参考，需按真实验收标准填充，不得直接当作最终用例。
- **落档（强制）**：产出的验收清单必须落盘到 `.airules/tests/`（见上方"测试用例落档"），不得只以对话文本交付；落档文件路径随任务文件路径一起回传给主代理。
