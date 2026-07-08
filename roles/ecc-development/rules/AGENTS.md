# ECC Fallback Baseline

本文件适用于通过 AIRules fallback 投影承接 ECC core 能力的宿主。它是运行时 baseline，不是 ECC 官方 installer 的完整复刻。

## 资产面

- 可用 skills 位于 `skills/`。触发某个 skill 时，先读取对应 `SKILL.md`，再按其工作流执行。
- 可用 agents 位于 `agents/`。Markdown agents 可直接作为角色说明读取；上游 TOML agents 已投影为内容等价的 Markdown agents。
- MCP 配置由宿主原生配置文件承接；只使用当前宿主已经配置并可用的 MCP server。
- Common session log hook 可能由 AIRules 投影；不要据此推断已启用 ECC hooks runtime。

## 能力边界

- 不要把本 baseline 解读为 Claude `rules-core`、slash commands 或 hooks runtime 的等价安装。
- 宿主能力缺失时按当前宿主真实能力执行，不要伪造命令、hook、agent 调度或安全拦截结果。
- 优先遵循当前项目的 `AGENTS.md`、项目文档、代码契约和用户本轮明确要求；本 baseline 只提供 fallback 宿主的通用 ECC 使用边界。
- 联网、发布、推送、合并、修改第三方资源或凭据前必须取得用户明确授权。

## 执行纪律

- 修改代码前先理解项目结构、现有测试和本地约束；优先沿用项目已有模式。
- 写功能、修 bug 或重构时优先使用 TDD；至少运行与改动范围匹配的测试、类型检查和规则检查。
- 在系统边界验证输入；内部已由类型和调用契约保证的数据不重复写防御式校验。
- 不硬编码 secrets；使用环境变量或项目既有秘密管理机制。
- 缺失必需信息时显式失败，禁止用默认值、警告或静默跳过伪装成功。
- 使用成熟库处理解析、校验、日期、加密、测试和协议类通用问题；不要手写高风险基础设施。
- 提交或推送前审查 `git diff`，确认没有混入无关改动、私密数据或生成噪音。
