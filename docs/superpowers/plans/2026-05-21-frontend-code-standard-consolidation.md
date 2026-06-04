# Frontend Code Standard Consolidation Implementation Plan

> Superseded: 当前实现已删除静态代码规范 skill，并改为安装 CodeGraph 作为代码图谱入口；本文仅保留为历史计划记录，不再代表现行 skill 架构。

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前分散的前端组件、模块、工具库和 UI 库标准收敛为一个前端总 skill，统一入口判断、目录边界和评审口径，同时保留 simple / complex 的清晰分层。

**Architecture:** 新增唯一权威的 `frontend-code-standard`，把通用边界规则、Vue / React 差异、组件 / 模块 / 工具库 / UI 库分类、评审输出格式和自校验脚本放在同一套资料里。外部入口只看一个 skill，内部仍按职责拆成示例、验证清单和脚本，避免把简单单元过度包装成目录型结构。

**Tech Stack:** Markdown, Node.js, Vitest, 现有 `scripts/verify-rules.mjs` 约定, 现有 `tests/workflow-policy.test.ts`

---

## File Map

- Create: `skills/workflow/frontend-code-standard/SKILL.md`
- Create: `skills/workflow/frontend-code-standard/examples/business-module.md`
- Create: `skills/workflow/frontend-code-standard/examples/component.md`
- Create: `skills/workflow/frontend-code-standard/examples/utility.md`
- Create: `skills/workflow/frontend-code-standard/examples/types-and-imports.md`
- Create: `skills/workflow/frontend-code-standard/examples/review-output.md`
- Create: `skills/workflow/frontend-code-standard/validation/checklist.md`
- Create: `skills/workflow/frontend-code-standard/scripts/verify-rules.mjs`
- Modify: `skills/workflow/software-development-workflow/SKILL.md`
- Modify: `skills/workflow/frontend-review-standard/SKILL.md`
- Modify: `skills/workflow/frontend-review-standard/validation/checklist.md`
- Modify: `skills/workflow/frontend-review-standard/scripts/verify-rules.mjs`
- Modify: `README.md`
- Modify: `README-zh.md`
- Modify: `tests/workflow-policy.test.ts`
- Delete or deprecate: `skills/workflow/vue-component-standard/`
- Delete or deprecate: `skills/workflow/react-component-standard/`
- Delete or deprecate: `skills/workflow/vue-module-standard/`
- Delete or deprecate: `skills/workflow/react-module-standard/`
- Delete or deprecate: `skills/workflow/frontend-library-standard/`

## Task 1: 建立单一前端总 skill

**Files:**
- Create: `skills/workflow/frontend-code-standard/SKILL.md`
- Create: `skills/workflow/frontend-code-standard/examples/business-module.md`
- Create: `skills/workflow/frontend-code-standard/examples/component.md`
- Create: `skills/workflow/frontend-code-standard/examples/utility.md`
- Create: `skills/workflow/frontend-code-standard/examples/types-and-imports.md`
- Create: `skills/workflow/frontend-code-standard/examples/review-output.md`
- Create: `skills/workflow/frontend-code-standard/validation/checklist.md`
- Create: `skills/workflow/frontend-code-standard/scripts/verify-rules.mjs`

- [ ] **Step 1: 写出统一分类和边界规则**

`SKILL.md` 必须同时覆盖以下内容：

- Vue 3 标准
- React 标准
- 组件标准
- 业务模块标准
- 工具包与 UI 组件库标准
- 评审输出

`SKILL.md` 还必须明确这些分类名：

- `simple-component`
- `component-package`
- `business-module`
- `ordinary-module`
- `utility-library`
- `ui-library`

核心判断必须落在“是否形成独立公开契约、是否需要稳定入口、是否存在可命名的私有子职责”上，而不是只按文件数量分级。

- [ ] **Step 2: 写出 5 份示例文件**

`examples/business-module.md`、`examples/component.md`、`examples/utility.md`、`examples/types-and-imports.md`、`examples/review-output.md` 要分别承载模块、组件、工具库、类型组织和评审输出示例，不定义新规则。

示例中要保留这些关键形态：

- 页面模块围绕 `index.vue` / `index.tsx` 展开，公共代码按最近公共父级上浮
- 复杂组件包使用 `README.md + index.ts + src/`
- 工具库使用 `README.md + index.ts + src/`
- 类型示例保留 `props.ts`、`ref.ts`、`emit.ts`、`expose.ts`
- 评审示例包含 `目标分类`、`检查范围`、`总结论`、`问题列表`、`改动建议汇总`

- [ ] **Step 3: 写出自校验脚本**

`scripts/verify-rules.mjs` 需要支持这些命令：

- `self`
- `simple-component`
- `component`
- `module`
- `utility`
- `ui-library`
- `hoist`

脚本要检查：

- `self` 校验 skill 文本、示例和清单是否完整
- `simple-component` 校验单文件组件结构
- `component` 校验复杂组件包结构
- `module` 校验模块结构和 `src/` 约束
- `utility` 校验工具库结构
- `ui-library` 校验 UI 库结构
- `hoist` 校验公共代码是否落在最近公共父级

- [ ] **Step 4: 对齐脚本输出和测试断言**

脚本输出需要和测试里的期望字符串保持一致，例如：

- `PASS frontend-code-standard self rules are valid`
- `PASS frontend simple component structure is valid`
- `PASS frontend complex component package structure is valid`
- `PASS frontend module structure is valid`
- `PASS frontend utility library structure is valid`
- `PASS frontend UI component library structure is valid`
- `PASS frontend hoist target stays under nearest common ancestor`

## Task 2: 把共享入口文档切到新 skill

**Files:**
- Modify: `skills/workflow/software-development-workflow/SKILL.md`
- Modify: `skills/workflow/frontend-review-standard/SKILL.md`
- Modify: `skills/workflow/frontend-review-standard/validation/checklist.md`
- Modify: `skills/workflow/frontend-review-standard/scripts/verify-rules.mjs`
- Modify: `README.md`
- Modify: `README-zh.md`

- [ ] **Step 1: 更新软件开发流程里的关联标准**

`software-development-workflow/SKILL.md` 里的前端关联标准要改成只引用 `frontend-code-standard`，不再把 Vue / React / module / library 分散成多个一级入口。

- [ ] **Step 2: 更新前端评审标准的来源引用**

`frontend-review-standard/SKILL.md` 要改成只说明：

- 它本身只负责评审输出格式
- 实现规则统一来自 `frontend-code-standard`

`frontend-review-standard/scripts/verify-rules.mjs` 和 `validation/checklist.md` 也要同步去掉旧 skill 名称，改为检查对新总 skill 的引用。

- [ ] **Step 3: 更新 README 的目录和技能表**

`README.md` 和 `README-zh.md` 里的第一方 Skills 表、项目结构树、说明文字都要改成只展示一个前端总 skill。

这里要同步完成两件事：

- 删除 `frontend-component-standard`、`frontend-module-standard`、`frontend-library-standard` 这些旧称呼
- 保留对“组件 / 模块 / 工具库 / UI 库”的说明，但把它们放进同一个前端总 skill 里

## Task 3: 用测试锁定新的唯一入口

**Files:**
- Modify: `tests/workflow-policy.test.ts`

- [ ] **Step 1: 改写对 skill 名称的断言**

把 `tests/workflow-policy.test.ts` 里关于前端部分的断言改成只检查：

- `skills/workflow/frontend-code-standard/SKILL.md`
- `skills/workflow/frontend-code-standard/examples/*.md`
- `skills/workflow/frontend-code-standard/scripts/verify-rules.mjs`

同时保留对 `README.md`、`README-zh.md`、`frontend-review-standard` 和 `software-development-workflow` 的引用检查。

- [ ] **Step 2: 锁定示例和脚本命令**

测试要继续锁定这些行为：

- 示例文件列表必须固定
- `SKILL.md` 必须同时包含 Vue、React、组件、模块、工具库、UI 库和评审输出的规则
- 自校验脚本必须覆盖 `component`、`module`、`utility`、`ui-library`、`simple-component`、`hoist`

- [ ] **Step 3: 去掉对旧前端 skill 的正向依赖**

如果旧 skill 目录被删除，测试就不再依赖它们。
如果旧 skill 目录保留为过渡层，测试只能把它们当成兼容细节，不能再把它们当成规范源。

## Task 4: 清理旧分裂 skill

**Files:**
- Delete or deprecate: `skills/workflow/vue-component-standard/`
- Delete or deprecate: `skills/workflow/react-component-standard/`
- Delete or deprecate: `skills/workflow/vue-module-standard/`
- Delete or deprecate: `skills/workflow/react-module-standard/`
- Delete or deprecate: `skills/workflow/frontend-library-standard/`

- [ ] **Step 1: 确定迁移策略**

推荐的最终态是：只保留 `frontend-code-standard` 作为唯一权威前端实现标准。

如果评审担心一次性删除风险，可以先把旧 skill 改成极短的迁移说明，再在下一轮直接删除。

- [ ] **Step 2: 删除或收缩旧目录**

每个旧目录都不再承载自己的规则，只允许留下极薄的过渡说明，避免继续分裂维护。

- [ ] **Step 3: 校验仓库只剩一个前端权威入口**

确认 README、workflow skill、review skill 和测试都指向新 skill，没有再把旧 skill 当规则源。

## Task 5: 验证与收口

**Files:**
- All changed files

- [ ] **Step 1: 跑前端 policy 测试**

运行：

`npm test -- tests/workflow-policy.test.ts`

预期：通过，并且所有 `frontend-code-standard` 相关断言成立。

- [ ] **Step 2: 跑 skill 结构校验测试**

运行：

`npm test -- tests/skill-validation.test.ts`

预期：通过，新增 skill 能被自动发现，旧 skill 的处理策略与测试断言一致。

- [ ] **Step 3: 跑全量 lint / test**

运行：

`npm run lint`
`npm test`

预期：通过；如果因为旧 skill 删除导致某个测试依赖失效，要在本轮修正，不允许带着失败收尾。

## Review Notes

- 这次合并的核心不是“目录长得更整齐”，而是把前端边界判断从多个并列技能收敛成一套统一标准。
- 如果评审认为“旧 skill 先留着更稳”，那就保留过渡层，但要明确它们不是规则源。
- 如果评审认为“一个 skill 就应该真的只剩一个”，那就直接删除旧目录，不留双轨。
