# AIRules Development Workflow

本角色使用一条由 change unit 驱动的研发主线。OpenSpec change 目录是需求、设计、任务和验证产物的事实源；`.airules/workflow/bin/workflow.mjs` 是唯一状态写入口。

## 不可违反的约束

1. 开始非平凡变更前创建 change：`node .airules/workflow/bin/workflow.mjs init <change>`。
2. 状态只能由带证据和幂等键的 gate 结果推进，Agent 不得自行宣称完成。
3. Product 提供业务事实；Development 仍负责可实现性、API、权限、状态、持久化和可测试性检查。
4. 每个规格场景使用 `SCN-<capability>-<NNN>`；测试设计使用 `covers: SCN-*`。
5. 先分类失败再修复。不得把需求缺口、测试 oracle 错误、环境故障或安全阻断一律交给 coder 重试。
6. 同一失败签名重复出现会进入 `blocked`；不得静默重跑到绿色或降低门禁。
7. 原始会话只能进入临时上下文或 change memory。正式 memory、skill、rule、hook、agent 必须经过候选、去敏、冲突检查、eval 和审核。
8. 外部框架和 skills 是处理器，不拥有第二套规格、任务、完成状态或长期记忆。

## 标准阶段

`intake -> spec-ready -> plan-ready -> test-ready -> implementing -> verifying -> review-ready -> release-ready -> learning -> done`

使用 `workflow-control` 查看每个状态所需 gate。需求、架构、测试、实现、自动验证、独立评审、发布和学习证据必须依次落账。

## 处理器路由

- 模糊需求：`requirements-engineering`，必要时使用 Superpowers brainstorming 或 gstack plan review。
- 设计与计划：Superpowers writing-plans；API 和模块边界由 architect 复核。
- 实现：Superpowers test-driven-development 和 systematic-debugging；只读取当前 task 的最小上下文。
- 测试证据：`test-evidence`；UI/E2E 变更按风险使用 `gstack-qa` 或 `playwright-openai`。
- 纠错：`correction-loop`；先记录 failure class 和证据，再回退到责任阶段。
- 独立验证：verifier 或 `gstack-review`，不能由实现者自行替代。
- 记忆和沉淀：`memory-governance`；正式晋升前使用 ECC eval/continuous-learning 能力验证候选。

## 完成定义

只有以下条件全部满足才可进入 `done`：场景与测试可追踪、任务完成、自动化和独立评审通过、发布证据存在、retrospective 已生成候选或明确无候选，并且 `replay` 与 change snapshot 一致。
