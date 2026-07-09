# ecc-development role

`ecc-development` 是独立的 ECC 原生开发角色。它不继承 `development` 角色里的 Superpowers、gstack、BMAD 或 AIRules 第一方开发编排；本角色在 `constants/skills.ts` 中显式 `extendsRoles = ['common']`，因此会接入 `roles/common/` 的会话沉淀/记忆/反思能力，并在 ECC 没有 native target 的宿主上提供 fallback 投影。

角色清单见：

- `roles/ecc-development/constants/skills.ts`

## 接入方式

- 主编排来源：[`affaan-m/ECC`](https://github.com/affaan-m/ECC)
- 原生宿主：同步时只调用 ECC 官方**全局 target** installer，命令形态为 `npx -y --package ecc-universal ecc install --profile <profile> --target <target>`；Codex / Claude 使用 `--profile core`，OpenCode 使用 ECC 官方 `opencode` profile。项目级 target 必须在目标项目 cwd 下由项目初始化流程触发，不在 AIRules role sync 阶段执行。
- fallback 分发：AIRules 不伪装 ECC 官方 installer，而是把 ECC core 的可承接子集映射到既有 `skills`、`agents`、`mcp` 通道；本次仅用于 Qoder、Trae、Trae CN。在线上游直接承接 `skills` / Markdown agents，并把 Codex 原生 TOML agents 按内容等价转译为 Markdown agents；MCP 必须先落为 AIRules role 资产再分发。ECC 专属 rules / hooks 不作为 fallback 分发面。
- 公共层：选择 `ecc-development` 时会按 `extendsRoles = ['common']` 先叠加 `roles/common/`。

## ECC core 安装面

实测以下命令后，ECC core 落地面如下：

- `npx -y --package ecc-universal ecc install --profile core --target claude`
- `npx -y --package ecc-universal ecc install --profile core --target codex`

| 安装面 | 官方 core 落地 | AIRules fallback 处理 |
|---|---|---|
| Skills | Claude: `skills/ecc/` 21 个 core skills + `.agents/skills/` 33 个共享 skills；Codex: 21 个 core skills + `.agents/skills/` 33 个共享 skills | 从 ECC 上游在线 `skills/` 精确投影 21 个 core skills；从 `.agents/skills/` 投影 26 个非重名共享 skills。AIRules 的扁平 skill namespace 不能同时保留同名双份条目，重名项以 core skills 为准 |
| Agents | Claude: `agents/` 64 个 Markdown agents；Codex: `agents/` 67 个 agents，其中包含 `docs-researcher.toml`、`explorer.toml`、`reviewer.toml` 这类原生 TOML agents | 从 ECC 上游在线 `agents/` 投影到 `vendor/agents`；Codex 保留原生 `.toml` 并把 `.md` 转成 TOML；Qoder、Trae、Trae CN 把 Codex 原生 TOML agents 按内容等价转成 `.md` 后分发 |
| MCP | Codex `config.toml` 实际启用 GitHub、Context7、Exa、Memory、Playwright、Sequential Thinking；上游 `mcp-configs/mcp-servers.json` 是全量 catalog，含占位环境变量和可选重型服务 | 不直接激活上游全量 catalog；fallback 使用 `roles/ecc-development/mcp/mcp.json` 的可审计精简清单，再由 AIRules MCP adapter 按宿主格式写入 |
| Rules | Claude 有 `rules/ecc/` 约 104 个文件；Codex 无 `rules/` 目录，使用 `AGENTS.md` 指令化约束 | fallback 不分发 ECC 专属 global rules；`roles/ecc-development/rules/AGENTS.md` 分发中性 fallback baseline，只描述 assets 可见面、能力边界和运行纪律 |
| Hooks | Claude core 选择 `hooks-runtime` 并写入 Stop / SubagentStop / PreToolUse hooks；Codex core 跳过 `hooks-runtime`，仅复制 hook runtime 脚本且不配置启用 | 不把 ECC hook runtime 自动转成 fallback；仅继续叠加 AIRules `roles/common/hooks/session-log.mjs` |
| Commands | Claude core 安装 `commands/` 约 84 个 slash commands；Codex core 跳过 `commands-core` | AIRules 当前没有 commands 分发通道，不作为 fallback 激活面 |
| Scripts / state | Claude / Codex 均有安装状态文件和少量 runtime scripts；Claude scripts 面更完整 | 不作为 fallback 通用分发面；配置通过 rules/MCP/agents/skills 可见契约表达 |

## Claude / Codex 差异根因

- ECC 官方 installer 会按 target capability 选择模块：Claude core 选中 `rules-core`、`agents-core`、`commands-core`、`hooks-runtime`、`platform-configs`、`workflow-quality`；Codex core 只选中 `agents-core`、`platform-configs`、`workflow-quality`，并跳过 `rules-core`、`commands-core`、`hooks-runtime`。
- Claude Code 暴露了全局 rules、slash commands、JSON hooks settings 和 Markdown agent 目录，所以 ECC 可以把 rules / commands / hooks-runtime 作为真实宿主能力安装。
- Codex 的官方形态集中在 `AGENTS.md`、`config.toml`、TOML agents 与 MCP server 配置；没有官方 `codex-project` target，也没有与 Claude 同构的 commands/rules 目录，因此 ECC 不在 Codex core 中启用这些模块。
- Agents 数量差异不是格式转换的结果。格式差异只解释同一批 Markdown agents 在 Codex 侧会被转译为 TOML；多出的 3 个条目来自 ECC Codex target 额外携带的 Codex 原生 TOML agents：`docs-researcher.toml`、`explorer.toml`、`reviewer.toml`。

## fallback 支持判定

- 支持：Qoder、Trae、Trae CN。它们在 AIRules 中具备 skills/agents 的可见面，并且另有 MCP 和 common hook 投影；但这仍是能力裁剪后的 fallback，不等价于 Claude 的 `rules-core`、`commands-core`、`hooks-runtime`。
- Trae / Trae CN fallback 必须看到 `.trae` / `.trae-cn` host home；只有 MCP 目录存在时必须跳过，不能退化成 MCP-only 成功。
- Qoder fallback 可由 SharedClientCache MCP 目录触发创建 `.qoder` 完整投影，但 Qoder IDE 读取全局 rules/skills 的缺口按上游行为缺口处理，不把它声明成官方等价安装。
- 不支持：Trae Solo / Trae Solo CN。当前 adapter 只声明 MCP 投影，且 `projectBaseline=false`、`projectSharedResources=false`，无法承接 ECC fallback 的 rules/skills/agents 主体；只写 MCP 会把 fallback 伪装成完整安装。
- 不支持：Hermes。通用 AIRules adapter 可 append `SOUL.md` 并投影 skills/agents，但没有已审计的 ECC core MCP/hook 对齐面；本次不把它算作 ECC fallback。
- 不支持：CC-Switch、QoderWork。当前 adapter 缺少可验证的 ECC core rules/skills/agents/MCP 对齐面，不纳入本次 fallback。

## 三宿主 fallback 改造

| 宿主 | 差异来源 | 改造方式 |
|---|---|---|
| Qoder | Qoder 没有 ECC 官方 target，但 AIRules 已审计 `.qoder` skills/Markdown agents、Claude-like `settings.json` hooks，以及独立的 SharedClientCache MCP 目录 | 使用 `.qoder/skills/`、`.qoder/agents/*.md` 承接 skills/agents；MCP 写 `AppData/Roaming/Qoder/SharedClientCache/mcp.json`；hooks 仅继续叠加 AIRules common hook。因为 MCP home 与 host home 分离，SharedClientCache 存在时仍要求 `.qoder` 资源完整 |
| Trae | Trae 没有 ECC 官方 target，MCP 与 skills/agents 不在同一个 home；hook 配置不是 Claude settings，而是 `hooks.json`；Trae 没有 SubagentStop | 必须存在 `.trae` 才启用 fallback；使用 `.trae/skills/`、`.trae/agents/*.md` 承接主体；MCP 写 `AppData/Roaming/Trae/User/mcp.json` 并保留 `inputs: []`；hooks 只写 AIRules common `Stop`，不模拟 Claude `hooks-runtime` 的 SubagentStop 追踪 |
| Trae CN | 与 Trae 同能力面，但用户配置根目录不同 | 必须存在 `.trae-cn` 才启用 fallback；使用 `.trae-cn/skills/`、`.trae-cn/agents/*.md`；MCP 写 `AppData/Roaming/Trae CN/User/mcp.json`；hooks 只写 AIRules common `Stop` |

## 不承接的官方模块

- 不承接 `rules-core`：Claude 的 `rules/ecc/**` 是宿主专用注入面；Qoder/Trae/Trae CN fallback 不用 global rules 承接 ECC 语义，也不复制上游全量 rules。
- 不承接 `commands-core`：三宿主没有已审计的 ECC slash commands 分发面。
- 不承接 `hooks-runtime`：Qoder 虽有 Claude-like hook 配置，但 ECC runtime 脚本不是 AIRules 受管 hook；Trae/Trae CN 还缺 SubagentStop，不能还原 Claude 的 subagent trace 语义。
- 不承接 Codex 原始 TOML 格式：三宿主按 Markdown agents 处理，接收上游 Codex 原生 TOML agents 的内容等价 Markdown 转译，不直接安装 `.toml` 文件。

## 宿主支持

- Claude：全局 sync 走 ECC 官方 target `claude`，profile 使用 `core`；目标项目内如存在 `.claude/`，项目初始化应改用官方项目级 target `claude-project`。
- Codex：全局 sync 走 ECC 官方 target `codex`，profile 使用 `core`；ECC 官方当前没有 `codex-project`，所以 `.codex/` 项目目录不能触发项目级 ECC install。
- OpenCode：全局 sync 走 ECC 官方 target `opencode`，profile 使用 `opencode`，避免把 hooks-runtime 强行带入 OpenCode 默认配置。
- Cursor / Gemini / Zed / Antigravity / CodeBuddy / JoyCode：ECC 官方 target 是项目级，分别写入 `./.cursor/`、`./.gemini/`、`./.zed/`、`./.agent/`、`./.codebuddy/`、`./.joycode/`；这些不得在 AIRules role sync 阶段执行，必须在目标项目 cwd 下按目录存在性触发。
- Qoder / Trae / Trae CN：ECC 官方当前没有对应 target；AIRules 使用既有 host adapter 投影 fallback skills / Markdown agents / Codex 原生 TOML agents 的 Markdown 等价转译 / MCP，并继续叠加 common Stop hook。ECC 官方 hooks-runtime 只在 Claude core 中启用；fallback 不把官方 hook 配置强行转换到这些宿主。
- Hermes / Trae Solo / Trae Solo CN / CC-Switch / QoderWork：本次不启用 ECC fallback；Trae Solo 只有 MCP 面，Hermes 缺少已审计的 ECC MCP/hook 对齐面，不能承接完整 rules/skills/agents/MCP fallback。

## ECC 官方 target 支持矩阵

| AIRules 宿主 | ECC 官方 target | 安装位置 | 当前处理 |
|---|---|---|---|
| Claude | `claude` / `claude-project` | `~/.claude/` / `./.claude/` | sync 装全局；项目级由 init-project 按 `.claude/` 判断 |
| Codex | `codex` | `~/.codex/` | sync 装全局；无项目级官方 target |
| Cursor | `cursor` | `./.cursor/` | 项目级；不在 sync 阶段执行 |
| OpenCode | `opencode` | `~/.opencode/` | sync 装全局 |
| Qoder | 不支持 | - | AIRules fallback |
| Trae / Trae CN | 不支持 | - | AIRules fallback |
| Trae Solo / Trae Solo CN | 不支持 | - | 不启用 fallback：当前只有 MCP 面 |
| Hermes | 不支持 | - | 不启用 fallback：当前缺少已审计 ECC MCP/hook 对齐面 |
| CC-Switch / QoderWork | 不支持 | - | 不启用 fallback |

ECC 官方还支持但 AIRules 当前未登记为宿主的 target：`gemini`、`antigravity`、`codebuddy`、`joycode`、`qwen`、`zed`。其中 `qwen` 是全局 target；其余为项目级 target。后续若 AIRules 增加对应宿主，应按官方安装位置接入。

## Core-only 与按需扩展

`ecc-development` 默认只安装 ECC core 能力。不要在 role 同步阶段默认安装 `developer`、`full`、`framework-language`、`database`、`orchestration` 或语言/框架 skills。

语言与框架能力必须在目标项目内先扫描再安装：

1. 先读取项目知识库与已有规则，确认真实技术栈和约束。
2. 使用 ECC `/project-init` 或 `ecc consult` 产出 dry-run 计划。
3. 只有用户确认后，才执行 `ecc install --profile core --target <target> --with lang:*` 或 `ecc install --profile core --target <target> --with framework:*` 这类按需扩展命令。

示例：

```bash
npx -y --package ecc-universal ecc install --profile core --target codex
npx -y --package ecc-universal ecc consult "typescript vue project onboarding" --target codex
npx -y --package ecc-universal ecc install --profile core --target codex --with lang:typescript --with framework:vue
```

OpenCode 继续使用 `--profile opencode --target opencode`，如需额外语言/框架能力，同样先 dry-run 或 consult，再按 `--with lang:*` / `--with framework:*` 显式扩展。

## 全局规则边界

`roles/ecc-development/rules/AGENTS.md` 分发中性 fallback baseline。它不复制 Claude `rules/ecc/**`，也不写入 Codex 专属 `config.toml`、`/agent` 或 sandbox 说明；只向 Qoder、Trae、Trae CN 这类 fallback 宿主声明 `skills/`、`agents/`、MCP 可见面、能力边界和通用执行纪律。项目知识检索、语言识别、能力选择仍由具体 skill / agent / 项目自身规则承担。

## OpenSpec 跟踪

ECC 的 OpenSpec 生命周期扩展仍作为上游工作项跟踪，不在本 role 中伪装成已稳定落地能力：

- Issue: [`affaan-m/ECC#2283`](https://github.com/affaan-m/ECC/issues/2283)
- PR: [`affaan-m/ECC#2318`](https://github.com/affaan-m/ECC/pull/2318)

2026-07-06 复核状态：issue open；PR open、未合并、非 draft、mergeable state 为 `clean`。PR 合并前，`ecc-development` 只接入 ECC 稳定 skills/CLI 表面；OpenSpec ecosystem 不作为默认公司流程强依赖。
