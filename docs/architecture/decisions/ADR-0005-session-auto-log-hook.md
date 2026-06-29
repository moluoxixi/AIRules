# ADR-0005 会话自动记录 hook 多宿主投影

## 状态

accepted

## 背景

`session-capture` skill 是手动按名触发的会话沉淀（用户显式说"记录这次"才跑），不在编码流水线编排里，也不自动执行。用户需要的是「每轮回答结束自动记录会话索引」——这要求**机制层、按轮触发**的承载，而非 prompt 自觉或手动 skill。

宿主调研（2026-06-29，官方文档逐一核验）确认：按轮 Stop / 完成 hook 是多个宿主的通用能力，而非 Claude 独有。已确认支持的宿主与差异见下表。AIRules 原投影模型只处理基线规则、skills/agents、MCP 三类，无 hook 概念，故需新增一类可分发投影。

| 宿主 | 完成事件 | 配置文件 | 格式 | stdin 关键字段 |
|---|---|---|---|---|
| Claude Code | `Stop` | `~/.claude/settings.json` | JSON（group 嵌套，内层 `type`） | `session_id`/`transcript_path`/`cwd` |
| Codex CLI | `Stop` | `~/.codex/config.toml` | TOML（`[[hooks.Stop]]` 受管块） | `session_id`/`transcript_path`/`cwd`/`turn_id` |
| Qoder | `Stop` | `~/.qoder/settings.json` | JSON（与 Claude 同构） | `session_id`/`transcript_path`/`cwd` |
| Trae | `Stop` | `~/.trae(-cn)/hooks.json` | JSON（顶层 `version:1`，group 嵌套） | `session_id`/`cwd`（**无 transcript_path**） |
| Cursor | `stop`（小写） | `~/.cursor/hooks.json` | JSON（顶层 `version:1`，扁平条目，无 `type`） | `conversation_id`/`generation_id`/`cwd`（**无 session_id/transcript_path**） |

## 决策

把「会话自动记录 Stop hook」作为 AIRules 的可分发能力，镜像 MCP 投影模式落地，覆盖上述 5 宿主。

- **中性源**：`hooks/session-log.mjs`（纯 Node、无依赖）。读 stdin JSON，在 `<cwd>/.airules/sessions/auto/<日期>.log` 追加一行索引（时间戳 + 事件 + session + transcript 路径 + cwd）。
- **跨宿主兼容红线**：异常一律 `exit 0`（hook 绝不阻断对话）；结束向 stdout 打合法 JSON `{}`（Codex/Cursor 要求 Stop hook stdout 为 JSON，Claude 容忍）；字段名兜底（`session_id` ← `conversation_id`），`transcript_path` 缺失记 `(none)`。
- **schema**：`HookProjection` 用 `format`(json/toml) + `version?` + `nesting`(group/flat) + `includeType?` + `event` 表达 5 宿主结构差异；仅支持 hook 的宿主在 `HOST_CONFIGS` 声明该字段。
- **投影**：`projectHooksToHost` 幂等合并——JSON 浅合并 `hooks.<event>` 并剔除指向本脚本的旧受管条目后追加最新一条；TOML 用 `# >>> AIRULES HOOK >>>` 受管块。两者均**保留用户手写的其它 hook 与顶层键**（用户优先）。
- **记录粒度**：transcript 路径引用，不复制正文、不回显敏感值（与 `session-capture` 写入边界一致）；各项目各自落 `.airules/sessions/auto/`，首次建目录写 `.gitignore` 忽略 `*.log`。

## 替代方案

- **仅本机装一个 Claude hook**：解决不了多宿主与可分发；用户换宿主即失效。
- **Claude-only 投影**：基于"只有 Claude 有 hook"的错误前提（调研已证伪）。
- **让 hook 触发一次 LLM 摘要**：hook 是 shell 脚本、无法调用模型；只能记索引。需要语义摘要时回查 transcript，属另一议题。
- **自动跑 `session-capture`**：该 skill 设计为手动、产出结构化沉淀（非每轮原始索引），强行自动化会破坏其"候选 + 人工审核"语义。

## 影响

- 新增 `hooks/session-log.mjs`；`package.json` `files` 加 `hooks`（随 npm 包分发）。
- `constants/hosts.ts`：加 `HookProjection` 类型，Claude/Codex/Qoder/Trae/Trae-CN/Cursor 声明 `hooks`。
- `scripts/lib/install.ts`：vendor/hooks 同步 + `projectHooksToHost`（JSON/TOML 双分支）。
- `scripts/lib/verify.ts`：`verifyHookProjection` 按 format 校验受管条目存在。
- 测试：`scripts/lib/__test__/hook-projection.test.ts`（投影 + 脚本行为）、`__test__/workflow-contract.test.ts`（锚点）。
- 其余宿主（OpenCode/QoderWork/Hermes/cc-switch 等）暂无确认的 Stop hook 文档，不声明 `hooks`，投影时自然跳过；日后补 hook API 只需加一条配置。
- 详细映射见 [host-hook-mapping.md](../host-hook-mapping.md)。
