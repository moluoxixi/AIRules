# Common

声明 `common` capability 的角色共享此目录中的通用 skills 和记忆 MCP。供应商来源与投影由 [`capability.yaml`](capability.yaml) 维护。

## Skills

本仓库的资产实际放在 [`skills/`](skills/)：

| Skill | 用途 |
|---|---|
| `create-skill` | 创建或修订可复用的 agent skill |
| `spec-organization` | 整理项目规范文档、索引和链接 |
| `hindsight-memory` | 通过 Hindsight MCP 回忆历史决定、保存已验证结果，并按项目区分 bank；连接官方记忆控制台 |

上游 `hindsight-docs` skill 按固定 commit 远程同步，用于查询 Hindsight API、部署和高级配置。固定 commit 约束 skill 源码；服务运行包由部署环境单独管理。

## Hindsight MCP

[`mcps.json`](mcps.json) 使用官方 HTTP transport，默认 endpoint 为 `http://localhost:8888/mcp/`。不同宿主连接同一个服务，复用持久化记忆。`hindsight-local-mcp` 是 HTTP 服务入口，不是供宿主拉起的 stdio 命令。

本地运行先准备 Python 3.11+ 和 [uv](https://docs.astral.sh/uv/)，配置可用的 LLM provider，然后在单独终端启动一个实例。例如，已有 Ollama 和相应模型时，在 PowerShell 中运行：

```powershell
$env:HINDSIGHT_API_LLM_PROVIDER = 'ollama'
$env:HINDSIGHT_API_LLM_MODEL = 'llama3.2'
uvx --from hindsight-api==0.10.2 hindsight-local-mcp
```

云模型使用 `HINDSIGHT_API_LLM_API_KEY` 和对应 provider/model 配置。首次启动会下载运行依赖和本地 embedding 模型，默认嵌入式数据库保存在 `~/.pg0/hindsight-mcp/`，重启后保留数据。AIRules 安装时写入连接配置，服务由部署环境启动和维护。

默认 `/mcp/` 为多 bank 模式，工具调用通过 `bank_id` 指定项目。单 bank 可使用 `/mcp/<bank-id>/`；团队共享可连接已部署服务。通过宿主中的同名 `hindsight` 配置覆盖 `url`，AIRules 会保留用户配置；Codex 使用 `[mcp_servers.hindsight]` 的 `url`，OpenCode 使用 `type: "remote"`。

连接后验证 `retain`、`recall` 和 `reflect` 是否可用，再保存一条测试事实，在新会话中检索它。完整运行参数见 [官方 Local MCP 文档](https://hindsight.vectorize.io/docs/integrations/local-mcp)。

## 记忆可视化

已有 Hindsight API 时，独立启动官方控制台，直接查看当前服务的记忆：

```bash
npx --yes @vectorize-io/hindsight-control-plane@0.10.2 --hostname 127.0.0.1 --port 9999 --api-url http://localhost:8888
```

打开 `http://localhost:9999`，选择 MCP 使用的同一 bank，查看记忆事实、来源文档、实体关系图和异步操作状态。远程服务使用对应的 API 根地址。

首次部署可使用 `hindsight-memory` skill 自带的 [Compose](skills/hindsight-memory/assets/compose.yaml)，一次启动 API、MCP 和控制台，持久化到固定 Docker volume。部署资产会完整同步到 `~/.agents/skills/hindsight-memory/`；模型配置放在用户配置目录。两种方式的步骤、存储区别与验证方法见 [可视化操作说明](skills/hindsight-memory/references/visualization.md)。
