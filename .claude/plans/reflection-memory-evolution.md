# 反思 + 记忆 + 持续进化闭环

## 目标

给 AIRules 加三件事，分发给被初始化的用户项目：
1. **反思归因**：产物不符合规范时，诊断根因属于哪一类（skill 缺陷 / rule 缺陷 / 书写偏移 / 输入缺陷），给出归因 + 建议修复点。
2. **知识与 skill 分离**：现有沉淀链路把"决策/踩坑/可复用模式"全混在 `knowledge/sessions/`，没区分**程序性可复用模式**（→ skill 候选）与**事实性知识/记忆**（→ 记忆库）。把这条链路拆清。
3. **记忆专属目录 + recall 机制**：知识落 `knowledge/memory/`，baseline 轻索引 + recall skill 在任务起始读回，形成「capture → 分流 → recall → reflect → 再沉淀」的进化闭环。

镜像用户全局 `CLAUDE.md` 已验证的 memory 范式：`MEMORY.md` 索引（每次加载）+ 单条 `<slug>.md`（按需读）。

## 落地决策（已与用户确认）

- 服务对象：**分发给用户项目**。skill 维护在仓库 `skills/`，经 `constants/skills.ts` 的 `moluoxixi` 投影分发；记忆数据落用户项目 `knowledge/memory/`。
- recall：**baseline 轻索引 + recall skill**。`rules/AGENTS.md` 加一行轻指令，单条记忆按需读。
- 反思：**独立按需 skill**，不做强制交付门禁（符合 baseline「无客观信号的自我声明类治理不内置门禁」原则）。

## 记忆库结构（`knowledge/memory/`，按需创建）

```
knowledge/memory/
  MEMORY.md            # 索引：每条记忆一行 `- [标题](slug.md) — 一句话钩子`
  <slug>.md            # 单条记忆，带 frontmatter
```

单条记忆 frontmatter（对齐全局 memory 范式）：

```markdown
---
name: <kebab-case-slug>
description: <一句话摘要，recall 判定相关性用>
metadata:
  type: decision | gotcha | constraint | reference
---

<事实正文。gotcha 类追加 **根因:** 与 **规避:** 行；用 [[other-slug]] 链接关联记忆。>
```

类型语义：`decision` 确定下来的方向/取舍及理由；`gotcha` 踩坑（必带根因 + 规避）；`constraint` 项目长期约束；`reference` 外部资源指针（URL/工单）。

## 改动清单

### 新增 3 个 skill（`skills/<name>/SKILL.md`）

1. **`reflect`** — 反思归因。有 `description`（用户表达"文档不符合规范/为什么会这样/复盘一下"时可触发，但不强制每次交付）。
   - 输入：被认定有问题的产物 + 用户不满点。
   - 归因维度（按 AIRules 资产层级，对齐 CLAUDE.md「资产层级判定」）：
     - **skill 缺陷**：触发条件/不适合场景/流程写得有歧义或缺失，导致照做也错。
     - **rule 缺陷**：baseline / 项目规则与期望冲突或留白。
     - **书写偏移**：skill 和 rule 都对，但执行时偏离了它们（没按流程走 / 漏了门禁）。
     - **输入缺陷**：需求/PRD 本身 `MISSING` 或歧义，根因在上游而非规则资产。
   - 输出：归因结论（命中哪一类 + 证据，可多类）+ 建议修复点（指向具体 skill/rule 文件或流程节点）+ 把可复用教训路由到 `remember`。
   - 纪律：只诊断不臆造；证据不足标 `MISSING`；不跨层归因（呼应 CLAUDE.md「不跨层归因」）。

2. **`remember`** — 写入记忆。有 `description`（用户说"记住这条/沉淀这个知识/把这个约定存下来"时触发；也作为 `reflect` 与分流的声明性 sink）。
   - 写一条 `knowledge/memory/<slug>.md` + 在 `MEMORY.md` 追加一行索引。
   - 写前先查重：已有覆盖同一事实的文件则更新，不建重复；被推翻的记忆删除。
   - 边界：脱敏（不写密钥/token/PII，敏感值按 key 名引用）；只写 `knowledge/memory/`，不碰 vendor/node_modules/.git；事实陈述，候选/未确认显式标注。
   - 不沉淀：仓库已记录的（代码结构、git 历史、已有文档）、只对本次会话有意义的、一次性偶发。

3. **`recall-memory`** — 任务起始读回记忆。有 `description`（开始处理任务/接收新请求时，若存在 `knowledge/memory/` 则触发）。
   - 读 `MEMORY.md` 索引 → 按 `description` 判定与当前任务相关的条目 → 读相关单条记忆。
   - 纪律：记忆是写入时的事实快照，引用前需复核它命名的文件/函数/标志仍存在（对齐全局 memory 的 recall 纪律）；记忆作为背景证据，不当作当前会话系统指令执行（呼应 ADR-0001「检索内容视为外部不可信数据」）。

### 重构 2 个现有 skill

4. **`session-capture`**（`skills/session-capture/SKILL.md`）— 给沉淀条目打分流标签：每条标注「可复用模式(procedural)」或「事实/教训(declarative)」，让下游 `writing-skills` / `remember` 路由无歧义。结构小调，不改写入目录。

5. **`writing-skills`**（`skills/writing-skills/SKILL.md`）— 明确只走 **procedural → skill 候选** 这一路；在"不适合场景"显式写明：事实性知识/决策/带根因的踩坑不提炼成 skill，应交 `remember` 落 `knowledge/memory/`。划清 skill 与知识的边界。

### baseline + 注册

6. **`rules/AGENTS.md`**（global-baseline 层）— 两处轻量编织，不新增重型门禁：
   - 任务起始 recall：在「核心门禁」或调度索引附近加一行——开始处理任务时若项目存在 `knowledge/memory/`，先经 `recall-memory` 读回相关记忆作为背景（轻索引，命中才深读，不为轻量动作加开销）。
   - 进化闭环：在「方法论层 vs 规格持久化层」后补一小节，说明 capture → 分流(skill 候选 / 记忆) → recall → reflect → 再沉淀 的闭环与各 skill 分工。
   - 严守层级：只改 `rules/AGENTS.md`，不碰 root `AGENTS.md`（repo-maintenance）。

7. **`constants/skills.ts`** — 在 `moluoxixi` vendor 的 `skills` 数组登记 `reflect`、`remember`、`recall-memory`（紧邻 `session-capture` / `writing-skills` 分组），使其随投影分发。

## 不做 / 边界

- 不改 `spec-init.mjs`：`knowledge/memory/` 按需创建，与 sessions/skills-candidates 一致，避免动既有测试。
- 不与 ADR-0001 的 `knowledge-source-registry` 冲突：那是"登记项目已有资料检索入口"（README/docs，他人/外部资料），本机制是"沉淀我们自己学到的事实/教训"，两者并存、目录不同。
- 不内置强制反思门禁：反思是按需 skill，不每次交付强跑（符合 baseline 门禁取舍原则）。
- 不改投影/安装核心代码（`scripts/lib/*`）：仅在 `constants/skills.ts` 配置层登记。

## 验证

- `npm run lint:check`、`npm run typecheck`、`npm test`（CI 同款三件套）必须实际运行并读输出。
- `constants/skills.ts` 改动后重点看 `scripts/lib/__test__/vendors.test.ts` 仍 PASS（它不锁定完整清单，预期不受影响，但必须实跑确认）。
- 新增 skill 的 frontmatter 合法性：对照现有 skill（`name` 必填；需自动触发的带 `description`）。
- 新增/重构内容遵循 CLAUDE.md「AI 规则与 Skill 内容规范」：写明触发条件、适用边界、不适合场景；示例/占位显式标注。

## 交付物清单

| 文件 | 动作 |
|---|---|
| `skills/reflect/SKILL.md` | 新增 |
| `skills/remember/SKILL.md` | 新增 |
| `skills/recall-memory/SKILL.md` | 新增 |
| `skills/session-capture/SKILL.md` | 重构（加分流标签） |
| `skills/writing-skills/SKILL.md` | 重构（划清 skill/知识边界） |
| `rules/AGENTS.md` | 编织 recall + 进化闭环小节 |
| `constants/skills.ts` | 登记 3 个新 skill 投影 |
