---
name: spec-workflow
---

# Spec Workflow（变更规格工作流）

把一次变更立项为可追溯、可归档的书面 spec 契约。propose → apply → archive 三态，第一方自建（零外部依赖），产物落在 `.airules/`。这是"书面持久化层"——需求/计划的方法论仍由 `brainstorming` / `writing-plans` / `test-design` 承担，本 skill 只负责把结论固化成可机读、可合并的规格。

## 触发条件

触发当且仅当满足下列之一：

- 用户显式要把一次变更正式立项、记录为可追溯 spec 契约时按名调用；或
- 变更会新增/修改/废弃**外部可观察的系统行为契约**（公共 API、跨模块协议、状态机、权限规则、数据一致性规则、持久化数据模型、兼容性/破坏性变化），**且该契约值得作为长期事实源维护**（后续多 agent/多模块/多团队会依赖，缺书面 spec 会导致实现/评审/回归无法稳定判定）。

技术对象类型（接口/状态机/数据一致性）只是常见例子，不是充分触发条件——关键是契约是否变化且是否值得长期沉淀。

## 不适合场景

- 主代理普通对话不主动加载本 skill（故省略 description），不自动触发。
- 纯内部实现重构且行为等价 → 不触发。
- 小改、L0/L1、局部 bugfix 且不改长期契约 → 不必立项 spec，直接走编码流水线。
- 纯探索、纯文档、纯格式调整 → 不需要 spec。
- 只需一次性实现计划、不需归档为长期事实源的任务 → 走方法论层即可。

## 三态流程

### propose（提案）
1. 先用 `brainstorming` 想清需求、`writing-plans` 拆任务、`test-design` 定验收（方法论），不在本 skill 重复需求分析。
2. `node <init-project-skill>/scripts/spec-new-change.mjs <project> <change-id>` 建变更骨架（只创建 `changes/<change-id>/specs/` 目录）。
3. 填写：
   - **需求文档**：在 `.airules/requirements/<change-id>.md` 的 `## 契约影响摘要` 节写明变更类型（新增/修改/废弃）和涉及契约路径——这是 proposal 的替代，需求事实源与契约动机合并在同一文件，无需单独 `proposal.md`。
   - **任务文档**：在 `.airules/tasks/<change-id>.md`（由 `writing-plans` 产出）的 `## 需求来源 / 契约来源` 字段写明 `change-id`，作为反向关联——无需单独 `tasks.md`。
   - `specs/<capability>/spec.md`：delta，用 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements`；每个 `### Requirement:` 正文含 SHALL/MUST，下挂 `#### Scenario:`。
4. `node <init-project-skill>/scripts/spec-validate.mjs <project> <change-id>` 校验 delta 格式合法。

### apply（实现）
- coder 以 `.airules/tasks/<change-id>.md` 为输入（由 `writing-plans` 落档，其"需求来源/契约来源"字段引用本 change-id），按任务实现步骤逐条落地；无需在 `changes/` 目录内维护勾选清单。
- 实现中发现需求/规格需变，回到 propose 修订 `.airules/requirements/<change-id>.md` 和 delta spec，不在实现里偷改契约。

### archive（归档）

前置条件分两类门禁，缺一不归档：

- **流程门禁**（主代理基于阶段证据负责，脚本无法检查）：实现完成、验证 PASS、一致性评审 PASS 或 N/A、代码评审无阻塞项。脚本成功 ≠ 流程满足——测试/评审/一致性状态由主流程 evidence schema 负责。
- **脚本门禁**（`spec-archive.mjs` 强制检查）：默认 ≥1 delta spec、delta 合并无冲突。

执行：`node <init-project-skill>/scripts/spec-archive.mjs <project> <change-id>`。

- 脚本门禁不满足（无 delta）时 **FAIL 不归档**。
- `--allow-empty` 仅跳过 delta spec 存在性要求；它只是用户显式要求把治理决策/流程规则/纯文档变更作为可追溯 change 归档时的例外，不是普通文档变更的默认入口。普通纯文档/纯流程/纯格式变更应直接不触发 spec-workflow。
- 门禁通过后：把 delta 合并进 `.airules/specs/<capability>/spec.md`（应用顺序 RENAMED→REMOVED→MODIFIED→ADDED），再把 change 移到 `.airules/changes/archive/<date>-<change-id>/`。

## 写入边界与约束

- 只写 `.airules/specs/` 与 `.airules/changes/`，不碰生产代码（代码由编码流水线写）。
- `changes/<change-id>/` 只包含 `specs/<capability>/spec.md` delta 文件，不创建 `proposal.md` 或 `tasks.md`；契约动机记录在 `.airules/requirements/<change-id>.md` 的"契约影响摘要"节，任务进度记录在 `.airules/tasks/<change-id>.md`。
- delta 格式须合法：ADDED/MODIFIED 必须有 SHALL/MUST 正文 + ≥1 Scenario。
- archive 前置条件不满足（无 delta）**硬失败、不归档**；合并冲突（ADDED 已存在 / MODIFIED 或 REMOVED 未找到 / 跨段冲突）**硬失败、不静默、不部分写**；冲突时修正后重跑。
- 新 capability（主 spec 不存在）只允许 ADDED。
- 与编码编排串联：spec-workflow 管"契约书面化"，不替代 brainstorming/writing-plans/test-design 的方法论。
