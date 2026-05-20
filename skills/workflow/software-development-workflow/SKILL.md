---
name: software-development-workflow
description: 用于软件开发任务的可复用流程规范。适用于功能开发、Bug 修复、重构、评审、任务拆分、质量门选择和交付报告。
---

# 软件开发流程规范

## 用途

本 Skill 是软件开发任务的流程 playbook，提供可复用的执行顺序、分级验证思路和交付报告格式。

它不替代 `AGENTS.md`、用户指令或 CI 规则：硬约束由这些上层规则管理，本 Skill 只提供可迁移的工作标准。

本文件是软件开发流程规范的唯一规则源；示例放 `examples/`，验证与拆分清单放 `validation/`。

## 适用场景

- 功能开发、Bug 修复、重构、接口调整、测试补充、交付前检查。
- 任务需要先判断范围、拆分、风险等级或验证策略。
- 需要把“做了什么、验证了什么、还剩什么风险”稳定地报告给用户。

## 流程骨架

1. **识别上下文**：项目类型、技术栈、相关文件、已有脚本、当前 git 状态。
2. **确认目标**：任务目标、验收标准、非目标、风险、未知项。
3. **选择级别**：按场景和风险选择轻量、相关或完整流程。
4. **设计边界**：影响文件、数据契约、错误语义、兼容性和副作用。
5. **实施变更**：优先沿用项目既有模式，保持改动范围清晰。
6. **执行验证**：参考 [quality-gate.md](validation/quality-gate.md) 选择匹配的验证范围。
7. **复核差异**：检查正确性、测试缺口、无关 churn 和失败掩盖。
8. **交付报告**：参考 [delivery-report.md](examples/delivery-report.md) 汇报结果和风险。

## 场景分级

| 级别 | 典型任务 | 推荐动作 |
|---|---|---|
| L0 | 咨询、审查、方案讨论、只读排查 | 不改文件时只报告观察结果和未运行检查原因 |
| L1 | 文档、AGENTS、Skill、README、策略规则 | 轻量验证，例如 diff check、相关策略测试、目标文件 lint |
| L2 | 小范围低风险代码调整 | 相关静态检查和直接相关测试 |
| L3 | 功能、Bug、运行时行为变化 | 相关检查、相关测试、必要类型检查，按影响补 build 或 coverage |
| L4 | 多模块、高风险、发布前 | 完整质量门和必要的手动或浏览器验证 |

避免把所有任务套进同一个重流程。Superpowers、并行子代理、TDD、全量测试、coverage 或构建通常只适合 L3/L4 或用户明确要求的场景。

## 关联标准

- 前端组件实现标准：`frontend-component-standard`。
- 前端模块实现标准：`frontend-module-standard`。
- 前端库实现标准：`frontend-library-standard`。
- 前端评审输出标准：`frontend-review-standard`。
- 前端验证标准：`frontend-testing-standard`。
- Node.js 后端实现标准：`backend-code-standard`，覆盖 Fastify、Express、Koa、Nitro/H3 和 NestJS，强调边界、契约、事务、一致性与可观测性。
- Java 后端实现标准：`java-code-standard`，覆盖 Java 17+ 基线、Java 21/25 LTS、Spring Boot、Maven 和 Gradle。
- 后端测试标准尚未提供；收到对应规范前，不引用旧后端测试 skill，也不自行补写相关规则。
- Vue、Vitest、Playwright 等技术细节：按项目实际栈加载对应技术 Skill。
- 拆分和并行判断：参考 [task-splitting.md](validation/task-splitting.md)。

## 输出语言与注释风格

默认跟随用户当前主要语言。命令、标识符、日志、错误原文、API/库名和专有名词可保留原文。

注释优先说明职责、边界、输入输出约束、副作用或异常语义，避免只复述代码行为。

## 失败语义

推荐保留真实失败原因。捕获错误适合用于补充上下文、清理资源或转换为等价失败结果，不适合把失败改写成成功路径。

交付报告中的验证状态建议使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN` 和 `N/A`，含义见 [quality-gate.md](validation/quality-gate.md)。

## 相关文件

- [task-splitting.md](validation/task-splitting.md)：任务拆分、并行和保持单任务的判断。
- [quality-gate.md](validation/quality-gate.md)：场景化验证矩阵和状态定义。
- [delivery-report.md](examples/delivery-report.md)：交付报告建议格式。
