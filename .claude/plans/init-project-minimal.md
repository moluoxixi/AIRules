# 最小化 init-project — 设计方案

## 目标（用户确认）

新增最小化 init-project skill，**仅**做三件事：
1. 在目标项目根执行 `codegraph init -i` 初始化 CodeGraph。
2. 注入项目规则到目标项目根 `AGENTS.md`。
3. 建立 `CLAUDE.md → AGENTS.md` 软链接（Windows 无符号链接权限时回退硬链接）。

**不做**：detect-stack 按栈检测、docs 骨架、knowledge 源登记、多栈 reference（vue/nestjs/java 等）、文档路由。

校验脚本跟着最小化改（用户确认）。

## 复用 vs 丢弃（来自上一版 4107754）

复用（裁剪后）：
- `scripts/link-claude.mjs`：软链/硬链逻辑成熟，整段复用（含 git core.symlinks、Windows 回退、幂等判断）。
- `references/airules-base.md`：项目自定义规范占位 + AI 规则写作规范。
- `references/code-core.md`：语言无关代码核心纪律。

丢弃：detect-stack、scaffold-docs、verify-knowledge-sources、verify-stage-gate、多栈 reference、common/docs.md、frontend/* backend/* reference。

## 产物结构

```
skills/init-project/
  SKILL.md                       # 最小三步流程
  references/
    airules-base.md              # 项目规则骨架（注入用）
    code-core.md                 # 代码核心纪律（注入用）
  scripts/
    inject-rules.mjs             # 注入 references 到项目根 AGENTS.md（裁剪版，无 docs/knowledge 逻辑）
    link-claude.mjs              # CLAUDE.md → AGENTS.md 软链（整段复用）
```

## SKILL.md 流程

```
确认目标项目根 → inject-rules.mjs（注入 airules-base + code-core 到 AGENTS.md）
  → link-claude.mjs（建 CLAUDE.md 软链）→ codegraph init -i（项目根执行）→ 交付检查
```

- description：保留触发语义（创建/初始化项目、首次接入 AIRules、初始化 CodeGraph）。
- 四段式正文：触发条件、不适合场景、输出边界（只改 AGENTS.md/CLAUDE.md/CodeGraph 结果，不碰 vendor/宿主/未授权文件）、三步流程表（命令 + 关键输出 + 失败语义）。
- 引用脚本用 `<init-project-skill>/scripts/...` 占位，不依赖 AIRules 全局 scripts。

## inject-rules.mjs（裁剪版）

- 入参：`<project-root>`。
- 行为：把 `references/airules-base.md`（仅在 AGENTS.md 为空/新建时）+ `references/code-core.md` inline 注入项目根 `AGENTS.md`。
- 幂等：按 Markdown 标题去重，重复标题时停止并提示人工合并（保留旧版的重复标题保护）。
- 去掉：docs.md 注入、`旧 rules 路由` 路由、按 stack 选择 reference、`<AIRules>` 占位逻辑可保留兼容但第一方不用。

## 校验脚本最小化改动

### scripts/verify-delivery-control.mjs — checkProjectReference 重写
当前要求 docs.md（知识源+测试文档结构）、3 脚本（inject/verify-knowledge/verify-stage-gate）、inject 含 coreInlinePaths docs。
改为：init-project 存在时，仅要求
- `references/airules-base.md`、`references/code-core.md` 存在
- `scripts/inject-rules.mjs`、`scripts/link-claude.mjs` 存在
- `code-core.md` 含错误暴露契约（禁止错误绕行 + 失败）——把 rule layer 早先下沉的「错误暴露契约」锚点放这里更合适
- 不得残留旧 reference（control.md/subagent.md/common/docs.md 不再要求存在，但也不强制）

### scripts/verify-knowledge-sources.mjs（根 wrapper）
import 了不存在的 init-project 子脚本 → 删除该 wrapper，并从 `package.json` 的 `verify:knowledge-sources` 与 `verify:control:l2` 链、CI `ci.yml`、`verify-delivery-control` 的 execution layer 必需脚本清单中移除。knowledge 源功能不在最小化范围。

### scripts/verify-stage-gate.mjs（根 wrapper）
import 不存在的 init-project 子脚本 → 删除（无其它引用）。

### execution layer 必需脚本清单
从 `verify-delivery-control.mjs` 的 requiredFiles / package.json scripts 断言移除 `verify-knowledge-sources`。

## 测试处理

- `tests/init-project-scripts.test.ts`（962 行，测全功能脚本）→ 重写为最小化版：只测 inject-rules（注入 + 幂等 + 重复标题保护）与 link-claude（软链/硬链/幂等/冲突），删 detect-stack/scaffold-docs/knowledge/stage-gate 测试。
- `tests/knowledge-search-contract.test.ts`、`tests/knowledge-sources.test.ts` → 删除（功能已移除，knowledge-search skill 与 knowledge 源不在范围）。
- `tests/delivery-control.test.ts` → 补一个「携带最小 init-project 时 project reference present」用例 + 调整现有 n/a 用例。
- `tests/purity-check.test.ts` → 确认仍能用 `references/` 组装（airules-base + code-core 即可），按需微调。

## 不动清单

- 编码流水线编排（rules/sources、agents、skills 的 10 个 skill）——已交付，不动。
- 分发引擎 `scripts/lib/**`、`constants/**`、host 映射、CLI。
- `verify-skill-frontmatter.mjs`（init-project 是普通 skill，frontmatter 四段式即可通过）。

## 验证

- `node scripts/verify-skill-frontmatter.mjs --root skills/init-project`
- 手动跑 inject-rules + link-claude 对一个临时项目目录，验证 AGENTS.md 注入与 CLAUDE.md 软链（Windows 回退）。
- `delivery:verify`（project reference present 分支）、`rules:check`、`verify:skills`。
- 重写后的 init-project-scripts 测试 + delivery-control 测试 + 三个编排测试全绿。
- `verify:control:l2`（移除 knowledge 步后应全绿）。
- init-project 是 skill，发布前做 purity-check。

## 待确认 / 风险

- 注入内容默认 = airules-base + code-core 两份骨架，不按栈区分。若你希望注入时也带编码流水线编排的引用（指向全局 baseline），可加一行入口，但默认不重复 baseline 内容。
- 删除 knowledge wrapper 会改 `verify:control:l2` 链与 CI——属 repo-maintenance L2，纳入本次或上一个变更包。
