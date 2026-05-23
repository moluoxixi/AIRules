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
│  antfu/vue · anthropic/testing · gemini/... │
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
> **全自动流程**：该命令会自动拉取最新代码、安装依赖、清理死链接，并在完成后**自动运行全量验证报告**。如果需要卸载，只需在命令后添加 `--mode uninstall`。

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
> **全自动流程**：该命令会自动拉取最新代码、安装依赖、清理死链接，并在完成后**自动运行全量验证报告**。如果需要卸载，只需在命令后添加 `--mode uninstall`。

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
| **skill-validation-standard** | 最小 Skill 产物校验标准：校验生成或修改后的 Claude/Codex skill 的 SKILL.md YAML frontmatter 正确性和 Markdown 正文结构 |

> workflow 标准以命名空间整体投影；仓库级规则位于 `rules/AGENTS.md`。

### 第三方 Skills（精选）

| 来源 | Skills | 说明 |
|------|--------|------|
| **antfu** | vue, nuxt, pinia, vite, vitest, unocss, pnpm, vitepress, slidev, tsdown, turborepo 等 17 个 | Vue 全家桶 + 前端工具链最佳实践 |
| **Google Gemini** | code-reviewer, pr-creator | 代码审查与 PR 自动创建 |
| **Vercel Labs** | find-skills | 开源生态 Skill 发现与安装 |
| **OpenAI** | playwright | 浏览器自动化与 UI 流程调试 |
| **Superpowers** | 完整技能集 | 基础工程技能（TDD、子代理驱动等） |

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
│   └── skills/              # 提取出的第三方 skills
├── constants/skills.ts      # 唯一的第三方技能配置清单
├── scripts/                 # 安装/同步/校验脚本
└── tests/                   # 自动化验证测试
```

> 顶层第一方 skills 通过精确列表投影，workflow 标准继续归入 `workflow/` 命名空间。

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
