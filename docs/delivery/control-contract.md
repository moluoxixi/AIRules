# 交付控制契约

## 目标

AIRules 交付物必须让使用者在开发全流程中获得明确控制点：输入有边界、过程有触发、失败会暴露、检查可执行、结果可审计。该契约用于约束随包分发的 `rules/`、`skills/`、`scripts/`、CI 与文档模板，不承诺替代使用者项目自身的业务测试和发布审批。

## 三层控制面

| 控制面 | 交付资产 | 控制目标 | 失败语义 |
|---|---|---|---|
| 规则层 | `rules/AGENTS.md`、宿主引导文件 | 统一禁止事项、边界校验、错误传播、lint 与验证口径 | 规则缺失或冲突时标记 `FAIL` |
| 技能层 | `skills/*/SKILL.md`、精选第三方 skills | 在需求、设计、实现、调试、测试、评审和交付阶段触发对应流程 | 缺少触发条件、边界或输出约束时标记 `FAIL` |
| 执行层 | `scripts/`、`package.json` scripts、CI、PR checklist | 用可运行命令验证交付资产和宿主安装状态 | 脚本缺失、退出码失败或未执行时标记 `FAIL` / `MISSING` / `NOT RUN` |

## 环节控制矩阵

| 开发环节 | 主要控制资产 | 必需控制点 | 验证方式 |
|---|---|---|---|
| 项目初始化 | `init-project`、`rules/AGENTS.md` | 规则注入、宿主引导、知识源登记、CodeGraph 初始化 | `npm run delivery:verify` 与宿主 `airules verify` |
| 需求进入 | `prd-docs`、`knowledge-search` | 背景、范围、用户流程、字段口径、验收标准、缺失项状态 | 文档缺失标记 `MISSING`，不得用推断补事实 |
| 架构设计 | `architecture-docs` | 模块边界、依赖方向、数据流、权限模型、ADR | 新增或变更架构同步更新索引和 ADR |
| API/组件契约 | `api-docs`、`components-docs` | 请求响应、错误码、字段含义、联调状态、组件边界 | 契约文档与全局协议不冲突 |
| 实现编码 | `rules/AGENTS.md`、TDD/调试类 skills | 边界校验在入口，内部不重复防御；错误显式暴露 | lint/typecheck/test 按任务风险执行 |
| 调试修复 | `systematic-debugging`、`retrospective-correction` | 先定位根因，再修复；偏差按严重程度处理 | 修复说明包含原因、影响面和验证结果 |
| 测试验证 | `test-docs`、`verification-before-completion` | 测试策略、用例矩阵、回归范围、真实命令输出 | 统一使用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A` |
| 代码评审 | `code-reviewer`、`requesting-code-review` | 安全、质量、规则符合性、测试充分性 | 发现问题必须修复或标记明确范围 |
| 交付发布 | `delivery:verify`、CI、发布 workflow | 交付资产齐备、包内文件完整、质量门禁通过 | 任一门禁失败不得声明可交付 |

## 质量门禁

交付前按风险选择检查，但不得把缺失或失败写成通过：

| 门禁 | 命令 | 场景 | 结果口径 |
|---|---|---|---|
| 交付控制资产 | `npm run delivery:verify` | 修改 `rules/`、`skills/`、`scripts/`、README 或 docs 时 | 成功为 `PASS`，缺失资产为 `FAIL` |
| Skill 内容契约 | `node scripts/verify-skill-frontmatter.mjs --root skills/<skill-name>` | 新增或修改单个 first-party skill 时 | 单个 skill 逐个验证，不用总目录替代 |
| 类型检查 | `npm run typecheck` | 修改 TypeScript 源码、测试或配置时 | 编译错误为 `FAIL` |
| 单元测试 | `npm test` 或定向 Vitest | 修改脚本、投影、安装、验证逻辑时 | 失败测试为 `FAIL` |
| lint | `npm run lint:check` | 修改可 lint 的源码或测试时 | 不得关闭规则或缩小范围绕过失败 |
| 构建 | `npm run build` | 发布前或修改 CLI/runtime 输出时 | 构建失败为 `FAIL` |
| 覆盖率 | `npm run coverage` | 高风险逻辑、门禁脚本或发布前 | 阈值失败为 `FAIL`，无关缺口需标记范围 |

## PR 检查模板

以下模板用于 PR 描述或交付报告，未执行项必须说明原因：

```markdown
## 控制面变更

- 规则层：PASS / FAIL / MISSING / NOT RUN / N/A - <说明>
- 技能层：PASS / FAIL / MISSING / NOT RUN / N/A - <说明>
- 执行层：PASS / FAIL / MISSING / NOT RUN / N/A - <说明>

## 实际验证

| 检查 | 命令 | 状态 | 结果 |
|---|---|---|---|
| 交付控制资产 | npm run delivery:verify | NOT RUN | <原因> |
| 类型检查 | npm run typecheck | NOT RUN | <原因> |
| 测试 | npm test | NOT RUN | <原因> |
| lint | npm run lint:check | NOT RUN | <原因> |
| 构建 | npm run build | NOT RUN | <原因> |
```

## 使用边界

- 该契约控制 AIRules 自身的可分发资产，不替代下游项目的业务验收、合规审查和发布审批。
- 使用者项目缺少测试、lint、CI 或发布脚本时，交付报告必须标记 `MISSING`，不得伪造成 `PASS`。
- 第三方宿主、外部服务、模型行为和用户本地环境不可完全强制，只能通过规则、skills、脚本和 CI 增强可控性。
- 示例、模板和矩阵是控制结构，不是业务事实来源；业务事实必须来自用户确认、项目文档、代码或外部接口证据。
