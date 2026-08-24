# `.agents` 原生支持调研

## 调研口径

- 调研日期：2026-08-24。
- 目标是判断 AIRules 已建立的用户级 `~/.agents/skills` 能否替代 host 私有 skills 目录，而不是只判断平台是否认识某个项目级 `.agents` 路径。
- skills 与 MCP 分开判断；`AGENTS.md`、Agent Skills 标准兼容、MCP 功能存在均不能推导整个 `.agents` 目录受支持。
- 只有官方文档、官方源码或官方发布说明计为支持证据；证据不足按“不确认支持”处理。

## 结论矩阵

| Host | 用户级 `~/.agents/skills` | 项目级 `.agents/skills` | `.agents` 内 MCP | 建议 |
|---|---|---|---|---|
| `claude` | 不确认 | 不确认 | 不确认 | 保留私有 skills 与 MCP 投影 |
| `codex` | 明确支持 | 明确支持 | 不确认；官方位置为 `.codex/config.toml` / `~/.codex/config.toml` | 停止私有 skills 投影，保留 MCP |
| `hermes` | 仅在 `skills.external_dirs` 显式配置后支持 | 支持，但有 trust gate | 不确认 | 保留当前默认私有 skills 投影 |
| `cursor` | 明确支持 | 明确支持 | 不确认；使用 `.cursor/mcp.json` / `~/.cursor/mcp.json` | 停止私有 skills 投影，保留 MCP |
| `qoderwork` | 不确认 | 不确认 | 不确认 | 保留私有 skills 投影 |
| `trae` | 不确认 | 支持，但需开启设置 | 不确认；项目 MCP 使用 `.trae/mcp.json` | 保留用户级私有 skills 与 MCP 投影 |
| `trae-cn` | 不确认 | 支持，但需开启设置 | 不确认；项目 MCP 使用 `.trae/mcp.json` | 保留用户级私有 skills 与 MCP 投影 |
| `trae-solo` | 不确认 | 不确认 | 不确认 | 维持 skills 不投影，保留 MCP |
| `trae-solo-cn` | 不确认 | 不确认 | 不确认 | 维持 skills 不投影，保留 MCP |
| `qoder` | 用户确认支持；官方 scope 未说明 | 官方只确认读取相对 `.agents/skills`，解析基准未说明 | 不确认 | 停止私有 skills 投影，保留 MCP |
| `opencode` | 明确支持 | 明确支持 | 不确认；使用 OpenCode config | 停止私有 skills 投影，保留 MCP |

## 官方证据

### Codex

- [Build skills](https://developers.openai.com/codex/skills)：Codex “scans `.agents/skills` in every directory from your current working directory up to the repository root”，并明确列出 `$HOME/.agents/skills`。
- [Model Context Protocol](https://developers.openai.com/codex/mcp)：MCP 默认位于 `~/.codex/config.toml`，项目级位于 `.codex/config.toml`，使用 `[mcp_servers.<server-name>]`。

### Cursor

- [Agent Skills](https://cursor.com/docs/skills)：自动加载 `.agents/skills/`、`.cursor/skills/`、`~/.agents/skills/` 和 `~/.cursor/skills/`。
- [MCP](https://cursor.com/docs/mcp)：项目级 `.cursor/mcp.json`，用户级 `~/.cursor/mcp.json`，顶层 `mcpServers`。

### OpenCode

- [Agent Skills](https://opencode.ai/docs/skills/)：明确列出项目 `.agents/skills/<name>/SKILL.md` 和用户 `~/.agents/skills/<name>/SKILL.md`。
- [MCP servers](https://opencode.ai/docs/mcp-servers/) 与 [Config](https://opencode.ai/docs/config/)：MCP 位于 OpenCode config 顶层 `mcp`；全局 config 为 `~/.config/opencode/opencode.json`，项目 config 为根 `opencode.json`。

### Claude Code

- [Extend Claude with skills](https://code.claude.com/docs/en/skills)：官方位置仅列 `~/.claude/skills/<skill-name>/SKILL.md`、`.claude/skills/<skill-name>/SKILL.md` 和 plugin skills，未列 `.agents/skills`。
- [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)：项目 MCP 为根 `.mcp.json`，用户/local scope 位于 `~/.claude.json`。
- [How Claude remembers your project](https://code.claude.com/docs/en/memory)：明确说明读取 `CLAUDE.md` 而不是 `AGENTS.md`，不能据此推断 `.agents`。

### Hermes

- [Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)（[官方源码](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/skills.md)）：项目 `<project-root>/.agents/skills/` 受 trust gate 管理；用户共享目录必须通过 `skills.external_dirs` 显式加入。
- [MCP](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)：MCP 位于 `$HERMES_HOME/config.yaml` 顶层 `mcp_servers`。

### Qoder 与 QoderWork

- [Qoder IDE Release Notes](https://docs.qoder.com/release-notes/desktop)：0.4.2 声明 “Now reads skills from `.agents/skills`”，但未说明 repo/user scope。
- [Qoder IDE Skills](https://docs.qoder.com/extensions/skills)：明确的用户/项目私有路径为 `~/.qoder/skills` 与 `.qoder/skills`。
- [Qoder IDE MCP](https://docs.qoder.com/user-guide/chat/model-context-protocol)：确认 MCP JSON 顶层 `mcpServers`，未确认 `.agents` 或磁盘 scope。
- [QoderWork Skills](https://docs.qoder.com/qoderwork/skills)：只确认 `~/.qoderwork/skills/`。
- [QoderWork Connectors](https://docs.qoder.com/qoderwork/connectors)：支持 Custom MCP Servers，但未确认 `.agents` 路径。
- Qoder CLI 的 `.agents/skills` 默认兼容不外推到当前 `qoder` / `qoderwork` host。

### TRAE / TraeCode / TraeWork

- [TraeCode Skills](https://docs.trae.ai/ide/skills?_lang=en) 与 [中国版技能](https://docs.trae.cn/ide_skills)：项目 `.agents/skills/` 需显式开启 `Enable .agents skill directory`；未确认用户级 `~/.agents/skills`。
- [TraeCode MCP](https://docs.trae.ai/ide/add-mcp-servers?_lang=en) 与 [中国版 MCP](https://docs.trae.cn/ide_add-mcp-servers)：项目 MCP 位于 `.trae/mcp.json`。
- [TraeWork Skills](https://docs.trae.ai/solo/skills?_lang=en) 与 [中国版 Skills](https://docs.trae.cn/work_skills)：未列 `.agents/skills` 自动发现。

## 仓库映射

- `constants/hosts.ts` 定义 canonical `~/.agents/skills` 和全部 11 个 host。
- `scripts/lib/install.ts` 当前执行 `vendor/skills -> ~/.agents/skills -> host 私有 skills`。
- `scripts/lib/verify.ts` 先验证 mandatory canonical skills，再按 `projectSkills` 决定是否验证 host 私有 skills；MCP 验证独立执行。
- 现有 `projectSkills: false` 已能表达“跳过 host skills、保留 MCP”，但升级时还需清理旧版本创建且仍指向 AIRules 内部的 host 私有链接。

## 推荐策略

- 对 `codex`、`cursor`、`qoder`、`opencode` 设置 `projectSkills: false`；Qoder 的纳入依据是用户对实际兼容性的确认，官方 scope 证据仍按原状记录。
- 安装/更新时只删除这四个 host 私有 skills 目录中指向 AIRules 或 canonical 层的旧链接，保留用户自有目录、文件和外部链接。
- 其它 host 保持现状，直到官方明确默认读取用户级 `~/.agents/skills`，或用户提供同等兼容性确认。
- 本次不减少任何 MCP 投影。
