# Skill 纯净校验流程

> 纯净校验验证 first-party skill 是否「自足可控」：在不带本项目 `AGENTS.md`、不注入 baseline
> 规则、不带历史记忆的干净隔离环境里，仅凭 `init-project/references/` 规则 + 被测 skill 自身，
> 能否产出符合 skill 声明的产物。它把 `AGENTS.md` 中「纯净测试要求」的文字约定落成可执行流程。

## 方法论：把 TDD 套在 skill 上（RED-GREEN-REFACTOR）

纯净校验本质是「对流程文档做 TDD」，吸收自成熟的 skill 创作方法论（参考 `superpowers:writing-skills` 的 RED-GREEN-REFACTOR）。三步流程与 TDD 一一对应：

- **RED（看它失败）**：写 skill 前（或重大修改前），先在干净隔离环境里跑最小任务，观察 agent 仅凭通用规则会怎么做、漏掉什么、用什么借口绕开约束。没看过裸跑失败，就不知道 skill 该堵哪个洞。
- **GREEN（写到通过）**：针对裸跑暴露的具体缺口写/改 skill——补触发条件、输出边界、产物结构、失败处理，让干净 agent 现在能产出合规产物。只补堵到的洞，不为臆想场景堆内容。
- **REFACTOR（堵剩余漏洞）**：纯净 run 又发现新的规避或缺口，就把对应反例和约束显式写进 skill，再重跑复测，直到产物稳定合规。

对应到本流程：`assemble` 出纯净包 → 干净 agent 跑（RED/复测）→ `--check` 核对断言（GREEN 判定）→ 缺口回填 skill 再跑（REFACTOR）。核心纪律与 TDD 同：**缺口先回填 skill，绝不用额外提示词在测试里补救掩盖**。

## 何时必须跑

- 新增 first-party skill 后、发布前。
- 对既有 skill 做重大修改（触发条件、输出边界、产物结构、步骤）后。
- 仅补字段说明/示例/变更记录的 L0 改动不强制。

## 工具职责（执行器无关）

`scripts/purity/purity-check.mjs` **不调用任何 LLM**，只做两件确定性的事：

1. `assemble`：组装纯净上下文包到 `.purity-runs/<skill>/`（`context.md` + `rubric.md`）。
2. `--check`：拿纯净 run 的产物，对 `scripts/purity/rubric.json` 声明的断言做核对。

**用什么 agent 执行纯净 run 由用户环境决定**——脚本不假设 `claude` / `codex` / `opencode` / `delegate_task`
任意一种存在，保证换环境可用。

## 三步流程

### 1. 组装纯净包

```bash
node scripts/purity/purity-check.mjs <skill>
# 或 npm run purity:assemble -- <skill>
```

产出 `.purity-runs/<skill>/context.md`（纯净上下文）和 `rubric.md`（核对清单）。该目录已被 gitignore。

### 2. 在干净 agent 里执行（执行器自选，脚本不强制）

三种方式任选其一，取决于你的环境：

- **无 runner**：把 `context.md` 喂给环境里任意干净 agent（新会话、不带项目规则），产物存为 `out.md`。
- **命令行 runner**：`cat .purity-runs/<skill>/context.md | <你的 CLI> > out.md`，其中 `<你的 CLI>`
  是你环境里实际可用的命令（例如某个 agent CLI 的非交互模式）。
- **由调用方代理执行**：主代理用其子代理能力跑 `context.md`，回填产物。

关键约束：执行环境必须干净——不带本项目 `AGENTS.md`、不注入 baseline、不带历史记忆、不追加
任何引导性提示词。否则测的就不是 skill 自身的可控性。

无法保证上述干净执行环境时，结果必须标记为 `NOT RUN` 或 `MISSING clean executor`；不得继续执行
`--check` 后把非干净 run 声明为 `PASS`。

### 3. 核对产物

```bash
node scripts/purity/purity-check.mjs <skill> --check <产物文件>
# 或 npm run purity:check -- <skill> --check <产物文件>
```

输出每条断言的 `PASS` / `MISSING`，以及标 `manual` 的人工复核项。有缺口时退出码非零。

## 缺口处理（闭环）

- 自动断言 `MISSING` 或人工复核发现问题 → 缺口必须先**回填到 skill 本身**（补约定、明确触发条件、
  补产物结构），再重跑流程复测。
- **不得**用额外提示词在测试中「补救」掩盖 skill 缺陷——那只会让发布后的真实环境继续踩坑。

## 为 新 skill 增加断言

编辑 `scripts/purity/rubric.json`，在 `skills.<name>` 下声明：

- `minimalTask`：喂给纯净 agent 的最小任务指令（不含引导性提示）。
- `assertions[]`：产物必须满足的断言。每条支持：
  - `anyOf`：产物须包含其中至少一个字符串。
  - `regex`：产物须匹配该正则。
  - `manual: true`：负向/语义断言，脚本不自动判定，输出 `MANUAL` 提示人工复核。

## 为什么不进 CI

纯净 run 必然调用 LLM：要花钱、输出非确定性。进 CI 会让流水线又慢又 flaky。因此纯净校验是
**手动触发的发布前门禁**，而 `scripts/purity/` 的组装器/核对器本身是确定性的，可随时跑。
