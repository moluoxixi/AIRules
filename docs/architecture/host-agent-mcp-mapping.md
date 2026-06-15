# 各宿主 Agent / MCP 格式映射

本文件是从 [rulesync](https://github.com/dyoshikawa/rulesync)(v8.28.1)源码提取的**厂商格式映射知识**，作为 AIRules 投影引擎扩展 agent / MCP 维度的事实依据。AIRules 不引入 rulesync 依赖，只借鉴其映射知识。

> 来源：rulesync `src/features/subagents/<host>-subagent.ts`、`src/features/mcp/<host>-mcp.ts`、`src/constants/<host>-paths.ts`。提取时间见 git 记录。映射如与上游冲突，以 rulesync 上游源码为准。

## 核心结论：agent 格式在各厂商不一致

| 宿主 | agents 目录（相对宿主 home） | **agent 文件格式** | frontmatter/字段 |
|---|---|---|---|
| Claude Code | `agents/` | Markdown + YAML frontmatter | `name` / `description` / `model` / `tools` |
| Codex CLI | `agents/` | **TOML** | `name` / `description` / `model` |
| Cursor | `agents/` | Markdown + YAML frontmatter | `name` / `description` |
| OpenCode | `agents/`（local）或全局 `.config/opencode/agents/` | Markdown + YAML frontmatter | `description` / `mode: subagent` / `name` |
| Kiro | `agents/` | **JSON** | `name` / `description` / `tools` / `model` |

含义：一份 Markdown agent 可直接软链到 Claude / Cursor / OpenCode；但 Codex 需要 TOML、Kiro 需要 JSON，软链 Markdown 过去格式不兼容。AIRules 投影必须**按格式判定**：Markdown 兼容宿主直接软链；异格式宿主需转译或显式跳过并告警，不得静默软链错误格式（伪装成功）。

> **字段可移植性**：`model` 与 `tools` 不是各厂商通吃字段——Cursor/OpenCode 的 subagent frontmatter 没有 `tools`，`model` 也假设用户持有特定模型，且各家工具命名不一致（`Read`/`Grep`/`Glob` 仅 Claude 体系认）。因此 AIRules 第一方 agent frontmatter **只写 `name` + `description`**，工具/读写边界用正文自然语言表达，由各宿主自行映射。

## MCP 配置映射

| 宿主 | MCP 文件 | 位置（相对宿主 home / 用户 home） | servers 键 | 格式 |
|---|---|---|---|---|
| Claude Code | `.mcp.json`（项目）/ `.claude.json`（全局） | 项目根 / 用户 home | `mcpServers` | JSON |
| Codex CLI | `config.toml` | `.codex/` | `mcp_servers`（TOML 表） | **TOML** |
| Cursor | `mcp.json` | `.cursor/` | `mcpServers` | JSON |
| OpenCode | `opencode.json` | `.config/opencode/` | **`mcp`** | JSON |
| Kiro | `mcp.json` | `.kiro/settings/` | `mcpServers` | JSON |

含义：多数宿主用 JSON + `mcpServers` 键，但 OpenCode 用 `mcp` 键、Codex 用 TOML，键名与格式都不同。中性 MCP 源（`{ "mcpServers": { ... } }`）投影到各宿主时必须按表转换键名与格式。

## AIRules 投影策略

- **agent**：宿主 home 下 `agents/` 目录（与现有 skills 投影同级）。Markdown 兼容宿主走现有软链；TOML/JSON 宿主需要转译层（当前标记为 TODO，未实现前显式跳过 + 告警，不静默软链）。
- **MCP**：中性源置于仓库 `mcp/` 下（rulesync 风格 `{ "mcpServers": {} }`）。投影时按上表写各宿主对应文件、键名、格式；源缺失时为 no-op（无服务可分发，非失败）。
- 宿主格式元数据作为**数据**维护在 `constants/hosts.ts`，引擎按元数据驱动，新增宿主只加一条记录。

## 本项目宿主覆盖情况

| AIRules host id | rulesync 直接覆盖 | agent 格式判定 |
|---|---|---|
| `claude` | ✅ | markdown |
| `codex` | ✅ | toml |
| `cursor` | ✅ | markdown |
| `opencode` | ✅ | markdown |
| `hermes` / `hermes desktop` | ❌（用 SOUL.md 身份文件） | agent 支持待确认，暂按 markdown |
| `trae` / `trae-cn` / `qoderwork` / `cc-switch` | ❌（AGENTS.md 系） | 暂按 markdown（与 AGENTS.md 生态一致） |

`hermes` 与 AGENTS.md 系宿主未被 rulesync 直接覆盖，其 agent 格式为推断（markdown），正式启用前需各自验证；标记为 `MISSING verify`。
