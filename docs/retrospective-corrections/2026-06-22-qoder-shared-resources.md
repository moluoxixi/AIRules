# 偏差原因分析

## 确认后的标准

Qoder 需要用户根目录下的共享资源：

- `~/.qoder/AGENTS.md`
- `~/.qoder/skills`
- `~/.qoder/agents`

Qoder 的 MCP 配置仍写入 `~/AppData/Roaming/Qoder/SharedClientCache/mcp.json`，且 `codegraph` server 需要保留 `type: "stdio"`。

## 事实证据

- 用户反馈：`qoder需要skills，agents，在用户根目录/.qoder/skills,agents中`。
- 用户补充确认：`qoder需要agents.md`。
- 修复前 `constants/hosts.ts` 中 `qoder.homeRelPath` 指向 `AppData/Roaming/Qoder/SharedClientCache`，并设置 `projectSharedResources: false`、`projectBaseline: false`。
- 修复前 `tests/install-coverage.test.ts` 明确断言 Qoder 不生成 `AGENTS.md`、`skills`、`agents`。
- 修复前 `docs/architecture/host-agent-mcp-mapping.md` 将 `qoder` 列为 MCP-only。

## 根因分类

- 主因：`REQUIREMENT_AMBIGUITY`
- 次因：`CONTEXT_LOSS`

## 为什么不是其它分类

- 不是单纯 `AI_EXECUTION_ERROR`：此前已确认的是 Qoder MCP 配置路径与 `codegraph` 的 stdio 要求，未同时确认 Qoder shared resources 的真实 home。
- 不是 `SKILL_GAP`：本次偏差不来自某个 skill 的触发或输出格式缺口。
- 不是 `RULE_GAP`：项目规则已经要求宿主能力进入共享配置；问题在于 Qoder 能力事实缺失后被错误建模。
- 不是 `TOOL_OR_ENVIRONMENT`：没有工具、平台或权限异常导致该配置。

## 修复动作

- 将 `qoder` 的 shared resources home 改为 `.qoder`。
- 恢复 Qoder 的默认 baseline、skills、agents 投影。
- 将 Qoder MCP home 单独配置为 `AppData/Roaming/Qoder/SharedClientCache`。
- 更新安装投影测试，要求生成 `.qoder/AGENTS.md`、`.qoder/skills`、`.qoder/agents`，并确认 MCP 不写入 `.qoder`。
- 更新验证测试，要求 `.qoder/skills` 缺失时失败，链接完整后通过。
- 更新架构映射文档，移除 Qoder MCP-only 口径。

## 验证结果

- `npx vitest run tests/install-coverage.test.ts tests/verify-coverage.test.ts`：PASS，35 tests passed。
- `npx vitest run tests/agent-mcp-projection.test.ts tests/install-coverage.test.ts tests/verify-coverage.test.ts`：PASS，56 tests passed。
- `npm run typecheck`：PASS。

## 预防动作

- 后续宿主配置必须区分 shared resources home 与 MCP home；不能只因发现 MCP 路径就把该路径建模为宿主 home。
- 对用户确认的宿主能力边界同步更新配置、测试和架构映射文档，避免旧文档反向污染实现。
