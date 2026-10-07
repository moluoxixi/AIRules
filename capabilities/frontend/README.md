# Frontend

前端实现与验证能力，由角色在 `role.yaml` 的 `capabilities` 中选择 `frontend`。

- [`capability.yaml`](capability.yaml) 声明 Anthropic 的 `frontend-design` skill，按固定上游 commit 远程同步。
- [`mcps.json`](mcps.json) 声明 Playwright MCP，通过 `npx -y @playwright/mcp@latest` 提供浏览器检查、交互和 UI 验证。

安装后分别生成 `vendor/skills/frontend-design/` 和 `vendor/mcps/frontend/mcp.json`。目录规则和清单格式见 [全局能力目录](../README.md)。
