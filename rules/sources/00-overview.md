---
description: 编码生命周期编排主线——需求分析到评审的阶段流转图与阶段契约。
---

## 编码生命周期编排

本 baseline 定义一条编码任务的标准流水线：从需求进入到评审收口。主代理读图决定每个阶段调度哪个子代理；阶段之间存在前置依赖，下游默认依赖上游产物已就绪。

```mermaid
flowchart TD
  Intake["任务进入"] --> Req["需求分析: 评估 PRD / 轻量澄清，产出需求事实源 + 验收标准"]
  Req -->|歧义/关键事实缺失| Clarify["澄清: 向用户提问"] --> Req
  Req --> Plan["计划: planner 冻结范围 + 产出实现计划 + 验收用例清单"]
  Plan --> Code["实现: coder 按栈写测试(红) + 代码(绿)"]
  Code --> Test["测试运行: 实际跑 build/test/lint 并读输出"]
  Test -->|FAIL| Debug["debugger 定位根因"] --> Code
  Test -->|PASS| Consist["后置一致性评审: consistency-reviewer 核对最终 diff 是否符合需求/计划/验收用例"]
  Consist -->|不符| Code
  Consist -->|符合| Review["代码评审: code-reviewer 独立实例评审最终 diff"]
  Review -->|FAIL| Code
  Review -->|PASS| Done["交付收口: 精简汇报 + 项目既有 Git/PR 流程"]
```

### 阶段契约

| 阶段 | 控制资产 | 前置依赖 | 产出 |
|---|---|---|---|
| 需求分析 | `brainstorming` | 任务描述 / 可选 PRD | 需求事实源、验收标准雏形 |
| 计划 | `writing-plans`、`test-design` | 需求事实源 | 实现计划、验收用例清单 |
| 实现 | `test-driven-development` + (`unit-testing` 或 `interaction-testing`) | 实现计划、验收用例清单 | 源码 + 配套测试 |
| 测试运行 | `verification-before-completion` | 实现产物 | 运行证据与状态 |
| 调试修复 | `systematic-debugging` | 失败现象 | 根因 + 证据 + 建议修复点 |
| 后置一致性评审 | `consistency-check` | 最终 diff、需求 / 计划 / 验收用例 | 一致性结论（编码后、测试验证前核对） |
| 代码评审 | `requesting-code-review` | 最终 diff、需求 | 评审结论（独立实例，不得自评） |

链式前置门禁：进入下游阶段前必须确认上游产物存在且已就绪（非草案、关键事实非 `MISSING`）；上游缺失时下游报告 `MISSING blocked` 并停止，不得臆造上游事实继续推进。
