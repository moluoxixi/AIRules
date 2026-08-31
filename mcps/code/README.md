# Code MCP Servers

编码相关的 MCP 服务器集合，所有编码角色共享。

## 配置文件

所有配置和安装要求都在 `mcps.json` 中，格式：

```json
{
  "mcps": {
    "<server-name>": {
      "mcp": {
        "command": "...",
        "args": ["..."]
      },
      "setup": [
        {
          "command": "...",
          "args": ["..."],
          "description": "..."
        }
      ],
      "description": "服务器功能说明"
    }
  }
}
```

## 包含的 MCP 服务器

查看 `mcps.json` 可以看到：

1. **codegraph** - 需要全局安装 `npm install -g @colbymchenry/codegraph`
2. **context7** - 无需安装，通过 npx 自动运行
3. **sequential-thinking** - 无需安装，通过 npx 自动运行

## 字段说明

- `mcp` - MCP 服务器的启动配置（符合 MCP 标准格式）
- `setup` - 安装前置命令数组
  - `command` - 要执行的命令
  - `args` - 命令参数
  - `skipIfCommandAvailable` - 如果命令已存在则跳过
  - `windowsCommandShim` - Windows 下通过 .cmd shim 执行
  - `description` - 命令说明
- `description` - MCP 服务器功能说明

## 使用方式

由 `coding` capability 统一声明 vendor projection；角色只声明 capability：

```typescript
// roles/<role>/constants/skills.ts
export const capabilities = ['coding'] as const
```

projection 的单一配置源位于 `capabilities/coding.ts`，角色清单不得重复维护。

同步时会：
1. 读取 `mcps.json` 文件
2. 提取 `mcp` 配置生成标准的 `mcp.json`
3. 执行 `setup` 命令安装依赖
