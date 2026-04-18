---
name: frontend-workflow
description: 当项目为前端项目时强制触发此核心工作流，作为 Orchestrator 统一编排需求分析、页面开发、接口联调、交付测试全流程。
---

# 前端核心工作流 Orchestrator

> 参考架构：[Anthropic Orchestrator-Workers](https://www.anthropic.com/engineering/building-effective-agents) · [obra/superpowers subagent-driven-development](https://github.com/obra/superpowers)

本 Skill 是前端项目的**流程编排器（Orchestrator）**，不直接执行具体实现，而是按阶段调度子代理（agents/）完成各环节工作。

## 核心原则

- **流程不可跳步**：必须按"需求分析 → 页面开发 → 接口联调 → 交付测试"顺序执行
- **每阶段独立上下文**：通过子代理隔离各阶段上下文，避免信息膨胀
- **护栏优先**：每个子代理都有前置校验清单，缺失信息必须向用户确认，禁止臆造

## 工作流程

```
需求分析 ──→ 页面开发 ──→ 接口联调 ──→ 交付测试
   │            │            │            │
   ▼            ▼            ▼            ▼
agents/      直接执行      agents/      agents/
requirement  （由当前      api-         delivery
-analyst.md  会话完成）    integrator   -tester.md
                          .md
```

### 阶段一：需求分析

**调度子代理**：`agents/requirement-analyst.md`

子代理职责：
- 校验需求完整性（页面需求、业务逻辑、UI 参考、技术栈）
- 输出标准化需求清单
- 缺失项明确列出，等待用户补充

**准入条件**：用户提出前端开发任务
**产出物**：需求清单（checklist 格式）
**通过条件**：所有必填项已确认 ✅

### 阶段二：页面开发

**直接执行**（不派子代理，因为需要持续与用户交互）

执行规则：
- 基于阶段一的需求清单实现页面布局、结构与交互
- 遵循当前项目技术栈（Vue/React/原生等）的 Skill 规范
- 组件粒度合理，遵循单一职责原则

**准入条件**：阶段一需求清单全部 ✅
**产出物**：页面代码
**通过条件**：页面结构完整，无硬编码的 mock 数据

### 阶段三：接口联调

**调度子代理**：`agents/api-integrator.md`

子代理职责：
- 校验接口文档完整性（地址、方式、参数、响应、状态码）
- 按文档封装请求函数、类型定义、异常处理
- 缺失项向用户确认，禁止编造接口与字段

**准入条件**：阶段二页面开发完成
**产出物**：接口封装代码 + 类型定义
**通过条件**：所有接口已按文档实现，类型完整

### 阶段四：交付测试

**调度子代理**：`agents/delivery-tester.md`

子代理职责：
- 按优先级选择测试方式：MCP/CLI 优先 → Playwright 降级
- 验证页面渲染、接口联通、交互逻辑
- 输出测试报告

**准入条件**：阶段三接口联调完成
**产出物**：测试报告
**通过条件**：核心功能测试通过 ✅

## 工具调用优先级

1. **Skills**：优先使用已安装的测试相关 Skills（如 `vitest`、`playwright` 等）
2. **MCP**：当没有合适的 Skill 覆盖时，通过 MCP 服务完成
3. **禁止**：直接使用浏览器脚本模拟

## 与其他 Skills 的关系

| Skill | 关系 |
|-------|------|
| `vue` / `nuxt` / `pinia` 等 | 技术栈知识注入，本 workflow 负责流程编排 |
| `playwright` | E2E / 交互测试能力，由阶段四的子代理按需调用 |
| `vitest` | 单元/组件测试能力，由阶段四的子代理按需引用 |

## 扩展说明

本工作流会持续注入前端专属控制协议与执行护栏。任何前端技术栈上下文内，本规则始终保持最高优先级。