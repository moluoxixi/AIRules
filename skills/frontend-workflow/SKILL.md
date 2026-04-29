---
name: frontend-workflow
description: 当项目为前端项目时强制使用。按项目类型进行流程编排，风格规范。
version: 2.0.0
protocolVersion: "1.0"
triggers:
  - "前端开发"
  - "UI"
  - "组件"
  - "页面"
  - "视图"
  - "状态管理"
---

# 前端核心工作流协议 v2.0

本 Skill 是前端项目的**底层执行协议**。它将开发流程从"自然语言描述"升级为**机器可严格执行的状态机协议**，确保跨阶段、跨子代理的信息流转零损耗、零幻觉。

---

## 核心协议（不可违背）

本协议定义三条铁律，所有阶段、所有子代理、所有直接执行节点**必须严格遵守**，无例外。

### 协议一：状态持久化（防失忆）

**问题**：大模型跨阶段/跨子代理时上下文丢失，导致遗忘分支、重复分析、阶段跳步。
**规则**：

1. 工作流启动时，在项目根目录创建 `.agent/` 目录（如已存在则跳过）
2. 每次阶段流转（进入新阶段或子代理交接），**必须**将当前状态写入 `.agent/_workflow_state.json`
3. 所有子代理接手任务的**第一步**：读取 `.agent/_workflow_state.json`，确认当前分支与阶段，**禁止跳过此步骤直接执行**
4. 状态文件是**唯一的事实来源（Single Source of Truth）**，任何与状态文件矛盾的记忆均以状态文件为准

**状态文件 Schema**：

```json
{
  "version": "2.0",
  "branch": "A | B | C | D | E",
  "currentStage": "A1 | A2 | A3 | A4 | B1 | ...",
  "stageStatus": "PENDING | IN_PROGRESS | DONE | BLOCKED",
  "completedStages": ["A1", "A2"],
  "lastUpdated": "ISO-8601",
  "blockReason": "仅 stageStatus=BLOCKED 时填写"
}
```

### 协议二：严格 I/O 契约交接

**问题**：原流程以自然语言描述产出物（如"产出物：项目分析报告"），导致下游节点凭空臆造上下文。
**规则**：

1. 阶段零及各分支的关键节点完成后，**必须**生成结构化的 JSON 配置文件，**禁止仅以自然语言描述产出物**
2. 下游的"直接执行"节点或子代理**必须严格读取**对应配置文件驱动开发，**禁止依赖上下文记忆推断**
3. 配置文件字段缺失时，**必须阻塞并要求上游补充**，禁止自行填充默认值

**契约文件清单**：

| 文件路径 | 产出阶段 | 消费阶段 | 内容 |
|---|---|---|---|
| `.agent/project_context.json` | 阶段零（项目分析） | 所有分支的第一阶段 | 项目类型、技术栈、核心依赖、推荐分支 |
| `.agent/requirement_context.json` | 各分支第一阶段（需求分析） | 第二阶段起 | 业务需求、UI 参考、接口约束、校验清单 |
| `.agent/api_context.json` | 接口联调阶段 | 交付测试阶段 | 接口清单、类型定义路径、Mock 状态 |

**契约文件 Schema 示例**：

`.agent/project_context.json`：
```json
{
  "projectType": "business-app | component-lib | tool-lib | docs-site | cli-tool",
  "techStack": {
    "framework": "Vue 3",
    "language": "TypeScript",
    "buildTool": "Vite",
    "packageManager": "pnpm",
    "cssSolution": "Tailwind CSS",
    "testFramework": "Vitest",
    "stateManagement": "Pinia"
  },
  "recommendedBranch": "A",
  "analyzerVersion": "2.0"
}
```

`.agent/requirement_context.json`：
```json
{
  "branch": "A",
  "businessRequirements": "核心业务流程描述",
  "uiReference": "设计稿链接或布局描述",
  "apiConstraints": "接口文档地址或约束说明",
  "checklistStatus": {
    "mandatoryComplete": true,
    "importantMissing": ["UI设计稿"],
    "optionalMissing": ["交互规格"]
  },
  "analyzerVersion": "2.0"
}
```

### 协议三：无头逻辑前置（Headless First）

**问题**：开发者（含 AI）倾向在视图文件中堆砌全部逻辑，导致状态管理、数据获取、校验逻辑与渲染耦合，无法测试、无法复用。
**规则**：

1. 在所有业务分支（A2、B2、C2、D2、E2）涉及页面/组件开发的"直接执行"阶段，**必须先编写纯逻辑文件，再编写视图层文件**
2. **严禁**将状态管理、数据获取、校验逻辑直接写在视图组件的 `<script setup>` 中（简单单行表达式除外）
3. 逻辑层文件必须满足：**无 DOM 依赖、无组件实例依赖、可独立测试**

**执行纪律**：

```
第一优先：types/     → 定义数据结构（接口类型、表单模型、枚举）
第二优先：constants/ → 定义常量（映射表、默认值、配置项）
第三优先：hooks/     → 抽离状态管理 + 数据获取 + 校验逻辑（composable / store）
最后编写：index.vue  → 视图层仅负责：调用 hooks → 绑定数据 → 渲染 UI
```

**合规示例**：

```vue
<!-- ✅ 合规：视图层仅消费 hooks，无业务逻辑 -->
<script setup lang="ts">
import { useOrderList } from './composables/useOrderList'
import { useOrderForm } from './composables/useOrderForm'

const { tableData, loading, handleSearch, handleReset } = useOrderList()
const { formModel, formRules, handleSubmit } = useOrderForm()
</script>
```

```vue
<!-- ❌ 违规：视图层包含数据获取、状态管理、校验逻辑 -->
<script setup lang="ts">
const loading = ref(false)
const tableData = ref([])
const formModel = reactive({ name: '', status: '' })
const formRules = { name: [{ required: true, message: '必填' }] }

async function fetchList() {
  loading.value = true
  const { data } = await getOrderList(formModel)
  tableData.value = data.list
  loading.value = false
}

function handleSearch() { fetchList() }
</script>
```

---

## 阶段零：项目分析（所有项目必经）

**调度子代理**：`agents/project-analyzer.md`

**执行协议**：
1. 子代理第一步：检查并读取 `.agent/_workflow_state.json`（如不存在，视为首次启动）
2. 扫描项目目录结构、`package.json`、配置文件和源代码，判定项目类型和技术栈
3. 分析完成后，**同时写入**两个文件：
   - `.agent/_workflow_state.json`（更新 branch、currentStage、stageStatus）
   - `.agent/project_context.json`（结构化项目分析结果）

**I/O 契约**：
- **产出**：`.agent/project_context.json`（严格遵循上方 Schema）
- **消费**：所有分支的第一阶段

根据分析结果中的 `recommendedBranch` 字段，进入对应的工作流分支 ↓

---

## 分支 A：业务应用（有页面路由、接口调用、UI 组件）

适用于：后台管理系统、H5 应用、小程序、电商前台等需要对接后端的项目。

```
需求分析 ──→ 页面开发 ──→ 接口联调 ──→ 交付测试
   │            │            │            │
   ▼            ▼            ▼            ▼
agents/      直接执行      agents/      agents/
requirement  （Headless    api-         delivery
-analyst.md   First）     integrator   -tester.md
                          .md
```

### A1：需求分析
**调度子代理**：`agents/requirement-analyst.md`（使用"业务应用"校验清单）

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行需求校验清单
3. 完成后写入 `.agent/requirement_context.json` + 更新 `_workflow_state.json`

校验项：
- ✅ 页面需求与业务逻辑
- ✅ UI 设计稿 / 布局参考
- ✅ 技术栈确认
- ✅ 接口文档（可后续提供）

### A2：页面开发
**直接执行**（需持续与用户交互）

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/requirement_context.json`
2. **强制执行 Headless First 纪律**（见协议三），按 types → constants → hooks → view 顺序开发
3. 严格遵循代码风格规范（见下方"代码风格规范"章节）
4. 每完成一个功能模块，更新 `_workflow_state.json`

### A3：接口联调
**调度子代理**：`agents/api-integrator.md`

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/requirement_context.json`
2. 完成后写入 `.agent/api_context.json` + 更新 `_workflow_state.json`

### A4：交付测试
**调度子代理**：`agents/delivery-tester.md`

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json` + `.agent/api_context.json`
2. 执行测试验证
3. 完成后更新 `_workflow_state.json`（stageStatus = DONE / DONE_WITH_CONCERNS / BLOCKED）

---

## 分支 B：组件库（导出可复用 UI 组件）

适用于：团队内部组件库、开源 UI 库、设计系统等。

```
API 设计 ──→ 组件开发 ──→ 文档编写 ──→ 测试验证
   │            │            │            │
   ▼            ▼            ▼            ▼
agents/      直接执行      直接执行      agents/
requirement  （Headless    （读取       delivery
-analyst.md   First）     contract）   -tester.md
```

### B1：API 设计
**调度子代理**：`agents/requirement-analyst.md`（使用"组件库"校验清单）

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行需求校验清单
3. 完成后写入 `.agent/requirement_context.json` + 更新 `_workflow_state.json`

校验项：
- ✅ 组件用途和使用场景
- ✅ Props / Emits / Slots API 设计
- ✅ 是否需要与现有设计系统对齐
- ⚪ UI 设计稿（建议但非必须）

### B2：组件开发
**直接执行**

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/requirement_context.json`
2. **强制执行 Headless First 纪律**（见协议三）：先抽离 composable 逻辑，再编写视图模板
3. 严格遵循代码风格规范（见下方"代码风格规范"章节）
4. 每完成一个组件，更新 `_workflow_state.json`

### B3：文档编写
**直接执行**（Storybook / Histoire / VitePress 中编写使用示例）

### B4：测试验证
**调度子代理**：`agents/delivery-tester.md`

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行测试验证
3. 完成后更新 `_workflow_state.json`

---

## 分支 C：工具库 / npm 包（导出函数 / 工具类）

适用于：工具函数库、SDK、通用模块等。

```
API 设计 ──→ 实现 ──→ 测试验证
   │          │          │
   ▼          ▼          ▼
agents/    直接执行    agents/
requirement  （纯逻辑  delivery
-analyst.md  优先）    -tester.md
```

### C1：API 设计
**调度子代理**：`agents/requirement-analyst.md`（使用"工具库"校验清单）

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行需求校验清单
3. 完成后写入 `.agent/requirement_context.json` + 更新 `_workflow_state.json`

校验项：
- ✅ 功能需求描述
- ✅ 导出 API 设计（函数签名、参数、返回值）
- ✅ 类型定义规划
- ⚪ 是否需要 Tree-shaking 支持

### C2：实现
**直接执行**

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/requirement_context.json`
2. 按 types → 实现 → 导出 的顺序开发，确保类型先行
3. 严格遵循代码风格规范（见下方"代码风格规范"章节）
4. 每完成一个模块，更新 `_workflow_state.json`

### C3：测试验证
**调度子代理**：`agents/delivery-tester.md`

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行测试验证
3. 完成后更新 `_workflow_state.json`

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
```

### D1：内容规划
**调度子代理**：`agents/requirement-analyst.md`（使用"文档站"校验清单）

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行需求校验清单
3. 完成后写入 `.agent/requirement_context.json` + 更新 `_workflow_state.json`

校验项：
- ✅ 文档目标受众
- ✅ 内容结构 / 目录大纲
- ✅ 是否需要 API 文档自动生成

### D2：内容编写
**直接执行**

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/requirement_context.json`
2. 严格遵循代码风格规范（见下方"代码风格规范"章节）
3. 每完成一个章节，更新 `_workflow_state.json`

### D3：构建预览
**调度子代理**：`agents/delivery-tester.md`

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行构建与预览验证
3. 完成后更新 `_workflow_state.json`

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
```

### E1：命令设计
**调度子代理**：`agents/requirement-analyst.md`（使用"CLI"校验清单）

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行需求校验清单
3. 完成后写入 `.agent/requirement_context.json` + 更新 `_workflow_state.json`

校验项：
- ✅ 命令列表和参数设计
- ✅ 交互模式（交互式 / 非交互式）
- ✅ 错误处理策略

### E2：实现
**直接执行**

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/requirement_context.json`
2. 按 types → 核心逻辑 → CLI 入口 的顺序开发
3. 严格遵循代码风格规范（见下方"代码风格规范"章节）
4. 每完成一个命令，更新 `_workflow_state.json`

### E3：测试验证
**调度子代理**：`agents/delivery-tester.md`

**执行协议**：
1. 第一步：读取 `.agent/_workflow_state.json` + `.agent/project_context.json`
2. 执行测试验证
3. 完成后更新 `_workflow_state.json`

---

## 代码风格规范

所有前端项目**必须**遵循以下代码风格规范（详见 `references/` 目录）：

| 规范文件 | 内容 |
|---|---|
| `references/js-style.md` | JS 变量、函数命名（小驼峰） |
| `references/ts-style.md` | TS 类型/接口（大驼峰）、常量（全大写下划线） |
| `references/vue-style.md` | Vue SFC 标签顺序、Composable 命名 |
| `references/react-style.md` | React 组件结构、Hooks 命名 |
| `references/common-style.md` | 目录命名（除组件外小驼峰）、功能内聚、文件命名、注释 |

**核心原则**：
- 变量/函数 — 小驼峰 `handleSearch`、`tableData`
- 类型/接口 — 大驼峰 `UserRecord`、`OrderQueryParams`
- 常量 — 全大写下划线 `DEFAULT_PAGE_SIZE`
- 组件目录 — PascalCase `FormDrawer/`
- 其他目录 — 小驼峰 `userManagement/`
- 功能内聚 — 相关组件、config、hooks、types 放在同一目录下，不跨目录找

---

## 工具调用优先级

1. **MCP**：优先通过 MCP 服务完成（如浏览器自动化、API 测试等）
2. **Skills + CLI**：MCP 无法覆盖时，使用已安装的 Skills 或 CLI 工具
3. **禁止**：直接使用浏览器脚本模拟

## 与其他 Skills 的关系

| Skill | 关系 |
|-------|------|
| `vue` / `nuxt` / `pinia` 等 | 技术栈知识注入，本协议负责流程编排与护栏执行 |
| `playwright` | E2E / 交互测试能力，由交付测试子代理按需调用 |
| `vitest` | 单元/组件测试能力，由交付测试子代理按需引用 |
| `vitepress` | 文档站构建知识，分支 D 场景使用 |
| `slidev` | 演示文稿工具，不在本协议范围内 |

## 扩展说明

本协议会持续注入前端专属控制协议与执行护栏。任何前端技术栈上下文内，本规则始终保持最高优先级。三条核心协议（状态持久化、I/O 契约、无头逻辑前置）为硬性约束，违反即视为流程违规。
