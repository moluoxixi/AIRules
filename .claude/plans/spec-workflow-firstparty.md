# 自建契约版 spec 工作流（替换官方 OpenSpec CLI）

## 背景与决策

OpenSpec 的 CLI 很薄——propose/apply 全靠 AI 读 prompt，唯一确定性逻辑是 archive 时的 delta 合并（纯文本解析+字符串手术，已调研清楚规则）。它有价值的是目录约定+delta 格式，可白嫖。

用户决策：
- **移除官方 OpenSpec CLI 接入**（不装外部依赖、不被 beta 版本漂移绑架）。
- **自建契约版放进 init-project**，落进纯 `.airules/changes/`（不带官方硬编码的 `openspec/` 那层）。
- 与我们 brainstorming/writing-plans/test-design 串联，不产生两套需求文档。

## 一、移除官方接入

- 删 `skills/init-project/scripts/init-openspec.mjs`。
- `constants/skills.ts`：删 `openspecSetup`（116-129 行）及 moluoxixi setup 里的 `...openspecSetup`（245 行恢复为 `setup: codegraphSetup`）。
- `skills/init-project/SKILL.md`：把"OpenSpec store / init-openspec.mjs / openspec init"相关行（8/22/35/44/56）改为自建版。

## 二、目录约定（落进 .airules/，无 openspec/ 层）

```
.airules/
├── specs/<capability>/spec.md          # 事实源（## Purpose + ## Requirements）
├── changes/
│   ├── <change-id>/
│   │   ├── proposal.md                  # ## Why + ## What Changes（必需）
│   │   ├── design.md                    # 技术方案（可选）
│   │   ├── tasks.md                     # ## N. 组 + - [ ] N.M 项
│   │   └── specs/<capability>/spec.md   # delta: ## ADDED/MODIFIED/REMOVED/RENAMED Requirements
│   └── archive/<YYYY-MM-DD>-<change-id>/
├── sessions/                            # 已有：session-capture 写
└── skills-candidates/                   # 已有：writing-skills 写
```

## 三、新建脚本（skills/init-project/scripts/，确定性逻辑用脚本，creative 用 skill）

复刻调研确认的规则（出处 OpenSpec src/core/specs-apply.ts + requirement-blocks.ts）：

1. **`spec-init.mjs <project>`**：建 `.airules/{specs,changes,changes/archive}` 骨架。幂等。替代 init-openspec。
2. **`spec-new-change.mjs <project> <change-id>`**：建 `changes/<change-id>/` + proposal.md/tasks.md 模板骨架。重复报错。
3. **`spec-archive.mjs <project> <change-id>`**：**核心确定性逻辑**——把 change/specs/ delta 合并进 .airules/specs/，再移动 change 到 archive/<date>-<id>/。日期用脚本自取系统日期 `new Date().toISOString().split('T')[0]`（这是分发给用户项目的运行时脚本，非本仓库 workflow 脚本，无 Date 限制）。实现：
   - delta 解析：split `##`，4 个 section 正则（ADDED/MODIFIED/REMOVED/RENAMED Requirements），`### Requirement:` / `#### Scenario:` 正则。
   - 主 spec：提取 `## Requirements` 段，按 trimmed name 建块索引。
   - 应用顺序 RENAMED→REMOVED→MODIFIED→ADDED，冲突硬失败（ADDED已存在/MODIFIED未找到/REMOVED未找到 throw）。
   - 两阶段：先全部在内存构建+校验，全过才写盘；最后移动目录。
   - 新 capability 无主 spec → 用 skeleton（## Purpose TBD + ## Requirements），仅 ADDED 允许。
4. **`spec-validate.mjs <project> [change-id]`**：校验 delta 格式（每 section 非空、ADDED/MODIFIED 有 SHALL/MUST + ≥1 Scenario、无重名、无跨段冲突）。

> 脚本无外部依赖，纯 node:fs。spec-archive 日期用 `new Date()` 自取（运行时脚本，非本仓库 workflow 脚本）。

## 四、新建 spec-workflow skill（方法论，省略 description，按名调用）

`skills/spec-workflow/SKILL.md`：
- 触发条件：用户要把一次变更正式立项/记录为可追溯 spec 契约时按名调用。
- 不适合场景：小改无需正式 spec（走 L0/L1 直接执行）；纯探索。
- 三态流程：
  - **propose**：用 brainstorming 想清需求 + writing-plans 拆任务后，把结论落成 proposal.md + specs/delta + tasks.md（`spec-new-change.mjs` 建骨架，AI 填内容）。
  - **apply**：按 tasks.md 逐条实现（coder/编码流水线），勾选 `- [x]`。
  - **archive**：实现完成后 `spec-archive.mjs` 合并 delta 进 .airules/specs/ 并归档。
- 与编排串联：spec-workflow 是"书面持久化层"，方法论仍用 brainstorming/writing-plans/test-design；不重复造需求分析。
- 写入边界：只写 .airules/specs 与 .airules/changes；delta 格式须合法（SHALL/MUST + Scenario）；archive 合并冲突硬失败不静默。

## 五、init-project 集成

- SKILL.md 流程图：codegraph init 后 → `spec-init.mjs` 建 `.airules/{specs,changes}` 骨架（替换 init-openspec 那环）。
- 交付检查表：`.airules/{specs,changes,changes/archive}` 已建。
- spec-init 无外部依赖，不会 MISSING（不像 openspec 命令可能缺失）。

## 六、rules 三层分工（顺带补，解决"rules 没提 spec 工作流"）

在 `rules/sources/00-overview.md` 或新分节简述：需求/计划的**方法论**用编排 skill（brainstorming/writing-plans/test-design）；需要**正式可追溯、可归档的书面契约**时用 spec-workflow 落进 `.airules/`；二者分工，不重复。

## 七、测试（就近 skills/init-project/__test__/）

- spec-archive 的 delta 合并是确定性逻辑，**必须测**：ADDED/MODIFIED/REMOVED/RENAMED 各路径、冲突硬失败、两阶段不部分写、新 capability skeleton、归档移动。
- spec-new-change/spec-init/spec-validate 测幂等、骨架、格式校验。
- 遵循"测分发/功能逻辑，不测 skill 内容文字"。

## 验证

- 临时项目跑全流程：spec-init → spec-new-change → 填 delta → spec-validate → spec-archive，确认 delta 正确合并进 .airules/specs/、change 归档。
- vitest 全量（含新 archive 合并测试）、typecheck、lint。
- grep 确认无残留 openspec CLI 引用（constants/SKILL/脚本）。

## 待确认 / 风险

- archive 合并是确定性字符串手术，正则须与调研给的完全一致，否则合并出错——测试覆盖各分支兜底。
- spec-archive 用 `new Date()` 自取系统日期；测试用临时目录+断言归档目录前缀格式（YYYY-MM-DD）而非固定值。
- capability/domain 命名约定：沿用 OpenSpec 的"一 capability 一目录一 spec.md"。
