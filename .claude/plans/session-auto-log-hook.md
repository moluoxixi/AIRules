# 计划：会话自动记录 hook 作为 AIRules 可分发能力

## 目标与范围

让"每轮回答结束自动记录会话"成为 AIRules 的一个**可分发能力**：通过 `host-setup` 安装时，自动把一个 Stop hook 写进支持的宿主配置；hook 脚本在**任意项目的当前工作目录**下建 `knowledge/sessions/auto/` 并追加一条记录。

记录粒度：**优先 transcript 路径引用**（Claude 与 Codex 的 Stop hook 均提供 `transcript_path`），一行一条 `时间戳 + session_id + transcript 路径 + cwd`，不复制全文、不膨胀、低泄密。

### 宿主能力现实（已核验 `constants/hosts.ts` 全 14 宿主 + 官方 hook 文档）
- 投影模型当前只处理三类：baseline 规则、skills/agents、MCP。**无 hook 概念**。
- **两个宿主有按轮 `Stop` 生命周期 hook**：
  - **Claude Code**：`~/.claude/settings.json`，`hooks.Stop[]`，stdin 收 JSON（`transcript_path`/`session_id`/`cwd`/`hook_event_name`）。exit 0 即可，stdout 可空。
  - **Codex CLI**：`~/.codex/config.toml` 内联 `[[hooks.Stop]]`（或 `~/.codex/hooks.json`），stdin 同构收 JSON（含 `transcript_path`/`session_id`/`cwd`/`turn_id`/`stop_hook_active`）。**差异：Stop hook exit 0 时 stdout 必须是合法 JSON，纯文本非法。**
- 其余宿主（Cursor/QoderWork/Trae/OpenCode 等）暂无等价机制：走与 `agentFormat:'json'` 同款的"显式跳过 + 告警"路径。日后开放 hook API，只需在 `HOST_CONFIGS` 加一条 `hooks` 配置即可启用——这正是做成机制而非一次性脚本的价值。
- 注意区分 Codex 两套机制：`notify`（旧，仅 `agent-turn-complete`，收单 JSON 参数非 stdin）vs `hooks.Stop`（新，stdin 收 JSON，与 Claude 同构）——**本方案用后者**，与 Claude 统一。

## 设计（镜像现有 MCP 投影模式——MCP 已同时处理 JSON 与 TOML 双格式，正好复用）

### 1. 中性源：新增 `hooks/` 目录（仓库内，跟 `mcp/` 平级）
- `hooks/session-log.mjs`：Stop hook 脚本，读 stdin JSON（`transcript_path`/`session_id`/`cwd`/`hook_event_name`），在 `<cwd>/knowledge/sessions/auto/<YYYY-MM-DD>.log` 追加一行。
  - 纯 Node、无依赖；任何异常都 `process.exit(0)`（hook 失败绝不能阻断用户对话）。
  - **跨宿主兼容收尾**：写完日志后向 stdout 打一个空 JSON `{}`——Claude 容忍、Codex 要求 JSON，二者通用。
  - 脱敏：只写路径与 id，不读 transcript 内容、不回显敏感值（与 `session-capture` 写入边界一致）。
  - 按你的决定：**任意项目 cwd 下都建目录并记**（不判 `knowledge/ + openspec/` 是否已存在）。
  - 容错 `transcript_path` 为 null（Codex 声明 transcript 格式不稳定、可能缺失）：缺失时仍记 session_id + cwd，路径字段写 `(none)`。

### 2. Schema：`constants/hosts.ts` 加可选 `hooks` 字段
```ts
export interface HookProjection {
  /** hook 配置根目录相对宿主 home 的目录片段（'.' = hostHome 根） */
  relDir: string
  /** 配置文件名：Claude = settings.json；Codex = config.toml */
  fileName: string
  /** 文件格式：决定合并写法 */
  format: 'json' | 'toml'
  /** 事件名（当前只用 'Stop'） */
  event: string
  /** 脚本源文件名（位于 vendor/hooks 下） */
  scriptName: string
}
```
- Claude：`{ relDir:'.', fileName:'settings.json', format:'json', event:'Stop', scriptName:'session-log.mjs' }`
- Codex：`{ relDir:'.', fileName:'config.toml', format:'toml', event:'Stop', scriptName:'session-log.mjs' }`
- `ResolvedHostPaths` 加 `hooks?` 与 `hooksHome`，`resolveHostPaths()` 同步解析（与 mcp 完全对称）。

### 3. 投影：`scripts/lib/install.ts`
- `syncFirstPartyToHome()` 增一行：`syncOptionalDir(repoRoot/hooks → vendor/hooks)`（与 `vendor/mcp` 对称）。`ensureInstallRoot` 加 `vendor/hooks` 目录。
- 新增 `projectHooksToHost(moluoHome, hooksHome, hooks)`，仿 `projectMcpToHost` 的**双格式分支**：
  - 把 `vendor/hooks/<scriptName>` 拷到宿主稳定路径（如 `<hostHome>/hooks/session-log.mjs`）。
  - **JSON 分支（Claude）**：读 `settings.json`（去软链、保 BOM 处理同 `readHostConfigForMerge`），浅合并 `hooks.Stop`：剔除既有"指向本脚本(`session-log.mjs`)"的受管条目再追加最新一条；**保留用户其它 Stop hook**。写 `{ hooks:{ Stop:[{ hooks:[{ type:'command', command:'node', args:[<abs script>] }] }] } }`。
  - **TOML 分支（Codex）**：仿 MCP 的 `# >>> AIRULES … >>>` 受管块策略，在 `config.toml` 注入 `[[hooks.Stop]]` + `[[hooks.Stop.hooks]]`（`type='command'`，`command='node "<abs script>"'`），幂等替换受管块、保留块外用户 hook。
  - 源缺失则 no-op。
- `projectToHost()` 在 `if (mcp) …` 之后加 `if (hooks) projectHooksToHost(...)`；`projectHostById()` 解构出 `hooks/hooksHome` 传入；`hasHostHome` 为假时不投影。

### 4. 校验：`scripts/lib/verify.ts`
- `verifyHost` 加 `verifyHookProjection`：宿主声明 hooks 时，按 `format` 断言配置文件含一条指向 `session-log.mjs` 的受管 Stop hook，且脚本文件存在；缺失则 FAIL。无 hooks 宿主跳过（不算失败）。

### 5. 打包：`package.json` `files` 数组加 `"hooks"`（随 npm 包分发）。

## 测试（先红后绿；放 `scripts/lib/__test__/`，与 mcp 同文件或新建 `hook-projection.test.ts`）

单元（投影逻辑，temp 宿主 home）：
- `projectHooksToHost` 把 Stop hook 写进空 `settings.json`（Claude，JSON）结构正确。
- `projectHooksToHost` 把 `[[hooks.Stop]]` 写进 `config.toml`（Codex，TOML 受管块）结构正确。
- **幂等**：JSON 与 TOML 各连投两次，指向本脚本的条目均仅 1 条。
- **用户优先**：宿主已有一条用户自定义 Stop hook + 其它键，投影后用户条目与其它键保留，仅追加/替换受管条目。
- settings.json 带 BOM / 已是软链时安全处理（不写穿链接）。
- 中性源 `vendor/hooks` 缺失时 no-op，不报错。
- 非 hook 宿主（无 hooks 字段）不写任何配置。

行为（脚本本身）：
- 假 stdin JSON（`transcript_path`/`cwd` 指向 temp 项目）跑 `session-log.mjs`，断言 `<cwd>/knowledge/sessions/auto/<date>.log` 被建且含 transcript 路径与 session_id。
- `transcript_path` 为 null / stdin 为空 / 畸形 JSON 时仍 exit 0、不抛，且 stdout 为合法 JSON（Codex 兼容）。

合约（`__test__/workflow-contract.test.ts`）：
- `hooks/session-log.mjs` 存在且 exit-0 容错文本锚点。
- check #9 复核：`hooks/` 不在 `skills/` 下，不会触发"宿主目录引用"误报（脚本里出现 `knowledge/ + openspec` 是项目本地、非宿主全局，正则只匹配 `~/.claude` 等，安全）。

## 文档
- `docs/architecture/host-agent-mcp-mapping.md`（或新增 `host-hook-mapping.md`）补一节：哪些宿主有 Stop hook（Claude/Codex）、各自配置文件与格式、Codex 的 stdout-must-be-JSON 差异、为何其它宿主跳过。
- 视情况加 ADR（hook 投影是新的对外行为契约）。**建议加**一条轻 ADR 记"Stop hook 投影：Claude+Codex 双宿主、机制为多宿主预留、脚本跨宿主 stdout 兼容"。

## 影响文件清单
| 文件 | 改动 |
|---|---|
| `hooks/session-log.mjs` | 新增：跨宿主 Stop hook 脚本（stdout 打 `{}` 兼容 Codex） |
| `constants/hosts.ts` | 加 `HookProjection`(含 `format`) + Claude & Codex 配置 `hooks` + resolve |
| `scripts/lib/install.ts` | vendor/hooks 同步 + `projectHooksToHost`(JSON/TOML 双分支) + 接线 |
| `scripts/lib/verify.ts` | `verifyHookProjection`(按 format 校验) |
| `scripts/lib/__test__/hook-projection.test.ts` | 新增投影(JSON+TOML) + 脚本行为测试 |
| `__test__/workflow-contract.test.ts` | hook 存在性 + 容错/stdout-JSON 锚点 |
| `package.json` | `files` 加 `hooks` |
| `docs/architecture/*` | hook 映射说明（+ 可选 ADR） |

## 验证方式（落地后实际运行）
- `npm run rules:check` / `npm test` / `npm run lint:check` / `npm run typecheck` 全绿。
- 真实冒烟：`npx tsx scripts/host-setup.ts --host claude --user-home <临时dir>` 与 `--host codex`，确认临时 `.claude/settings.json` 与 `.codex/config.toml` 各自被正确合并、脚本就位。
- 独立实例评审最终 diff（reviewer ≠ coder）。

## 已确认的决策
- 范围：做成 AIRules 可分发能力（非仅本机装一个 hook）。
- 日志落点：各项目各自 `knowledge/sessions/auto/`。
- 目录策略：任意项目 cwd 下都建并记。
- 粒度：优先 transcript 路径引用。
- 现实边界：实际对 **Claude + Codex 双宿主**生效，其余宿主显式跳过 + 告警，机制为多宿主预留。

## 未决/交付时确认
- 是否同时加 ADR（我倾向加一条轻量的）。
- `knowledge/sessions/auto/` 是否需要配套 `.gitignore`（自动日志通常不入库）——倾向脚本首次建目录时写一个 `.gitignore` 忽略 `*.log`。
