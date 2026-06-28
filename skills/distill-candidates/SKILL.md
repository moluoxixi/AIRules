---
name: distill-candidates
description: 当用户说"提炼/沉淀这些会话/distill/从会话里提炼 skill 和记忆"时触发，扫描会话记录与变更，双路提炼出 skill 候选与记忆候选，两类都进候选区待人工审核转正。
---

# Distill Candidates（从会话提炼候选）

扫描 `.airules/sessions/` 与 `.airules/changes/`，双路提炼：

- **procedural（怎么做）** → skill 候选，落 `.airules/skills-candidates/`。
- **declarative（是什么、为什么）** → 记忆候选，落 `.airules/memory-candidates/`。

两类候选**永不自动生效、永不自动加载**，一律待人工审核转正。本 skill 只产出候选，不写正式 skills 目录、不写正式 memory 库。

## 触发条件

- 用户显式说"提炼 / 把这些沉淀成 skill / 从会话里提炼记忆 / distill"时按名调用。

## 不适合场景

- 主代理普通对话不主动加载本 skill（description 用于按名/按场景触发，但不在普通对话强插）。
- 素材不足（`.airules/sessions/` 与 `.airules/changes/` 为空或无可提炼内容）→ 报告无可提炼项，不硬凑。
- 单条明确事实、用户当场口述要记 → 直接走 `remember` 即写，不必绕候选流程。

## 双路判据

同一批素材按"怎么做 vs 是什么/为什么"分两路，判据不同：

| 路 | 判据（何时提炼） | 产物 | 落点 |
|---|---|---|---|
| **procedural** | 跨多次出现、有清晰触发场景、可验证的可复用做法（**攒够模式才提**，单次偶发不提） | skill 候选 | `.airules/skills-candidates/<name>/SKILL.md` |
| **declarative** | 单条即有长期保留价值的事实/决策理由/约束/带根因的踩坑（**单条即可提**，不需反复出现） | 记忆候选 | `.airules/memory-candidates/<slug>.md` |

判据差异的根由：skill 改变行为、需攒够模式确认其可复用；记忆是背景事实、出现一次即有值。两路不互斥——一条素材可能只命中一路。

## 流程

1. 读取 `.airules/sessions/*.md` 与 `.airules/changes/`（含 archive）。优先用条目自带的 `[procedural]` / `[declarative]` 分流标签；无标签的按上表语义判定。
2. **procedural 路**：对每个 skill 候选，在 `.airules/skills-candidates/<name>/SKILL.md` 写草稿，标注来源（哪些 session/change 支撑）。
3. **declarative 路**：对每条记忆候选，在 `.airules/memory-candidates/<slug>.md` 写草稿（frontmatter 同正式记忆格式：`name` / `description` / `metadata.type`），标注来源。
4. 输出统一"待审清单"，两类分组列出：候选名/slug、一句话职责或事实、类型、来源依据；交用户逐个 review。

## 候选草稿质量标准

### skill 候选

- **命名**：动词在前、描述动作的主动式（如 `condition-based-waiting` 优于 `async-test-helpers`），与目录名一致。
- **触发条件**：用具体场景/症状/上下文描述"什么时候用"，技术无关除非候选本身绑定特定技术。
- **不适合场景**：显式写"什么时候不该用"，划清边界。
- **可验证**：候选应能被纯净测试复核——干净隔离子代理仅凭规则与候选能否产出预期产物。
- **聚焦单一职责**：一个候选解决一类问题，内容能 hold 在上下文里；过长参考材料拆独立文件。

### 记忆候选

- frontmatter 完整：`name`（kebab-case，与文件名一致）、`description`（recall 判定相关性用）、`metadata.type`（`decision` / `gotcha` / `constraint` / `reference`）。
- `decision` 须含理由，`gotcha` 须含 `**根因:**` 与 `**规避:**`。
- 单条聚焦一个事实，不把多个无关事实塞一条。

## 审核转正

候选区的内容由用户审核后**显式转正**，本 skill 不自行提升：

- 批准的 **skill 候选** → 用户显式操作迁入项目 skills 目录。
- 批准的 **记忆候选** → 交 `remember` 转正写入 `.airules/memory/` 并登记 `MEMORY.md`。

## 写入边界与约束

- **候选永不自动生效**：只写 `.airules/skills-candidates/` 与 `.airules/memory-candidates/`，绝不直接写项目 skills 目录或正式 `.airules/memory/`，绝不被主代理自动加载。
- **scope 默认项目局部**：提炼出的候选默认属当前项目（项目局部 skill / 项目 memory）。判断为全局可复用者，标注为**上游贡献候选**交人工决定是否回流 AIRules 升级为全局可分发 skill；本 skill 不在用户项目内自行把候选升级为全局资产，也不写 `constants/skills.ts`。
- 提炼必须基于真实沉淀/变更证据，不得脑补、不得把单次偶发当可复用模式、不得把示例内容当真实事实。
- 候选草稿正文须标注 `PENDING_REVIEW` / 候选 / 待确认性质。
- **脱敏**：记忆候选不写密钥、token、密码、PII；敏感值按 key 名引用。
- 不得写 `vendor/`、`node_modules/`、`.git/`；`memory-candidates/` 不存在时按需创建。
