# 各宿主会话 hook 格式映射

本文件记录各宿主 hook 的格式差异，作为 AIRules hook 投影引擎的事实依据。来源为各宿主 2026-06-29 的官方文档（逐一核验，URL 见下）。映射如与上游冲突，以宿主官方文档为准。

> 下表的事件名/嵌套/version 差异以**完成类（Stop）hook** 为样本。当前 AIRules 仅分发 common `session-log.mjs` Stop hook；development runtime 回路 hook / ledger 链路已撤下。

决策背景见 [ADR-0005](./decisions/ADR-0005-session-auto-log-hook.md)。

## 核心结论：Stop hook 是多宿主通用能力，但结构各不相同

| 宿主 | 完成事件名 | 配置文件 | 格式 | 顶层 version | 条目嵌套 | 内层 type |
|---|---|---|---|---|---|---|
| Claude Code | `Stop` | `~/.claude/settings.json` | JSON | 否 | group：`[{hooks:[{...}]}]` | 是 |
| Codex CLI | `Stop` | `~/.codex/config.toml` | TOML | — | `[[hooks.Stop]]` 受管块 | — |
| Qoder | `Stop` | `~/.qoder/settings.json` | JSON | 否 | group | 是 |
| Trae / Trae CN | `Stop` | `~/.trae/hooks.json`、`~/.trae-cn/hooks.json` | JSON | 是（`1`） | group | 是 |
| Cursor | `stop`（小写） | `~/.cursor/hooks.json` | JSON | 是（`1`） | flat：`[{command}]` | 否 |

## stdin 字段差异（脚本须兜底）

| 宿主 | session 标识 | transcript 路径 | cwd |
|---|---|---|---|
| Claude Code | `session_id` | `transcript_path` | `cwd` |
| Codex CLI | `session_id` | `transcript_path`（声明格式不稳定、可能 null） | `cwd` |
| Qoder | `session_id` | `transcript_path` | `cwd` |
| Trae | `session_id` | 无 | `cwd` |
| Cursor | `conversation_id`（无 `session_id`） | 无 | `cwd`（示例为空串） |

`hooks/session-log.mjs` 的兜底策略：session 标识取 `session_id ?? conversation_id ?? '(unknown)'`；`transcript_path` 缺失记 `(none)`；`cwd` 缺失回退 `process.cwd()`。

## 跨宿主行为红线

- **stdout 必须合法 JSON**：Codex 与 Cursor 的 Stop hook 要求 exit 0 时 stdout 为合法 JSON（纯文本非法）；Claude 容忍空输出。脚本统一向 stdout 打 `{}`，三者通用。
- **Stop 永不阻断对话**：完成类 hook 脚本任何异常都 `exit 0`，不返回 `decision: block`（其语义是按轮完成时**记录**，非控制流干预）。此边界是设计立场、与能力无关，不因技术上能阻断而松动。
- **用户优先合并**：投影只增/替换 AIRULES 受管条目，保留用户手写的其它 hook 与顶层键。

## 投影实现位置

- schema：`constants/hosts.ts` 的 `HookProjection`（`format`/`version`/`nesting`/`includeType`/`event`）；`HostConfig.hooks` 支持单值或数组（多事件），经 `normalizeHooks` 归一。
- 投影：`scripts/lib/install.ts` 的 `projectHooksToHost`（JSON 浅合并 / TOML 受管块双分支）；TOML 受管块按 `scriptName` 标识，使同文件多事件互不覆盖。
- 校验：`scripts/lib/verify.ts` 的 `verifyHookProjection`（逐条校验数组）。
- 中性源脚本：`hooks/session-log.mjs`（Stop 记录）。

## 未覆盖宿主

OpenCode（插件式 25+ 事件，机制不同）、QoderWork、Hermes、cc-switch、agentsmd、Trae Solo 系列暂无确认的 Stop hook 文档或机制差异较大，当前不声明 `hooks`，投影时自然跳过。补齐 hook API 后只需在 `HOST_CONFIGS` 加一条 `hooks` 配置即可启用。

## 来源 URL

- Claude Code：https://code.claude.com/docs/en/hooks
- Codex CLI：https://developers.openai.com/codex/hooks 、 https://developers.openai.com/codex/config-advanced/
- Qoder：https://docs.qoder.com/extensions/hooks 、 https://docs.qoder.com/en/cli/hooks
- Trae：https://docs.trae.cn/ide_hook-configuration-reference
- Cursor：https://blog.gitbutler.com/cursor-hooks-deep-dive （Cursor 1.7 Hooks beta）
