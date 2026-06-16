# Moluoxixi AIRules

> 🧩 用"乐高积木"的方式，拼装你自己的 AI 编程最佳实践。

**[English](README.md)** | **中文**

## 这是什么？

AIRules 是一个**可组合的 AI 技能分发系统**。它的核心思想很简单：

- **克隆**业界成熟的 AI Skills（来自 Anthropic、Google Gemini、OpenAI、Superpowers 等）
- **编写**你自己的领域专属 Skills
- **组合**这些小单元模块，形成你个人的开发生态最佳实践
- **一键分发**到所有 AI 代理（Claude、Cursor、Codex、Gemini 等）

## 核心理念

### 🏗️ 三层架构

```
┌─────────────────────────────────────────────┐
│  🔧 第一方 Skills（你自己写的）                │ ← 你的核心竞争力
│  init-project / knowledge-search / docs        │
├─────────────────────────────────────────────┤
│  📦 第三方 Skills（克隆成熟仓库）              │ ← 站在巨人肩膀上
│  superpowers · anthropic/design · openai/... │
├─────────────────────────────────────────────┤
│  🚀 分发引擎（一键安装到所有 AI 代理）         │ ← 自动化基础设施
│  Claude · Cursor · Codex · Gemini · ...     │
└─────────────────────────────────────────────┘
```

### 📐 设计原则

| 原则 | 说明 |
|------|------|
| **小单元模块化** | 每个 skill 只做一件事，独立、可测试、可替换 |
| **组合 > 大而全** | 像 Unix 管道一样，通过组合小工具解决大问题 |
| **能力优先** | 默认接入流程、工具、设计和验证类 skills；代码规范由当前仓库动态生成 |
| **自愈式分发** | 一条命令同步到所有 AI 代理，自动处理软链接、依赖、验证 |

## 你能得到什么？

- 🔥 **开箱即得** 精选流程、工具、设计和验证类 AI Skills
- 🧠 **CodeGraph 自动安装**：默认同步时执行 `npm install --global @colbymchenry/codegraph`，随后执行 `codegraph install`
- 🧱 **预留第一方扩展位**：保留顶层自定义 skills 投影入口，后续补充时无需调整整体分发模型
- 🌐 **多代理同步**：一次配置，Claude / Cursor / Codex / Hermes / Qoder / Trae / OpenCode / CC-Switch 全部生效
- 🔄 **持续更新**：上游 skills 更新后，一条命令同步最新版本
- ✅ **交付控制门禁**：通过 `docs/delivery/control-contract.md` 和 `npm run delivery:verify` 检查 rules、skills、执行脚本是否形成闭环

## 安装

**作为 Node CLI 使用（本地开发 / npm link）：**

```bash
npm install -g pnpm
pnpm build
npm link
airules sync --host all
```

添加本地 skill 并同步到所有宿主：

```bash
airules add ./my-skill --host all
```

`add` 命令要求源目录包含 `SKILL.md`，并会复制到 `~/.moluoxixi/skills/<skill-name>`，再通过同一套 vendor/host 投影链路同步。

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
> **同步流程**：该命令会重建 vendor skills、执行 setup 命令、清理死链接，并在完成后自动运行宿主验证。默认 setup 会全局安装并初始化 CodeGraph；需要避免拉取第三方供应商和跳过 setup 时，可使用 `airules sync --skip-vendors`。

---

## 发布

发布由 `.github/workflows/publish.yml` 负责。

1. 创建具备发布权限的 npm automation token，并保存为 GitHub Actions 仓库 secret：`NPM_TOKEN`。
2. 将 `package.json` 升到准备发布的版本，然后推送匹配的 Git tag，例如 `v0.1.0`。
3. 推送 tag 会自动发布；也可以在 Actions 页面手动运行 `Publish package` workflow 并填写已有 tag。
4. workflow 会安装依赖、校验 tag 与 `package.json` 版本一致、执行 lint/typecheck/tests，然后通过 `npm publish --provenance --access public` 发布到 npm。

当前 workflow 使用 `npm install`，因为本仓库有意不跟踪 lockfile。

---

## 特定宿主安装

**macOS / Linux / Git Bash：**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm run rules:install -- --host 宿主名（例如 claude）
```

**Windows CMD：**

```cmd
git clone https://github.com/moluoxixi/AIRules.git "%USERPROFILE%\.moluoxixi"
cd "%USERPROFILE%\.moluoxixi"
npm run rules:install -- --host 宿主名（例如 claude）
```

**Windows PowerShell：**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm run rules:install -- --host 宿主名（例如 claude）
```

> [!TIP]
> 仓库内也可以继续使用 `npm run rules:install -- --host claude`，该脚本现在等价转发到 `airules sync`。

---

## CLI 命令

| 命令 | 作用 |
|------|------|
| `airules sync --host all` | 同步内置、用户自定义和第三方 skills 到所有已存在宿主 |
| `airules add ./my-skill --host all` | 添加本地 skill，并同步到所有宿主 |
| `airules add ./my-skill --name review-plus --overwrite` | 指定安装名并覆盖已有用户 skill |
| `airules verify --host codex` | 校验指定宿主的 skills 链接完整性 |
| `npm run delivery:verify` | 校验 AIRules 交付包是否同时具备规则层、技能层、执行层和交付契约 |

常用选项：

| 选项 | 说明 |
|------|------|
| `--home <dir>` | 指定 AIRules 安装目录，默认 `~/.moluoxixi` |
| `--user-home <dir>` | 指定宿主配置所在的用户目录，默认当前系统用户目录 |
| `--host <name\|all>` | 指定宿主，默认 `all` |
| `--skip-vendors` | `sync` 时不刷新第三方 vendor 仓库 |
| `--skip-sync` | `add` 后只写入用户 skill，不立即同步宿主 |
| `--no-verify` | 跳过宿主验证 |

---

### 宿主支持矩阵

Moluoxixi AIRules 通过自动化投影，支持不断增长的 AI 代理生态系统：

| 代理 | `--host` 参数 | 宿主路径 | 投影方式 | 规则基线 |
|-------|---------------|----------|----------|----------|
| **Claude Code** | `claude` | `~/.claude/` | 软链接 | `CLAUDE.md` |
| **Codex** | `codex` | `~/.codex/` | 软链接 | `AGENTS.md` |
| **Hermes** | `hermes` | `~/AppData/Local/hermes/` | 软链接 + 基线托管块 | 追加注入 `SOUL.md` |
| **Cursor** | `cursor` | `~/.cursor/` | 软链接 | `AGENTS.md` |
| **Trae** | `trae` | `~/.trae/` | 软链接 | `AGENTS.md` |
| **OpenCode** | `opencode` | `~/.config/opencode/` | 软链接 | `AGENTS.md` |
| **CC-Switch** | `cc-switch` | `~/.cc-switch/` | 软链接 | `AGENTS.md` |

> [!NOTE]
> 第一方与精选第三方 skills 在安装过程中都会自动投影到代理专属的 skills 目录中。Hermes `SOUL.md` 是身份/人格文件，AIRules 不整份覆盖它，而是用 `<!-- AIRULES:BASELINE:START/END -->` 托管块把规则基线幂等追加进去：每次 `sync` 先删旧块再写最新块，保证只保留一份且不破坏原有身份内容。AIRules 不再默认分发过去借鉴 Hermes 的学习/策展 skills；学习候选保留为内部文档约定，而不是安装到代理里的 skill。

---

## Skills 全景图

### 第一方 Skills（自写）

| 名称 | 描述 |
|------|------|
| **init-project** | 新项目初始化技能：分析项目背景，向根 `AGENTS.md` 注入规则，创建 `CLAUDE.md` 软链接，并执行 `codegraph init -i` |
| **architecture-docs** | 生成或更新 `docs/architecture/` 下的架构文档、模块边界和 ADR，并维护文档导航 |
| **prd-docs** | 生成或更新 `docs/prds/` 下的业务需求文档，并维护文档导航 |
| **api-docs** | 生成或更新 `docs/api/` 下的接口与联调契约文档，并维护文档导航 |
| **components-docs** | 生成或更新 `docs/components/` 下的前端组件文档，并维护文档导航 |
| **test-docs** | 生成或更新 `docs/test/` 下的测试设计与验证文档，并维护文档导航 |
| **retrospective-correction** | 处理实现偏差：小偏差直接修复并说明，重大偏差先确认修正计划再归因 |
| **handoff** | 会话需中断或换 agent 接手时，把进展压缩成交接文档（写入临时目录、引用既有产物、脱敏），供新 agent 直接接力 |
| **architecture-deepening** | 改进架构、找重构机会、消除浅模块时，基于「深模块」视角产出深化候选清单与跨缝测试策略 |

> 第一方 skills 可以继续放在嵌套源目录下，安装时会展平为 `vendor/skills/<skill-name>`；仓库级规则位于 `rules/AGENTS.md`，CodeGraph 安装命令位于 `constants/skills.ts` 的 vendor setup。

### 第三方 Skills（精选）

| 来源 | Skills | 说明 |
|------|--------|------|
| **Google Gemini** | code-reviewer-gemini, pr-creator-gemini | 代码审查与 PR 自动创建 |
| **Vercel Labs** | find-skills-vercel | 开源生态 Skill 发现与安装 |
| **Anthropic** | frontend-design-anthropic | 生产级前端视觉设计指导 |
| **OpenAI** | playwright-openai | 浏览器自动化与 UI 流程调试 |
| **Superpowers** | `skills/` 下全部上游 skills | 全量安装 Superpowers 命名空间，并展平到 `vendor/skills/<skill-name>` |

> 精选第三方 skills 使用来源后缀作为安装名，避免与 Superpowers、用户本地 skills 或其它供应商的同名裸目录冲突。

## 项目结构

```
~/.moluoxixi/
├── rules/
│   └── AGENTS.md          # 仓库级运行规则
├── skills/                  # 第一方 skills（你的核心资产）
│   ├── init-project/
│   │   ├── references/
│   │   └── scripts/
│   ├── architecture-docs/
│   ├── api-docs/
│   ├── components-docs/
│   ├── prd-docs/
│   ├── retrospective-correction/
│   └── test-docs/
├── vendor/
│   ├── repos/               # 克隆的第三方源仓库
│   └── skills/              # 展平后的提取 skills
├── constants/skills.ts      # 唯一的第三方技能配置清单
├── scripts/                 # 安装/同步/校验脚本
└── tests/                   # 自动化验证测试
```

> 源 `skills/` 目录允许递归分组；安装后的 vendor 与宿主 skills 目录统一按叶子 skill 名称展平。

## 为什么不是另一个 AI Rules 集合？

市面上已经有很多 AI rules 仓库。AIRules 不同的地方在于：

| 其他方案 | AIRules |
|---------|---------|
| 一个大的 rules 文件 | 模块化的小 skill 单元 |
| 手动复制粘贴 | 脚本驱动的自动分发 |
| 只支持一种代理 | 同时支持 7 种 AI 代理 |
| 全部自己写 | 克隆成熟的 + 自己写独特的 |
| 一次性配置 | 持续同步 + 自愈修复 |

## 许可证

MIT
