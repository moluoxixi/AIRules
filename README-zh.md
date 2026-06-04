# Moluoxixi AIRules

> 🧩 用"乐高积木"的方式，拼装你自己的 AI 编程最佳实践。

**[English](README.md)** | **中文**

## 这是什么？

AIRules 是一个**可组合的 AI 技能分发系统**。它的核心思想很简单：

- **克隆**业界成熟的 AI Skills（来自 antfu、Anthropic、Google Gemini、Vercel 等）
- **编写**你自己的领域专属 Skills
- **组合**这些小单元模块，形成你个人的开发生态最佳实践
- **一键分发**到所有 AI 代理（Claude、Cursor、Codex、Gemini 等）

## 核心理念

### 🏗️ 三层架构

```
┌─────────────────────────────────────────────┐
│  🔧 第一方 Skills（你自己写的）                │ ← 你的核心竞争力
│  software-development-workflow / 标准集合      │
├─────────────────────────────────────────────┤
│  📦 第三方 Skills（克隆成熟仓库）              │ ← 站在巨人肩膀上
│  antfu/vue · anthropic/design · gemini/... │
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
| **第三方优先** | 能用成熟的就不自己写，自己只写真正有独特价值的部分 |
| **自愈式分发** | 一条命令同步到所有 AI 代理，自动处理软链接、依赖、验证 |

## 你能得到什么？

- 🔥 **开箱即得** 25+ 精选前端/后端/通用 AI Skills
- 🧱 **预留第一方扩展位**：保留顶层自定义 skills 投影入口，后续补充时无需调整整体分发模型
- 🌐 **多代理同步**：一次配置，Claude / Cursor / Codex / Qoder / Tare / OpenCode / CC-Switch 全部生效
- 🔄 **持续更新**：上游 skills 更新后，一条命令同步最新版本

## 安装

**作为 Node CLI 使用（本地开发 / npm link）：**

```bash
npm install
npm run build
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
> **同步流程**：该命令会重建 vendor skills、清理死链接，并在完成后自动运行宿主验证。需要避免拉取第三方供应商时，可使用 `airules sync --skip-vendors`。

---

## 发布

发布由 `.github/workflows/publish.yml` 负责。

1. 创建具备发布权限的 npm automation token，并保存为 GitHub Actions 仓库 secret：`NPM_TOKEN`。
2. 将 `package.json` 升到准备发布的版本，然后创建匹配的 Git tag，例如 `v0.1.0`。
3. 针对该 tag 发布 GitHub Release，或在 Actions 页面手动运行 `Publish package` workflow 并填写已有 tag。
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

| 代理 | `--host` 参数 | 宿主路径 | 投影方式 | 引导文件 |
|-------|---------------|----------|----------|----------|
| **Claude Code** | `claude` | `~/.claude/` | 软链接 | `CLAUDE.md` |
| **Codex** | `codex` | `~/.codex/` | 软链接 | `AGENTS.md` |
| **Cursor** | `cursor` | `~/.cursor/` | 软链接 | `AGENTS.md` |
| **Tare** | `tare` | `~/.tare/` | 软链接 | `AGENTS.md` |
| **OpenCode** | `opencode` | `~/.config/opencode/` | 软链接 | `AGENTS.md` |
| **CC-Switch** | `cc-switch` | `~/.cc-switch/` | 软链接 | `AGENTS.md` |

> [!NOTE]
> 所有技能在安装过程中都会自动投影到代理专属的 skills 目录中。

---

## Skills 全景图

### 第一方 Skills（自写）

| 名称 | 描述 |
|------|------|
| **software-development-workflow** | 通用软件开发标准流程：需求、拆分、设计、实现、验证、复核与交付报告 |
| **frontend-code-standard** | Vue 3 与 React TypeScript/JavaScript 前端编码标准：统一组件、模块、工具库和 UI 组件库规则，覆盖评审输出、边界、导出、import 路径、类型契约与交付检查 |
| **node-code-standard** | Node.js 后端实现标准：适用于 TypeScript/JavaScript 服务，覆盖显式契约、运行时校验、依赖注入、事务边界、持久化封装与交付检查 |
| **nestjs-code-standard** | NestJS 后端实现与评审标准：面向新写、重构和代码评审，覆盖 DTO 契约、ValidationPipe、构造函数注入、事务边界、持久化封装和基于证据的评审输出 |
| **java-code-standard** | Java 与 Spring Boot 后端编码标准：适用于 Java 17+ 基线、Java 21/25 LTS、Maven 和 Gradle，覆盖领域包、构造函数注入、Bean Validation、事务边界、迁移与错误映射 |
| **skill-validation-standard** | 最小 Skill 产物校验标准：校验生成或修改后的 Claude/Codex skill 的 SKILL.md YAML frontmatter、文件夹命名一致性和行数限制 |

> workflow 标准可以继续放在 `skills/workflow` 等嵌套源目录下，但安装时会展平为 `vendor/skills/<skill-name>`；仓库级规则位于 `rules/AGENTS.md`。

### 第三方 Skills（精选）

| 来源 | Skills | 说明 |
|------|--------|------|
| **antfu** | vue, nuxt, pinia, vite, vitest, unocss, pnpm, vitepress, slidev, tsdown, turborepo 等 15 个 | Vue 全家桶 + 前端工具链最佳实践 |
| **Google Gemini** | code-reviewer, pr-creator | 代码审查与 PR 自动创建 |
| **Vercel Labs** | find-skills | 开源生态 Skill 发现与安装 |
| **Vercel Agent Skills** | react-best-practices, react-native-skills, web-design-guidelines | React/React Native 实现指导与 Web UI 审查 |
| **Anthropic** | frontend-design | 生产级前端视觉设计指导 |
| **OpenAI** | playwright | 浏览器自动化与 UI 流程调试 |
| **Superpowers** | systematic-debugging, verification-before-completion, receiving-code-review, writing-skills, using-git-worktrees, writing-plans | 精选代码库工作流技能，不默认启用 TDD 或子代理执行重流程 |

## 项目结构

```
~/.moluoxixi/
├── rules/
│   └── AGENTS.md          # 仓库级运行规则
├── skills/                  # 第一方 skills（你的核心资产）
│   ├── skill-validation-standard/
│   └── workflow/
│       ├── software-development-workflow/
│       ├── frontend-code-standard/
│       ├── node-code-standard/
│       ├── nestjs-code-standard/
│       └── java-code-standard/
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
