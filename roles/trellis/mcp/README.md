# Role MCP Configuration

角色特定的 MCP 服务器配置。

## 说明

此目录用于角色专属的 MCP 服务器配置。共享 MCP 统一管理在 [`capabilities/`](../../../capabilities/README.md) 中，与对应能力的 skills 和供应商声明放在一起。

## 使用场景

只有当某个角色需要**独特的、不与其他角色共享的** MCP 服务器时，才在这里添加配置。

例如：
- 某个角色需要连接特定的内部服务
- 某个角色需要特殊的 MCP 工具配置

## 当前配置

`mcp.json` 中的 `mcpServers` 保持为空；此角色通过 `role.yaml` 选择 `common`、`coding` 和 `frontend`，从全局能力目录同步共享 MCP。

## 扩展配置

如果需要添加角色专属的 MCP 服务器：

```json
{
  "mcpServers": {
    "custom-service": {
      "command": "...",
      "args": ["..."]
    }
  }
}
```

最终配置会合并全局配置和角色配置。
