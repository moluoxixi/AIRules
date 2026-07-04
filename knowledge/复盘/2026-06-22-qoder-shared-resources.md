# Qoder 共享资源偏差分析

> 2026-07-02 决策：撤销 2026-07-01 的 `qoder` / `qoder-cli` 拆分修订。AIRules 回到旧方案：单一 `qoder` host 默认完整投影 `~/.qoder/AGENTS.md`、`~/.qoder/skills`、`~/.qoder/agents` 与三事件 hooks；MCP 仍写 `~/AppData/Roaming/Qoder/SharedClientCache/mcp.json`，`codegraph` 保留 `type: "stdio"`。Qoder IDE 当前不读取全局规则/skills 的现象按 Qoder 上游 bug 处理，等待上游修复后再重新评估。

## 确认后的标准

Qoder 共享资源 home 是 `~/.qoder`：

- `~/.qoder/AGENTS.md`
- `~/.qoder/skills`
- `~/.qoder/agents`
- `~/.qoder/settings.json` 三事件 hooks：`Stop`、`SubagentStop`、`PreToolUse`

Qoder MCP 配置路径独立于共享资源 home，写入 `~/AppData/Roaming/Qoder/SharedClientCache/mcp.json`，且 `codegraph` server 需要补 `type: "stdio"`。

## 事实证据

- 用户反馈：`qoder需要skills，agents，在用户根目录/.qoder/skills,agents中`。
- 用户补充确认：`qoder需要agents.md`。
- 后续确认：IDE 侧未读全局 rules/skills 先按 Qoder bug 处理，不拆 AIRules host 合同。
- 修复前 `constants/hosts.ts` 曾把 `qoder.homeRelPath` 指向 `AppData/Roaming/Qoder/SharedClientCache`，并设置 `projectSharedResources: false`、`projectBaseline: false`。
- 修复前测试曾断言 Qoder 不生成 `AGENTS.md`、`skills`、`agents`，这与当前合同冲突。

## 根因分类

- 主因：`REQUIREMENT_AMBIGUITY`
- 次因：`CONTEXT_LOSS`

## 为什么不是其它分类

- 不是单纯 `AI_EXECUTION_ERROR`：此前已确认的是 Qoder MCP 配置路径与 `codegraph` 的 stdio 要求，未同时确认 Qoder shared resources 的真实 home。
- 不是 `SKILL_GAP`：本次偏差不来自某个 skill 的触发或输出格式缺口。
- 不是 `RULE_GAP`：项目规则已经要求宿主能力进入共享配置；问题在于 Qoder 能力事实缺失后被错误建模。
- 不是 `TOOL_OR_ENVIRONMENT`：没有工具、平台或权限异常导致该配置。

## 2026-06-22 修复动作

- 将单一 `qoder` host 的 shared resources home 改为 `.qoder`。
- 恢复单一 `qoder` host 的默认 baseline、skills、agents 投影。
- 将 Qoder MCP home 单独配置为 `AppData/Roaming/Qoder/SharedClientCache`。
- 更新安装投影测试，要求生成 `.qoder/AGENTS.md`、`.qoder/skills`、`.qoder/agents`，并确认 MCP 不写入 `.qoder`。
- 更新验证测试，要求 `.qoder/skills` 缺失时失败，链接完整后通过。
- 更新架构映射文档，移除 Qoder MCP-only 口径。

## 2026-07-01 误修订（已撤销）

- 曾将 `qoder` 重新定义为 Qoder IDE / JetBrains host：只投影 SharedClientCache MCP 与 IDE hooks，不投影 `~/.qoder/AGENTS.md`、`skills`、`agents`。
- 曾新增 `qoder-cli` host：显式 opt-in，投影 `~/.qoder/AGENTS.md`、`skills`、`agents` 与 CLI hooks，且不进入 `--host all`。
- 曾为共用 `~/.qoder/settings.json` 的 hooks 投影增加 host owner 标记。

上述拆分现在撤销。维护者决策是：这属于 Qoder 当前 IDE 行为缺口，AIRules 不为该缺口拆宿主合同。

## 验证要求

- `npx vitest run scripts/lib/__test__/install-coverage.test.ts -t "Qoder"`：应 PASS。
- `npx vitest run scripts/lib/__test__/verify-coverage.test.ts -t "Qoder"`：应 PASS。
- 全量验证继续跑 `npm test`、`npm run typecheck`、`npm run rules:check`。

## 预防动作

- 后续宿主配置必须区分 shared resources home 与 MCP home；不能只因发现 MCP 路径就把该路径建模为宿主 home。
- 用户明确判断某宿主缺口是上游 bug 时，优先保持 AIRules 合同稳定，在文档中标注待上游修复，而不是为临时缺口新增宿主分支。
- 对用户确认的宿主能力边界同步更新配置、测试和架构映射文档，避免旧文档反向污染实现。
