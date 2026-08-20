# Role MCP Configuration

角色特定的 MCP 服务器配置。

## 说明

此目录用于角色专属的 MCP 服务器配置。通用的 MCP 服务器（如编码相关）已统一管理在项目根目录的 `mcps/` 中。

## 使用场景

只有当某个角色需要**独特的、不与其他角色共享的** MCP 服务器时，才在这里添加配置。

例如：
- 某个角色需要连接特定的内部服务
- 某个角色需要特殊的 MCP 工具配置

## 当前配置

`mcp.json` 保持空对象，表示此角色使用全局 MCP 配置（通过 vendor projection 同步自 `mcps/`）。

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
