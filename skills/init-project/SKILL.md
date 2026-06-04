---
name: init-project
description: 用于创建新项目、初始化项目、为已有项目首次接入 AIRules、生成项目根 AGENTS.md/CLAUDE.md 或初始化 CodeGraph 时触发。
---

# Init Project

## 分析项目背景

开始初始化前，先读取目标项目根目录与用户目标，形成最小项目背景：

- 项目类型：前端应用、Node.js 服务、NestJS 服务、Java/Spring Boot 服务或混合仓库。
- 证据入口：`package.json`、`pom.xml`、`build.gradle`、`vite.config.*`、`nest-cli.json`、`src/`、`apps/`、`packages/`、测试配置和 README。
- 写入边界：只修改目标项目根目录的 `AGENTS.md` 和 `CLAUDE.md`；不得改动依赖目录、构建产物、vendor 或用户未授权文件。
- 缺失事实：无法判断技术栈时，只注入通用 AIRules 基线；不要猜测语言规则。

## 根据项目背景注入规则

执行脚本时始终先自动注入 `references/airules-base.md`，再按背景选择语言规则文件，并注入目标项目根目录 `AGENTS.md`：

| 项目背景 | 追加注入 references |
|---|---|
| 前端、Vue、React、Vite、组件或页面项目 | `frontend-code-standard.md` |
| Node.js/TypeScript 后端，且不是 NestJS | `node-code-standard.md` |
| NestJS 项目 | `nestjs-code-standard.md` |
| Java 或 Spring Boot 项目 | `java-code-standard.md` |

执行内容注入脚本：

```bash
node <init-project-skill>/scripts/inject-rules.mjs <your-project> <init-project-skill>/references/<rule>.md [...]
```

无法判断技术栈时不传额外语言规则，脚本只注入 `airules-base.md`。脚本会在 `AGENTS.md` 中维护一个受控规则块；重复执行会替换旧块，不追加重复内容。

然后基于项目根目录 `AGENTS.md` 创建 `CLAUDE.md` 软链接：

```bash
node <init-project-skill>/scripts/link-claude.mjs <your-project>
```

若 `CLAUDE.md` 已存在且不是指向 `AGENTS.md` 的软链接，必须停止并让用户决定，不得覆盖用户文件。

## 初始化 CodeGraph

在目标项目根目录执行：

```bash
cd your-project
codegraph init -i
```

若 `codegraph` 命令不存在，报告 `MISSING`，提示先运行 AIRules 默认安装流程；不得伪造成已初始化。

## 交付检查

- `AGENTS.md` 已包含本次项目背景对应的 AIRules 规则块。
- `CLAUDE.md` 是指向 `AGENTS.md` 的软链接。
- `codegraph init -i` 已执行并按真实结果报告 `PASS`、`FAIL`、`MISSING` 或 `NOT RUN`。
