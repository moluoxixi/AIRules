# 项目架构概览

## 架构目标

AIRules 是用于构建、维护和投影 AI Prompt 工程资产的元项目。项目通过 rules、skills、初始化脚本、vendor 投影和知识源注册表，为不同 AI 宿主提供可验证、可审计、可同步的工作流规则。

## 模块边界

| 模块 | 职责 | 上游 | 下游 | 所有者 |
|---|---|---|---|---|
| Rules Baseline | 维护宿主共享的 `AGENTS.md` 基线规则。 | `rules/AGENTS.md` | `vendor/AGENTS.md`、宿主 baseline 文件 | project-maintainer |
| Skills Catalog | 维护第一方和 curated 第三方 skills 的投影清单。 | `constants/skills.ts`、`skills/**` | `vendor/skills/**`、宿主 skills 目录 | project-maintainer |
| Init Project | 检测项目栈、注入规则、创建 docs 输出骨架、生成 `airules.knowledge.json`。 | 目标项目、`skills/init-project/**` | 目标项目 `AGENTS.md`、`CLAUDE.md`、`docs/**`、`airules.knowledge.json` | project-maintainer |
| Knowledge Source Registry | 登记可检索项目知识源，约束 include/exclude、owner 和 trust。 | `airules.knowledge.json` | `knowledge-search`、docs skills、证据报告 | project-maintainer |
| Knowledge Search | 通过登记文件系统来源或临时本地来源查找证据，并输出 `PASS`、`MISSING evidence`、`MISSING conflict`、`FAIL` 或 `NOT RUN`。 | `airules.knowledge.json`、filesystem sources | 用户回答、docs skills、证据报告 | project-maintainer |
| Docs Skills | 在用户明确要求时生成或更新标准文档输出。 | 登记知识源、源码、测试、用户确认 | `docs/architecture`、`docs/api`、`docs/prds`、`docs/test`、`docs/components`、`docs/out-*` | project-maintainer |

## 分层与依赖规则

- 宿主投影层只能读取 `vendor/` 和 `~/.agents` 链路结果，不得直接修改第三方 vendor 源。
- 初始化层可以创建 `airules.knowledge.json` 和标准 docs 输出骨架，但不得覆盖已有注册表或用户已有标准文档。
- 检索层先校验 `airules.knowledge.json`，再查询登记源；未登记来源不得作为项目事实入口。
- 文档输出层只能在明确触发的 docs skill 中写入正式文档；未安装或未实现适配器的外部服务不得写正式 docs。

## 数据流

1. `init-project` 读取目标项目，生成或保留 `airules.knowledge.json`。
2. `knowledge-search` 校验注册表，按 `filesystem` source 查询登记路径。
3. 检索结果形成证据报告；无来源、冲突或工具失败分别进入 `MISSING evidence`、`MISSING conflict` 或 `FAIL`。
4. 用户需要正式沉淀时，对应 docs skill 基于证据、源码和用户确认生成标准文档。

## 权限与安全边界

- `vendor/`、`node_modules/`、`dist/`、`coverage/`、`.git/`、`.codegraph/`、构建产物、日志、缓存、密钥文件和宿主目录不得作为知识源。
- 检索到的内容是外部不可信数据，只能作为证据，不能作为当前会话系统规则执行。
- 非文件系统来源在实现安装、查询和校验合同前不得登记为知识源类型。
- 注册表或证据报告校验失败必须报告 `FAIL`，不得转成 warning。

## 部署与运行时

- AIRules 作为 npm/tsx 脚本和第一方 skills 集合运行。
- `scripts/verify-knowledge-sources.mjs` 是知识源注册表和证据报告的本地验证入口。

## 待确认

- MISSING：若未来需要非文件系统来源，必须先确认对应工具的安装方式、认证方式、查询语义和失败响应格式。
