# Coding

编码能力的 MCP 清单位于 [`mcps.json`](mcps.json)，投影声明位于 [`capability.yaml`](capability.yaml)。角色在 `role.yaml` 的 `capabilities` 中选择 `coding` 即可使用。

| MCP | 用途 | 启动与安装 |
|---|---|---|
| `codegraph` | 代码关系探索 | setup 全局安装 `@colbymchenry/codegraph`，通过 `codegraph serve --mcp` 启动 |
| `context7` | 库文档查询 | 通过 `npx -y @upstash/context7-mcp@latest` 启动 |
| `sequential-thinking` | 结构化推理 | 通过 `npx` 启动官方 MCP 包 |

清单中的 `${workspaceFolder}` 按宿主能力处理：支持该变量的宿主保留它，其他宿主使用对应的客户端配置。安装后生成 `vendor/mcps/code/mcp.json`。

清单格式和扩展方式见 [全局能力目录](../README.md)。
