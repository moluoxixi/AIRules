# Moluoxixi AIRules

> 🧩 用"乐高积木"的方式，拼装你自己的 AI 编程最佳实践。

**[English](README.md)** | **中文**

## 这是什么？

AIRules 是一个**可组合的 AI 技能分发系统**。它的核心思想很简单：

- **克隆**业界成熟来源中的精选 AI Skills（来自 Anthropic、Google Gemini、OpenAI、PM Skills 等）
- **编写**你自己的领域专属 Skills
- **组合**这些小单元模块，形成你个人的开发生态最佳实践
- **一键分发**到你的 AI 代理（Claude、Cursor、Codex、Trae、Qoder、OpenCode 等）

## 核心理念

### 🏗️ 三层架构

```
┌─────────────────────────────────────────────┐
│  🔧 第一方 Skills（你自己写的）                │ ← 你的核心竞争力
│  init-project / handoff / memory / PM skills   │
├─────────────────────────────────────────────┤
│  📦 第三方 Skills（克隆成熟仓库）              │ ← 站在巨人肩膀上
│  gemini/review · anthropic/design ·          │
│  openai/playwright · pm-skills · ...         │
├─────────────────────────────────────────────┤
│  🚀 分发引擎（一键安装到支持的 AI 代理）       │ ← 自动化基础设施
│  Claude · Cursor · Codex · Trae · Qoder · ...│
└─────────────────────────────────────────────┘
```

### 📐 设计原则

| 原则 | 说明 |
|------|------|
| **小单元模块化** | 每个 skill 只做一件事，独立、可测试、可替换 |
| **组合 > 大而全** | 像 Unix 管道一样，通过组合小工具解决大问题 |
| **能力优先** | 默认接入流程、工具、设计和验证类 skills；代码规范由当前仓库动态生成 |
| **自愈式分发** | 一条命令同步到已配置 AI 代理，自动处理软链接、依赖、验证 |

## 你能得到什么？

- 🔥 **开箱即得** 精选流程、工具、设计和验证类 AI Skills
- 🧠 **CodeGraph、OpenSpec、BMAD 与 gstack 自动安装**：默认开发角色同步公司项目规格主线；Spec Kit bridge、ECC 与 Trellis 通过显式角色保留
- 🧱 **预留第一方扩展位**：保留顶层自定义 skills 投影入口，后续补充时无需调整整体分发模型
- 🌐 **多代理同步**：一次配置，Claude / Cursor / Codex / Hermes / Qoder / Trae / OpenCode / CC-Switch 与 `.agents` 共享层全部生效
- 🔄 **持续更新**：上游 skills 更新后，一条命令同步最新版本

## 安装

**作为 Node CLI 使用（本地开发 / npm link）：**

```bash
npm install -g pnpm
pnpm install
pnpm build
npm link
airules sync --host all
```

添加本地 skill 并同步到所有宿主：

```bash
airules add ./my-skill --host all
```

`add` 命令要求源目录包含 `SKILL.md`，并会复制到 `~/.moluoxixi/local/skills/<skill-name>`，再通过同一套 vendor/host 投影链路同步。

**macOS / Linux / Git Bash：**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm run sync
```

**Windows CMD：**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run sync
```

**Windows PowerShell：**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run sync
```

> [!TIP]
> **同步流程**：`npm run sync` 是默认 OpenSpec 开发角色同步。`npm run sync:development` 和 `npm run sync:openspec-development` 是同一角色的显式别名；只有明确要使用 ECC 角色时才运行 `npm run sync:ecc-development`；需要可选 Spec Kit + Superpowers bridge 角色时用 `npm run sync:speckit-development`；需要可选 Trellis 工作流 runtime 角色时用 `npm run sync:trellis-development`；需要产品角色时用 `npm run sync:product`。common skills 不再隐式叠加；角色通过各自 `constants/skills.ts` 里的 `extendsRoles = ['common']` 显式继承。每次同步都会重建 vendor skills、执行 setup 命令、清理死链接，并在 AIRules 投影后自动运行宿主验证。需要避免拉取第三方供应商或跳过 setup 时，可使用 `airules sync --skip-vendors`。

---

## 特定宿主安装

**macOS / Linux / Git Bash：**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm run rules:install -- --host claude
```

**Windows CMD：**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run rules:install -- --host claude
```

**Windows PowerShell：**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run rules:install -- --host claude
```

> [!TIP]
> 仓库内也可以继续使用 `npm run rules:install -- --host claude`，该脚本现在等价转发到 `airules sync`。

---

## 默认 OpenSpec 工作流

默认开发角色是 `openspec-development`。它以 OpenSpec 作为长期规格与变更生命周期事实源，Superpowers、BMAD、gstack 围绕这条主线承担实现纪律、产品拆解、review 与发布辅助。目标项目先用 OpenSpec `init-project` skill 初始化，再按风险选择工作流深度。

小变更用简单闭环：

```text
/opsx:explore "<问题或上下文>"
/opsx:propose "<功能或缺陷>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

较大或不明确的工作用严谨闭环：

```text
/opsx:new "<计划或能力>"
/opsx:continue <change-id>
```

需要完整 OpenSpec 包时用 `new`。中途暂停或需要接着推进时用 `continue`，然后按它输出的下一步继续，例如 `apply`、`verify` 或 `archive`。

OpenSpec 角色安装 OpenSpec（`@fission-ai/openspec`）与 CodeGraph，并通过 AIRules vendor sparse clone skill pipeline 投影精选 BMAD 与 gstack skills，同时提供会注册 `openspec/schemas/superpowers-bridge/` 的第一方 `init-project` skill。OpenSpec 保持原生 `openspec/` 根目录，AIRules 不把它包进 `.airules/`。

## ECC 工作流

ECC 是显式角色，不是默认角色。当你想让 ECC 上游 agents 与 core skills 成为主要编排界面，而不是走 OpenSpec 生命周期时，再启用它。

启用方式：

```bash
npm run sync:ecc-development
```

或：

```bash
airules sync --host all --role ecc-development
```

适合先用 ECC：

- 你希望 ECC agents 和 core skills 成为日常主界面。
- 你使用 Claude、Codex 或 OpenCode，并希望尽量走 ECC 官方全局 target。
- 你接受 AIRules 对 Qoder、Trae、Trae CN 的已审计 fallback 投影。

不适合先用 ECC：

- 你希望 OpenSpec 变更记录作为事实源。
- 你需要默认 AIRules 流程里的 CodeGraph、OpenSpec、BMAD 与 gstack。
- 你还没决定由谁负责规划；这种情况先用 OpenSpec，确定要换编排面时再切 ECC。

AIRules 同步 ECC 时，会优先使用 ECC 官方 installer 处理可用的原生全局 target，并对非原生宿主投影一组已审计 fallback 子集。ECC 显式继承 `common`，所以 handoff、记忆、反思和前端测试仍然可用，但 common 不再是全局默认层。

### 可选 Spec Kit 角色

只有项目明确选择 GitHub Spec Kit 而不是 OpenSpec 时，才使用 `speckit-development`。它安装 GitHub Spec Kit 官方 `specify` CLI，投影 `lihan3238/speckit-superpowers-bridge`，并保留官方 Superpowers skills namespace 供 bridge 执行阶段调用。每个目标项目用 Spec Kit 官方命令初始化，然后从 release ZIP 安装 bridge extension：

```bash
specify init . --integration codex
specify extension add speckit-superpowers-bridge --from https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip
```

其他宿主按官方 integration 选择，例如 `claude`、`copilot`、`gemini`。已有非空目录加 `--force`；需要跳过 agent 工具探测时加 `--ignore-agent-tools`。初始化后使用 Spec Kit 原生设计流：`/speckit.constitution`、`/speckit.specify`、`/speckit.clarify`、`/speckit.plan`、`/speckit.tasks`、`/speckit.analyze`。Spec Kit 项目实现阶段优先用 Codex 的 `$speckit-superpowers-bridge` 或 Claude Code 的 `/speckit-superpowers-bridge`，不要默认直接跑 `/speckit.implement`；bridge 让 Spec Kit 产物保持 canonical，再把实现纪律交给原生 Superpowers。

该角色也分发完整 `init-project` skill，方便 agent 在目标项目中一致地运行完整初始化链路。这个包装器会注入项目规则、建立 `CLAUDE.md` 链接、调用 Spec Kit 与 bridge extension 命令、把上游插件安装文案改写为 AIRules projected skills 文案、初始化 CodeGraph，且不复制 OpenSpec schema 或 AIRules OpenSpec 初始化资产。前端项目会额外安装项目内 `.specify/airules-schemas/frontend-superpowers-bridge/` schema 提示资产，而不是把前端规则注入 `AGENTS.md`。

### 可选 Trellis 角色

只有项目明确选择 Trellis 作为项目内 AI workflow runtime 时，才使用 `trellis-development`。它安装 `@mindfoldhq/trellis` CLI，并只投影 AIRules 第一方 `init-project` 包装器。目标项目随后运行 Trellis 自己的初始化，生成作为长期知识库的 `.trellis/spec/`、作为会话记忆的 `.trellis/workspace/`，以及作为任务事实源的 `.trellis/tasks/`。

```bash
npm run sync:trellis-development
```

该角色默认不继承 `common`。Trellis 自带 workflow、memory、hooks、agents 与多宿主适配，所以 AIRules 保持轻量接入：不把 Trellis AGPL 模板复制进 `roles/`，init skill 也只写目标项目内部。

### 产品规格用法

产品、规划或需求仓库跑完产品角色 `init-project` 后，使用产品 schema。

```text
/opsx:propose "<产品变更>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

中途暂停后，继续运行 `/opsx:apply <change-id>`。产品角色的 `init-project` 会把 `openspec/config.yaml` 设为 `schema: product-pm-bridge`，所以这套流程默认使用 `product-pm-bridge`。

产品变更默认用 pm-skills 产出轻量 solution brief、PRD、验收标准与边界用例。公司正式 PRD、长文档或高风险需求使用 BMAD：`bmad-shard-doc` 拆长文档，`bmad-prd` 创建/更新/校验 PRD，`bmad-create-epics-and-stories` 拆出开发可执行 epic/story，`bmad-generate-project-context` 生成下游上下文。长期上下文只在审核后提升到 `knowledge/index.md`，不能变成新的规则文件。

## 项目结构

```
~/.moluoxixi/
├── roles/
│   ├── common/
│   │   ├── constants/
│   │   │   └── skills.ts  # 显式公共 skill 清单
│   │   ├── hooks/
│   │   │   └── session-log.mjs
│   │   └── skills/        # 共享 handoff / 前端测试 / 记忆能力
│   ├── openspec-development/
│   │   ├── constants/
│   │   │   └── skills.ts # 显式 OpenSpec + BMAD + gstack 角色清单
│   │   ├── mcp/
│   │   │   └── mcp.json   # 按宿主格式投影的中性 MCP 源
│   │   ├── hooks/
│   │   └── skills/
│   ├── speckit-development/
│   │   ├── constants/
│   │   │   └── skills.ts # 可选 Spec Kit + Superpowers bridge 角色清单
│   │   ├── mcp/
│   │   └── rules/
│   ├── product/
│   │   ├── constants/
│   │   │   └── skills.ts  # 产品 / PM skill 清单
│   │   └── skills/         # 第一方产品 init-project skill
│   ├── trellis-development/
│   │   ├── constants/
│   │   │   └── skills.ts  # Trellis CLI setup + init-project 包装器清单
│   │   └── skills/
│   └── ecc-development/
│       └── constants/
│           └── skills.ts  # ECC 角色 skill 清单
├── local/
│   └── skills/              # `airules add` 复制进来的用户自定义 skills
├── vendor/
│   ├── repos/               # 克隆的第三方源仓库
│   └── skills/              # 展平后的提取 skills
└── scripts/                 # 安装/同步脚本（测试就近放在被测代码旁的 __test__/）
```

> 源 `skills/` 目录允许递归分组；安装后的 vendor 与宿主 skills 目录统一按叶子 skill 名称展平。
> 默认 `openspec-development` 不投影 always-on 全局规则基线；它安装 OpenSpec 与 CodeGraph，投影精选 BMAD/gstack skills，并包含第一方 OpenSpec schema 初始化链路。显式 `ecc-development` 在可用时使用 ECC 官方 installer，并对已审计的非原生宿主使用 AIRules fallback 投影。可选 `speckit-development` 不安装 OpenSpec schema；它安装 Spec Kit 官方 CLI，投影 Spec Kit + Superpowers bridge skill，把项目结构交给 `specify init` + `specify extension add` 原生生成，并且只在检测到前端项目时新增项目内前端 schema 提示资产。

## 为什么不是另一个 AI Rules 集合？

市面上已经有很多 AI rules 仓库。AIRules 不同的地方在于：

| 其他方案 | AIRules |
|---------|---------|
| 一个大的 rules 文件 | 模块化的小 skill 单元 |
| 手动复制粘贴 | 脚本驱动的自动分发 |
| 只支持一种代理 | 多宿主目标 + `.agents` 共享层 |
| 全部自己写 | 克隆成熟的 + 自己写独特的 |
| 一次性配置 | 持续同步 + 自愈修复 |

## 路线 / TODO

- [x] **Development runtime 回路 hook 已移除** — development 不再分发旧的 runtime 回路 hook / ledger 链路。宿主 hook 投影仅保留 common 的 `session-log.mjs` Stop hook；回路上限继续由 prose 与 workflow-contract 约束。

## 许可证

MIT
