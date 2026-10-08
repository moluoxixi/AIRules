# 记忆可视化

使用官方 Hindsight Control Plane，按 bank 浏览提取的事实、来源文档、实体关系图、mental models 和异步 operations。默认控制台为 `http://localhost:9999`，API 为 `http://localhost:8888`，MCP 为 `http://localhost:8888/mcp/`。

先读取宿主当前 `hindsight` MCP 配置，确认 API 与 bank。多 bank endpoint `/mcp/` 的 API 根地址是移除 `/mcp/` 后的服务地址；单 bank endpoint `/mcp/<bank-id>/` 同样使用 API 根地址，控制台中选择对应 bank。经过反向代理的服务应使用部署方提供的 API 根地址。

## 已有记忆服务：添加控制台

`hindsight-local-mcp` 同时提供完整 API。保留正在使用的服务及其数据，只启动独立控制台并连接当前 API：

```bash
npx --yes @vectorize-io/hindsight-control-plane@0.10.2 --hostname 127.0.0.1 --port 9999 --api-url http://localhost:8888
```

在浏览器打开 `http://localhost:9999`，选择 MCP 使用的项目 bank。远程服务将 `--api-url` 替换为实际 API 地址，同时核对宿主 MCP 指向同一服务；服务鉴权配置见 [官方安装文档](https://hindsight.vectorize.io/developer/installation)。

`hindsight-local-mcp` 的本地数据库默认位于 `~/.pg0/hindsight-mcp/`。独立控制台读写该 API 的现有数据库；下述 Docker 部署使用另一个存储卷，适用于首次部署。需要迁移已有库时先按上游数据库迁移文档处理。

## 首次部署：API 与控制台一起启动

前提：Docker Compose 可用、Docker daemon 已启动，并有可用的 LLM provider/model。部署资产位于本 skill 的 `assets/`，会完整分发到 `~/.agents/skills/hindsight-memory/`。镜像固定为 `0.10.2`，同时提供 API、MCP 和控制台。

配置文件放在用户配置目录，避免 skill 更新覆盖模型设置。以下命令从已安装 skill 读取模板；在仓库内验证时，将 `hindsightSkill` 改为本文件上一级目录。

### PowerShell

```powershell
$hindsightSkill = Join-Path $env:USERPROFILE '.agents/skills/hindsight-memory'
$hindsightConfigDir = Join-Path $env:USERPROFILE '.config/airules/hindsight'
$hindsightEnvFile = Join-Path $hindsightConfigDir 'hindsight.env'
New-Item -ItemType Directory -Force $hindsightConfigDir | Out-Null
if (-not (Test-Path -LiteralPath $hindsightEnvFile)) {
    Copy-Item -LiteralPath "$hindsightSkill/assets/hindsight.env.example" -Destination $hindsightEnvFile
}
```

编辑 `hindsight.env`，填写 provider、model 和该 provider 所需的 API key。配置就绪后：

```powershell
docker compose --env-file $hindsightEnvFile --file "$hindsightSkill/assets/compose.yaml" config --quiet
docker compose --env-file $hindsightEnvFile --file "$hindsightSkill/assets/compose.yaml" up --detach
docker compose --env-file $hindsightEnvFile --file "$hindsightSkill/assets/compose.yaml" logs --tail 60 hindsight
```

### macOS / Linux

```bash
hindsight_skill="$HOME/.agents/skills/hindsight-memory"
hindsight_config_dir="$HOME/.config/airules/hindsight"
hindsight_env_file="$hindsight_config_dir/hindsight.env"
mkdir -p "$hindsight_config_dir"
if [ ! -f "$hindsight_env_file" ]; then
  cp "$hindsight_skill/assets/hindsight.env.example" "$hindsight_env_file"
fi
```

编辑 `hindsight.env`，填写模型配置后：

```bash
docker compose --env-file "$hindsight_env_file" --file "$hindsight_skill/assets/compose.yaml" config --quiet
docker compose --env-file "$hindsight_env_file" --file "$hindsight_skill/assets/compose.yaml" up --detach
docker compose --env-file "$hindsight_env_file" --file "$hindsight_skill/assets/compose.yaml" logs --tail 60 hindsight
```

云模型填写 provider、model 和 API key；Ollama 可使用 `provider=ollama`、本地已安装的 model，以及 Hindsight 容器可访问的 `HINDSIGHT_API_LLM_BASE_URL`。Docker Desktop 的宿主 Ollama 地址通常为 `http://host.docker.internal:11434/v1`；Linux 使用实际可达的 OpenAI 兼容 API 地址。

Compose 将 API 与控制台端口绑定到本机，API 与控制台连接同一数据库。记忆存入固定 named volume `airules-hindsight-data`；skill 路径变化、容器重启与重建后仍复用该卷。停止服务可将 `up --detach` 替换为 `stop`，启动时继续使用同一配置和卷。

## 验证当前项目的记忆

1. 确认 API 的 `/health` 和控制台可以访问，宿主发现 `retain`、`recall`、`reflect` 工具。
2. 用 SKILL.md 的规则选定项目 bank。通过 MCP 保存一条用户同意的非敏感测试事实；异步写入等待 operation 完成。
3. 在控制台选择同一 bank，确认事实及其来源可见；存在实体时查看实体关系图。若页面为空，先检查 API 地址、bank 与 operation 状态。
4. 在新会话用 `recall` 检索同一事实。以上步骤成功后，才报告记忆读写与可视化已连接。

部署问题读取日志，模型连接问题核对 provider/model/base URL；检查配置时使用 `config --quiet`，无需输出 API key。记忆为空时核对服务与 bank，避免启动另一个数据库实例。

官方参考：[安装与控制台](https://hindsight.vectorize.io/developer/installation)、[MCP endpoints](https://hindsight.vectorize.io/developer/mcp-server)、[0.10.2 发布](https://github.com/vectorize-io/hindsight/releases/tag/v0.10.2)。
