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
- 🧠 **CodeGraph、OpenSpec 与 BMAD 自动安装**：开发 / 产品角色同步时执行对应 setup 命令
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
> **同步流程**：`npm run sync` 是默认开发角色同步（`roles/common` + `roles/development`）。需要显式开发角色时用 `npm run sync:development`；需要产品角色时用 `npm run sync:product`（`roles/common` + `roles/product`）；需要 ECC 角色时用 `npm run sync:ecc-development`（`roles/common` + `roles/ecc-development`）。每次同步都会重建 vendor skills、执行 setup 命令、清理死链接，并在 AIRules 投影后自动运行宿主验证。默认开发 setup 会全局安装并初始化 CodeGraph，安装 OpenSpec（`@fission-ai/openspec`），并安装 BMAD（`bmad-method`）；产品同步会安装 OpenSpec 与 BMAD。ECC 同步对 Codex、Claude、Cursor、OpenCode 等 ECC 原生宿主调用官方命令 `npx -y --package ecc-universal ecc install --profile <profile> --target <target>`；Qoder 等 ECC 尚未原生支持的宿主保留 AIRules fallback 投影。ECC OpenSpec 工作见上游 [`affaan-m/ECC#2283`](https://github.com/affaan-m/ECC/issues/2283) 与 [`affaan-m/ECC#2318`](https://github.com/affaan-m/ECC/pull/2318)；截至 2026-07-06，PR 仍 open 且未合并，因此本角色不把 OpenSpec ecosystem 当作稳定默认依赖。需要避免拉取第三方供应商、跳过 setup 或跳过 ECC 官方 installer 时，可使用 `airules sync --skip-vendors`。

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

## `init-project` 之后如何使用 OpenSpec

`init-project` 只做初始化：根据项目根下已有的宿主目录安装 OpenSpec 入口（`.claude`、`.codex`、`.cursor`、`.qoder`、`.trae`、`.opencode`），如果这些目录都不存在则默认安装 `.qoder` 入口；同时为检测到的 BMAD tool ID 安装 BMAD BMM runtime（`claude-code`、`codex`、`cursor`、`qoder`、`trae`、`opencode`，默认 `qoder`）。最后把项目级 schema 安装到 `openspec/schemas/<schema-name>/`，写入 `openspec/config.yaml` 作为项目默认 schema，并创建 `knowledge/index.md`。初始化后，使用 OpenSpec `/opsx` 工作流。

### 开发规格用法

代码仓库跑完开发角色 `init-project` 后，使用开发 schema。

```text
/opsx:propose "<功能或缺陷>"
/opsx:apply <change-id>
/opsx:archive <change-id>
```

中途暂停后，继续运行 `/opsx:apply <change-id>`。开发角色的 `init-project` 会把 `openspec/config.yaml` 设为 `schema: superpowers-bridge`，所以这套流程默认使用 `superpowers-bridge`。

开发变更先产出 `intake.md`。如果用户提供了 PRD、产品包、story、验收标准、截图或 API 说明，开发角色必须先校验这些文档是否可开发。长文档用 `bmad-shard-doc`；PRD 校验用 `bmad-prd`；缺少开发可执行 story 时用 `bmad-create-epics-and-stories`；需要下游上下文时用 `bmad-generate-project-context`。缺少 API 字段、路由事实、权限或状态契约时标 `MISSING blocked`，不进入编码。

前端 UI 变更必须在 `plan.md` 中填写 `Frontend Planning Notes` 和 `Frontend Test Matrix`。用 `frontend-testing` 选择项目已有的单测/组件测试/E2E/浏览器检查。`gstack-qa-only` 可作为报告型浏览器 QA 证据；`gstack-qa` 只在用户明确要求“测试并修复”时使用。

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
│   │   ├── hooks/
│   │   │   └── session-log.mjs
│   │   └── skills/        # 共享会话沉淀 / 提炼 / 记忆 / 反思能力
│   ├── development/
│   │   ├── constants/
│   │   │   └── skills.ts # 开发角色 skill 清单
│   │   ├── mcp/
│   │   │   └── mcp.json   # 按宿主格式投影的中性 MCP 源
│   │   ├── hooks/
│   │   └── skills/
│   ├── product/
│   │   ├── constants/
│   │   │   └── skills.ts  # 产品 / PM skill 清单
│   │   └── skills/         # 第一方产品 init-project skill
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
> development 不再投影 always-on 全局规则基线；setup 会安装 OpenSpec（`@fission-ai/openspec`）与 BMAD（`bmad-method`），`init-project` 改为写项目本地 `AGENTS.md`、运行 OpenSpec 项目初始化、安装 BMAD BMM runtime、注册项目级 `openspec/schemas/superpowers-bridge/`，并创建 `knowledge/`。OpenSpec 自己维护 change/archive 等目录结构。

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
