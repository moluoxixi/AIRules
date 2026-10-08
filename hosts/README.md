# 宿主声明

`hosts.yaml` 是公共安装器的宿主配置来源，与角色的 `role.yaml`、能力的 `capability.yaml` 一样采用 YAML。这里维护配置数据；`scripts/lib/hosts.ts` 负责加载、校验、别名查找和路径解析，类型位于 `scripts/lib/types/hosts.ts`。

声明随 npm 包分发。源码运行和打包后的 CLI 都从自身所在的包定位声明，不依赖用户的当前工作目录。字段使用 `snake_case`，加载器转换为运行时使用的 `camelCase`。

## 添加宿主

在 `hosts.yaml` 的 `hosts` 数组中追加条目；数组顺序也是帮助输出和 `--host all` 的处理顺序。角色的 `hosts: all` 自动包含新增宿主，显式列出的角色需自行加入新 ID。

```yaml
- id: example
  aliases: [example desktop]
  home_rel_path: .example
  project_skills: false
  mcp:
    rel_dir: .
    file_name: mcp.json
    servers_key: mcpServers
    format: json
    server_defaults:
      type: stdio
```

`id` 使用小写字母、数字和连字符；别名仅供 CLI 输入，角色声明必须使用 ID。所有 ID 和别名必须唯一，`all` 为保留名称。

## 字段

顶层必须包含 `schema_version: 1`、`global_agent_skills` 和非空的 `hosts`。`global_agent_skills` 声明所有角色共享的 skills 目录，当前为 `~/.agents/skills`。

| 宿主字段 | 含义 |
| --- | --- |
| `id` | 宿主 ID，必填 |
| `aliases` | 可选的 CLI 别名列表 |
| `home_rel_path` | 相对用户 home 的宿主目录，必填 |
| `skills_dir_name` | 私有 skills 目录名，默认 `skills` |
| `excluded_skills` | 最终宿主投影时排除的 skill 名称列表 |
| `project_skills` | 是否创建私有 skills 投影，默认 `true`；`false` 表示宿主复用 canonical skills |
| `mcp` | 可选的 MCP 投影配置 |

| MCP 字段 | 含义 |
| --- | --- |
| `home_rel_path` | MCP 配置的根目录，相对用户 home；默认使用宿主目录 |
| `rel_dir` | 配置文件相对 MCP 根目录的位置，必填；`.` 表示根目录 |
| `file_name` | 配置文件名，必填 |
| `servers_key` | 宿主使用的 MCP servers 字段名，必填 |
| `format` | `json` 或 `toml`，必填 |
| `require_host_home` | 为 `true` 时，只有宿主目录存在才写入 MCP |
| `default_top_level` | 新配置的顶层默认字段，不覆盖已有用户字段 |
| `server_defaults` | 每个 server 的默认字段，不覆盖源配置 |
| `server_overrides` | 按 server 名称指定宿主适配字段 |
| `server_command_format` | `command-and-args`（默认）或 `command-array` |

路径统一使用 `/`，运行时按系统转换。目录路径必须相对且不含 `..`；文件名、skills 目录名和排除的 skill 名称必须为单个路径段。加载器拒绝未知字段、错误类型、重复 YAML key、YAML alias 和冲突的 ID/别名。

宿主原生 agents、commands、hooks、settings 由角色的项目初始化器安装。这里负责用户级 skills 和 MCP 的公共投影。

修改后运行 `pnpm run lint:check`、`pnpm run typecheck`、`pnpm test` 和 `pnpm run verify:packed-airules`，验证声明、安装行为及 npm 包中的加载路径。
