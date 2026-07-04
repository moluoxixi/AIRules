---
name: distill-candidates
description: 在用户要求提炼/沉淀会话、从会话里提炼 skill 和记忆，或说 distill 时触发。用于扫描会话记录与 OpenSpec 变更，产出 skill 候选和记忆候选并进入待审流程。
---

# Distill Candidates（从会话提炼候选）

扫描 `knowledge/sessions/` 与 `openspec/changes/`，双路提炼：

- **做法类（`procedural`）**：说明"什么时候该怎么做" → skill 候选，落 `knowledge/skills-candidates/`。
- **事实类（`declarative`）**：说明"是什么、为什么、踩过什么坑" → 记忆候选，落 `knowledge/memory-candidates/`。

两类候选**永不自动生效、永不自动加载**，一律待人工审核转正。本 skill 只产出候选，不写正式 skills 目录、不写正式记忆库。

## 触发条件

- 用户显式说"提炼 / 把这些沉淀成 skill / 从会话里提炼记忆 / distill"时按名调用。

## 不适合场景

- 主代理普通对话不主动加载本 skill（description 用于按名/按场景触发，但不在普通对话强插）。
- 素材不足（`knowledge/sessions/` 与 `openspec/changes/` 为空或无可提炼内容）→ 报告无可提炼项，不硬凑。
- 单条明确事实、用户当场口述要记 → 直接走 `remember` 即写，不必绕候选流程。

## 双路判据

同一批素材按"怎么做 vs 是什么/为什么"分两路，判据不同：

| 路 | 判据（何时提炼） | 产物 | 落点 |
|---|---|---|---|
| **做法类**（`procedural`） | 多次出现、有清晰触发场景、可验证、以后能照着做（**攒够模式才提**，单次偶发不提） | skill 候选 | `knowledge/skills-candidates/<name>/SKILL.md` |
| **事实类**（`declarative`） | 单条就值得长期保留的事实、决策理由、约束、带根因的踩坑（**单条即可提**） | 记忆候选 | `knowledge/memory-candidates/<slug>.md` |

判据不同是因为：skill 会改变 agent 以后怎么做，必须确认它真能复用；记忆只是背景事实，出现一次也可能很有价值。两路不互斥，一条素材可能只命中一路。

## 库级健康复核（淘汰/合并候选）

闭环不能只增不减。只提炼新候选、从不复核旧内容，库会变成没人敢用的指令堆。提炼时顺手检查已有 skill / 记忆，发现退化信号时产出**淘汰/合并候选**（同样落候选区、待人工审核，绝不自动删除）：

- **长期不被触发**：skill 的触发场景在近期 `sessions/`、`changes/` 中从未命中——疑似过时或与他者重叠，提合并/淘汰候选。
- **触发但屡被覆盖/绕过**：素材显示某 skill/记忆被加载后，实际执行频繁偏离或被用户纠正——疑似指令失效或与现状冲突，提复核候选。
- **记忆已 superseded 或事实失效**：`status: superseded`、或正文命名的文件/接口已不存在——提归档/删除候选。
- **重复/碎片**：多条记忆或多个 skill 覆盖同一事实/职责——提合并候选。

AIRules 是纯提示词项目，没有可靠的运行时计数器。上述信号靠**扫描沉淀素材后的人工判断**得出，不要求每条 skill/记忆维护精确的 `recall_count`/`override_count` 字段。淘汰/合并一律只是候选，人工审核后才执行。

## 流程

1. 读取 `knowledge/sessions/*.md` 与 `openspec/changes/`（含 archive）。优先用条目自带的 `[procedural]` / `[declarative]` 标签；无标签的按上表语义判定。
2. **做法类**：对每个 skill 候选，在 `knowledge/skills-candidates/<name>/SKILL.md` 写草稿，文件开头的元信息里写 `review_status: pending`，并标注来源。
3. **事实类**：对每条记忆候选，在 `knowledge/memory-candidates/<slug>.md` 写草稿，文件开头的元信息与正式记忆相同，额外写 `review_status: pending`，并标注来源。
4. 输出统一"待审清单"，分组列出：新增 skill 候选、新增记忆候选、淘汰/合并候选；每条写清名称、一句话说明、来源依据和建议动作。可运行 `npm run candidates:review list` 查看当前候选区。

## 候选草稿质量标准

### skill 候选

- **命名**：动词在前、描述动作的主动式（如 `condition-based-waiting` 优于 `async-test-helpers`），与目录名一致。
- **触发条件**：用具体场景/症状/上下文描述"什么时候用"，技术无关除非候选本身绑定特定技术。
- **不适合场景**：显式写"什么时候不该用"，划清边界。
- **可验证**：候选应能被纯净测试复核——干净隔离子代理仅凭规则与候选能否产出预期产物。
- **聚焦单一职责**：一个候选解决一类问题，内容能 hold 在上下文里；过长参考材料拆独立文件。

### 记忆候选

- 文件开头的元信息必须完整：`name`（短横线命名，与文件名一致）、`description`（给 recall 判断相关性用）、`metadata.type`（`decision` / `gotcha` / `constraint` / `boundary` / `reference`）、`metadata.created_at`（提炼当日）、`metadata.status`（候选默认 `active`）、顶层 `review_status`（候选一律 `pending`）。
- `decision` 须含理由，`gotcha` 须含 `**根因:**` 与 `**规避:**`，`boundary` 须写明触发条件与拒绝/谨慎动作。
- 单条聚焦一个事实，不把多个无关事实塞一条。

`review_status` 和 `metadata.status` 不是一回事：前者记"审核了没"（`pending` / `approved` / `rejected`），后者记"事实是否仍有效"（`active` / `superseded`）。写入正式库前，候选必须保持 `pending`；只有人工改成 `approved`，`remember` 才能转正。`npm run candidates:review validate` 会检查元信息能否解析、`review_status` 是否合法。

## 审核转正

候选区的内容由用户审核后**显式转正**，本 skill 不自行提升：

- 审核动作 = 把候选文件开头元信息里的 `review_status` 由 `pending` 改为 `approved`（采纳）或 `rejected`（弃用）。这是写入端唯一持久化的审核信号，重跑 distill 据此区分"已审"与"新提"，不靠人脑记忆。
- 批准的 **skill 候选**（`approved`）→ 用户显式操作迁入项目 skills 目录。
- 批准的 **记忆候选**（`approved`）→ 交 `remember` 转正写入 `knowledge/memory/` 并登记 `MEMORY.md`；`remember` 只转正 `approved`，拒绝 `pending`/`rejected`。

## 写入边界与约束

- **候选永不自动生效**：只写 `knowledge/skills-candidates/` 与 `knowledge/memory-candidates/`，绝不直接写项目 skills 目录或正式 `knowledge/memory/`，绝不被主代理自动加载。
- **默认属于当前项目**：提炼出的候选默认只属于当前项目。若看起来能全局复用，只标注为**上游贡献候选**，交人工决定是否回流 AIRules；本 skill 不自行把候选升级为全局资产，也不直接写任何 `roles/<role>/constants/skills.ts`。
- 提炼必须基于真实沉淀/变更证据，不得脑补、不得把单次偶发当可复用模式、不得把示例内容当真实事实。
- 候选草稿正文须标注 `PENDING_REVIEW` / 候选 / 待确认性质。
- **脱敏**：记忆候选不写密钥、token、密码、PII；敏感值按 key 名引用。
- 不得写 `vendor/`、`node_modules/`、`.git/`；`knowledge/memory-candidates/` 不存在时按需创建。
