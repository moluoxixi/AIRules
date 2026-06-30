# 项目架构概览

## 架构目标

AIRules（包名 `.moluoxixi`）是一个可组合的 AI 技能分发系统，目标是把分散的 AI 能力资产（规则基线、领域技能、知识源约定）统一治理，并一键投影到多个 AI 代理宿主（Claude、Codex、Cursor、Hermes、Trae、OpenCode、CC-Switch 等）。

核心能力：

- 克隆业界成熟 AI Skills（第三方 vendor，经 `constants/skills.ts` 声明）。
- 维护第一方领域专属 Skills（仓库内 `skills/`）。
- 把规则基线（`rules/AGENTS.md`）与技能投影到各宿主，遵循层级自愈同步。

设计取向：单一可分发包同时携带规则层、技能层、执行脚本层与交付契约文档；投影过程幂等、可重复执行、可自愈。

## 模块边界

| 模块 | 职责 | 上游 | 下游 | 所有者 |
|---|---|---|---|---|
| `scripts/cli.ts` | CLI 入口：解析 `sync` / `add` / `verify` 命令并分发 | 用户命令 | `scripts/lib/*` | 维护者 |
| `scripts/lib/install.ts` | 宿主投影核心：基线 symlink/append、skills 展平软链、自愈清理 | `constants/hosts.ts`、`scripts/lib/links.ts`、`skill-projection.ts`、`vendors.ts` | 宿主目录 | 维护者 |
| `scripts/lib/vendors.ts` | 解析 vendor 配置、构建链接计划、遍历 vendor 树 | `constants/skills.ts` | `install.ts`、`sync-vendors.ts` | 维护者 |
| `scripts/lib/vendor-sync.ts` | 单 vendor 仓库克隆/拉取/稀疏检出/重置 | `constants/skills.ts` | `host-setup.ts` | 维护者 |
| `scripts/sync-vendors.ts` | 全量 vendor 同步：按 `constants/` 指纹决定是否重克隆并复制到 `vendor/skills/` | `constants/skills.ts`、`skill-projection.ts` | `vendor/skills/` | 维护者 |
| `scripts/lib/skill-projection.ts` | 技能目录发现、名称展平、源收集 | 文件系统 | `install.ts`、`sync-vendors.ts` | 维护者 |
| `constants/hosts.ts` | 宿主配置表（home 路径、基线文件名、投影模式、skills 目录名、排除项） | 无 | `install.ts` | 维护者 |
| `constants/skills.ts` | vendor 与 skill 声明（repo、links、setup 命令） | 无 | `vendors.ts`、`sync-vendors.ts` | 维护者 |
| `scripts/check-rules-consistency.ts` | 编码编排资产自洽性校验：agent/skill/rules/docs 引用存在性与漂移检查 | 仓库内容 | CI / pre-push | 维护者 |
| `skills/` | 第一方领域 skills（init-project、brainstorming、writing-plans、test-design、spec-workflow 等） | — | vendor/skills 投影 | 维护者 |
| `rules/` | 规则基线（手工维护的 `AGENTS.md`） | — | 各宿主基线文件 | 维护者 |
| `.airules/knowledge/` | 可审计文档层（架构 / 接口协议 / 产品需求 / 测试 等） | 源料 | 人工/检索 | 维护者 |

## 分层与依赖规则

依赖方向严格单向，禁止反向依赖：

```
constants/  ← scripts/lib/  ← scripts/cli.ts、scripts/sync-vendors.ts
```

- `constants/` 为纯配置层，不依赖 `scripts/lib`。
- `scripts/lib/` 消费 `constants/`，封装投影、同步、校验逻辑，不直接解析 CLI 参数。
- `scripts/cli.ts`、`scripts/*.ts` 为编排层，只负责解析参数并调用 lib。
- `skills/`、`rules/`、`.airules/knowledge/` 为内容/产物层，不被代码层 import，仅作为投影/校验的数据输入。

## 数据流

技能投影链路（层级自愈，每层指向上一层）：

```
vendor Git 仓库
  → vendor/skills/                （sync-vendors.ts 克隆 + 复制；第一方 skills 软链覆盖层）
  → ~/.moluoxixi/skills/          （install.ts 展平软链）
  → ~/.agents/skills/             （行业标准共享层，展平软链）
  → <宿主>/skills（或 skills-cursor）（按 HostConfig 投影，支持 excludedSkills）
```

规则基线链路：

```
rules/AGENTS.md                   （手工维护的全局 baseline，提交入库）
  → ~/.moluoxixi/vendor/AGENTS.md （syncFirstPartyToHome 复制，作为所有宿主软链统一源）
  → <宿主>基线文件
       · symlink 模式：整份软链覆盖（CLAUDE.md / AGENTS.md）
       · append 模式：以 AIRULES:BASELINE 托管块幂等注入（Hermes SOUL.md，保留身份内容）
```

vendor 同步缓存：`sync-vendors.ts` 计算 `constants/` 目录 SHA-256 指纹，与 `vendor/.sync-fingerprint` 比对，未变化则跳过克隆；`--force` 忽略缓存。

## 权限与安全边界

- 纯本地 CLI 工具，无网络鉴权、无服务端、无远程写入。
- 投影依赖文件系统软链接权限：Windows 使用 `junction`（目录）与 `file`（文件）；非 Windows 使用 `dir`/`file`。
- Windows 上 `file` 软链接遇 `EPERM` 时降级为 `cpSync` 复制，保证无管理员权限也能投影。
- vendor 克隆为只读消费：第三方仓库内容复制进 `vendor/`（gitignored），不回写上游。
- `vendor/` 为只读沙箱，禁止直接修改（见 AGENTS.md vendor 红线）。

## 部署与运行时

- 运行时：Node 22+，通过 `tsx` 直接执行 TypeScript 脚本，无需预编译即可 `sync`。
- 工程基础设施：TypeScript 5.x + ESLint（@antfu）+ Vitest + Husky + Commitlint。
- 发布：`publish.yml` 由 `v*.*.*` git tag 触发，校验 tag 与 package.json 版本一致后 `npm publish --provenance`。
- 质量门禁：PR 阶段 `ci.yml` 跑 lint:check / typecheck / test / rules:check；本地 `pre-commit` 跑 lint-staged，`pre-push` 跑 typecheck + rules:check。
- 不涉及容器、服务器或云资源部署；产物为 npm 包 + 用户本地宿主目录投影。

## 待确认

- 无（本文档基于 `constants/hosts.ts`、`scripts/lib/install.ts`、`scripts/lib/vendor-sync.ts`、`scripts/sync-vendors.ts`、`package.json`、`.github/workflows/publish.yml` 的当前实现编写）。
