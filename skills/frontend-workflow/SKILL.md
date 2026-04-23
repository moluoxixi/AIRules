---
name: frontend-workflow
description: 当项目为前端项目时使用。前端项目流程编排，识别项目类型（业务应用、组件库、工具库、文档站、CLI），并按对应流程编排需求分析、开发实现、测试验证全流程。
---

# 前端核心工作流 Orchestrator

> 参考架构：[Anthropic Orchestrator-Workers + Routing](https://www.anthropic.com/engineering/building-effective-agents) · [obra/superpowers](https://github.com/obra/superpowers)

本 Skill 是前端项目的**流程编排器（Orchestrator）**。它会先识别项目类型，然后根据类型走不同的工作流分支。

## 核心原则

- **先分析再执行**：必须先完成项目分析，再进入具体工作流
- **流程不可跳步**：每个分支内的阶段按顺序执行
- **每阶段独立上下文**：通过子代理隔离各阶段上下文，避免信息膨胀
- **护栏优先**：每个子代理都有前置校验清单，缺失信息必须向用户确认，禁止臆造

---

## 阶段零：项目分析（所有项目必经）

**调度子代理**：`agents/project-analyzer.md`

> 扫描项目目录结构、package.json、配置文件等，自动判定项目类型和技术栈。

产出物：**项目分析报告**（项目类型 + 技术栈 + 推荐工作流分支）

根据分析结果，进入对应的工作流分支 ↓

---

## 分支 A：业务应用（有页面路由、接口调用、UI 组件）

适用于：后台管理系统、H5 应用、小程序、电商前台等需要对接后端的项目。

```
需求分析 ──→ 页面开发 ──→ 接口联调 ──→ 交付测试
   │            │            │            │
   ▼            ▼            ▼            ▼
agents/      直接执行      agents/      agents/
requirement  （持续交互）  api-         delivery
-analyst.md               integrator   -tester.md
                          .md
```

### A1：需求分析
**调度子代理**：`agents/requirement-analyst.md`（使用"业务应用"校验清单）

校验项：
- ✅ 页面需求与业务逻辑
- ✅ UI 设计稿 / 布局参考
- ✅ 技术栈确认
- ✅ 接口文档（可后续提供）

### A2：页面开发
**直接执行**（需持续与用户交互）

### A3：接口联调
**调度子代理**：`agents/api-integrator.md`

### A4：交付测试
**调度子代理**：`agents/delivery-tester.md`

---

## 分支 B：组件库（导出可复用 UI 组件）

适用于：团队内部组件库、开源 UI 库、设计系统等。

```
API 设计 ──→ 组件开发 ──→ 文档编写 ──→ 测试验证
   │            │            │            │
   ▼            ▼            ▼            ▼
agents/      直接执行      直接执行      agents/
requirement                             delivery
-analyst.md                             -tester.md
（组件库模式）
```

### B1：API 设计
**调度子代理**：`agents/requirement-analyst.md`（使用"组件库"校验清单）

校验项：
- ✅ 组件用途和使用场景
- ✅ Props / Emits / Slots API 设计
- ✅ 是否需要与现有设计系统对齐
- ⚪ UI 设计稿（建议但非必须）

### B2：组件开发
**直接执行**（遵循单一职责原则，组件粒度合理）

### B3：文档编写
**直接执行**（Storybook / Histoire / VitePress 中编写使用示例）

### B4：测试验证
**调度子代理**：`agents/delivery-tester.md`

---

## 分支 C：工具库 / npm 包（导出函数 / 工具类）

适用于：工具函数库、SDK、通用模块等。

```
API 设计 ──→ 实现 ──→ 测试验证
   │          │          │
   ▼          ▼          ▼
agents/    直接执行    agents/
requirement            delivery
-analyst.md            -tester.md
（工具库模式）
```

### C1：API 设计
**调度子代理**：`agents/requirement-analyst.md`（使用"工具库"校验清单）

校验项：
- ✅ 功能需求描述
- ✅ 导出 API 设计（函数签名、参数、返回值）
- ✅ 类型定义规划
- ⚪ 是否需要 Tree-shaking 支持

### C2：实现
**直接执行**

### C3：测试验证
**调度子代理**：`agents/delivery-tester.md`

---

## 分支 D：文档站

适用于：VitePress / VuePress 搭建的文档网站。

```
内容规划 ──→ 内容编写 ──→ 构建预览
   │            │            │
   ▼            ▼            ▼
agents/      直接执行      agents/
requirement               delivery
-analyst.md               -tester.md
（文档站模式）
```

### D1：内容规划
**调度子代理**：`agents/requirement-analyst.md`（使用"文档站"校验清单）

校验项：
- ✅ 文档目标受众
- ✅ 内容结构 / 目录大纲
- ✅ 是否需要 API 文档自动生成

### D2：内容编写
**直接执行**

### D3：构建预览
**调度子代理**：`agents/delivery-tester.md`

---

## 分支 E：CLI 工具

适用于：命令行工具、脚手架等。

```
命令设计 ──→ 实现 ──→ 测试验证
   │          │          │
   ▼          ▼          ▼
agents/    直接执行    agents/
requirement            delivery
-analyst.md            -tester.md
（CLI 模式）
```

### E1：命令设计
**调度子代理**：`agents/requirement-analyst.md`（使用"CLI"校验清单）

校验项：
- ✅ 命令列表和参数设计
- ✅ 交互模式（交互式 / 非交互式）
- ✅ 错误处理策略

### E2：实现
**直接执行**

### E3：测试验证
**调度子代理**：`agents/delivery-tester.md`

---

## 工具调用优先级

1. **Skills**：优先使用已安装的测试相关 Skills（如 `vitest`、`playwright` 等）
2. **MCP**：当没有合适的 Skill 覆盖时，通过 MCP 服务完成
3. **禁止**：直接使用浏览器脚本模拟

## 与其他 Skills 的关系

| Skill | 关系 |
|-------|------|
| `vue` / `nuxt` / `pinia` 等 | 技术栈知识注入，本 workflow 负责流程编排 |
| `playwright` | E2E / 交互测试能力，由交付测试子代理按需调用 |
| `vitest` | 单元/组件测试能力，由交付测试子代理按需引用 |
| `vitepress` | 文档站构建知识，分支 D 场景使用 |
| `slidev` | 演示文稿工具，不在本 workflow 范围内 |

## 扩展说明

本工作流会持续注入前端专属控制协议与执行护栏。任何前端技术栈上下文内，本规则始终保持最高优先级。
