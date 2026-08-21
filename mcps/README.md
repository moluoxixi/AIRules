# MCP Servers

全局 MCP 服务器配置集合，按领域分类。

## 目录结构

```
mcps/
├── README.md
└── code/                   # 编码相关 MCP 服务器
    ├── mcps.json          # MCP 配置和安装要求（统一清单）
    └── README.md
```

## 配置文件格式

每个分类目录下的 `mcps.json` 包含所有 MCP 服务器的配置和安装要求：

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
          "skipIfCommandAvailable": "...",
          "windowsCommandShim": true,
          "description": "安装说明"
        }
      ],
      "description": "服务器功能说明"
    }
  }
}
```

**一看就知道**：
- `mcp` - 如何启动这个 MCP 服务器
- `setup` - 需要安装哪些命令（空数组表示无需安装）
- `description` - 这个 MCP 服务器是做什么的

## 分类说明

### code/
编码相关的 MCP 服务器，供所有编码角色共享。

查看 `code/mcps.json` 可以看到：
- **codegraph** - 需要全局安装命令
- **context7** - 无需安装（npx）
- **sequential-thinking** - 无需安装（npx）
- **playwright** - 无需安装（npx）

## Vendor Projection 配置

在 `constants/skills.ts` 中配置：

```typescript
const projection = {
  kind: 'mcp',
  sourceFile: 'mcps/code/mcps.json',
  output: 'mcps/code/mcp.json',
}
```

同步时：
1. 读取 `mcps.json` 文件
2. 提取每个 MCP 的 `mcp` 配置生成标准的 `mcp.json`
3. 自动执行所有 `setup` 命令安装依赖

## 同步后结构

```
vendor/
└── mcps/
    └── code/
        └── mcp.json  # 标准 MCP 配置格式
```

## 添加新分类

如果需要其他领域的 MCP 服务器：

```bash
mkdir -p mcps/design
# 创建 mcps/design/mcps.json 和 mcps/design/README.md
```

分类示例：
- `mcps/code/` - 编码相关
- `mcps/design/` - 设计相关
- `mcps/data/` - 数据分析相关
- `mcps/devops/` - 运维相关
