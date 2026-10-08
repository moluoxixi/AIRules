# 全局能力目录

`capabilities/` 集中维护跨角色复用的供应商声明、skills 和 MCP 配置。每个能力目录同时容纳资产与安装声明；角色在 `roles/<role>/role.yaml` 中选择能力。

能力、角色和[宿主声明](../hosts/README.md)都使用 YAML，因为它们是安装器、校验器和其它分发工具共享的配置数据，而不是执行逻辑。新增能力、角色或宿主只需更新声明，不需要编写 TypeScript 注册表。声明类型集中在 `scripts/lib/types/`；旧角色的 `constants/skills.ts` 仅作为兼容回退，不是权威来源。

## 目录与职责

```text
capabilities/
├── common/
│   ├── capability.yaml         # 通用能力声明
│   ├── skills/
│   │   ├── create-skill/SKILL.md
│   │   ├── hindsight-memory/SKILL.md
│   │   └── spec-organization/SKILL.md
│   ├── mcps.json               # Hindsight 本地记忆 MCP
│   └── README.md
├── coding/
│   ├── capability.yaml
│   ├── mcps.json               # CodeGraph、Context7、Sequential Thinking
│   └── README.md
├── frontend/
│   ├── capability.yaml         # Anthropic frontend-design 上游声明
│   ├── mcps.json               # Playwright
│   └── README.md
├── productivity/capability.yaml # Matt Pocock productivity 上游声明
└── engineering/capability.yaml # Matt Pocock engineering 上游声明
```

每个能力目录的 `capability.yaml` 描述从哪个 Git 仓库、哪个固定 commit、哪个路径获取资产，以及投影到哪里；目录中的 `skills/` 和 `mcps.json` 是能力实际携带的资产。`scripts/lib/capabilities.ts` 是安装器使用的通用加载器，按角色选择顺序组合这些声明，合并相同供应商并拒绝配置冲突；`scripts/lib/types/capabilities.ts` 只存放声明类型。新增能力只需新增目录和 `capability.yaml`，无需修改 TypeScript 注册表。

AIRules 自有共享 skills 实际存放在 `capabilities/<能力>/skills/`。第三方 skills 保留在上游，安装时按声明的固定 commit 远程同步，不在此目录复制源码。AIRules 自有资产也从 AIRules 的远程 checkout 投影，符合本项目的远程分发机制。

## 能力与角色

| Capability | Skills | MCP |
|---|---|---|
| [`common`](common/README.md) | AIRules `create-skill`、`spec-organization`、`hindsight-memory`；上游 `hindsight-docs` | Hindsight HTTP 记忆 |
| [`coding`](coding/README.md) | 无 | CodeGraph、Context7、Sequential Thinking |
| [`frontend`](frontend/README.md) | Anthropic `frontend-design` | Playwright |
| `productivity` | Matt Pocock productivity skills | 无 |
| `engineering` | Matt Pocock engineering skills | 无 |

| Role | Capabilities |
|---|---|
| `trellis` | `common`, `coding`, `productivity`, `frontend` |
| `moluoxixi` | `common`, `coding`, `productivity`, `frontend` |
| `matt` | `engineering`, `productivity` |

角色选择示例：

```yaml
# roles/<role>/role.yaml
capabilities:
  - common
  - coding
  - frontend
```

`roles/<role>/role.yaml` 声明角色自身的 `role_vendor`、CLI 安装命令、宿主支持、继承关系和 publishable packages。角色自有的 `init-project`、hooks、agents、packages 等仍放在 `roles/<role>/`，由 `role-assets` 全量同步。旧包若仍带有 `constants/skills.ts`，安装器会在没有 `role.yaml` 时兼容读取它。

## MCP 清单

```json
{
  "mcps": {
    "example": {
      "mcp": { "command": "example-mcp", "args": ["--stdio"] },
      "setup": [],
      "description": "服务器用途"
    }
  }
}
```

`mcp` 保存宿主连接配置：stdio 使用 `command` 和 `args`，HTTP 使用 `type: "http"`、`url` 及可选 `headers`。`setup` 保存结构化前置命令，支持 `command`、`args`、`skipIfCommandAvailable` 和 `windowsCommandShim`；`description` 用于说明。空 `setup` 表示 AIRules 不执行安装命令，运行环境仍需满足服务器要求。

安装器从远程清单提取 `mcp` 配置，生成 `vendor/mcps/<分类>/mcp.json`，再与角色和用户的宿主配置合并。共享 skills 递归发现后按 skill 名称投影到 `vendor/skills/<skill>/`，不把 `common` 作为宿主中的 skill 名称前缀。

## 添加资产

- 共享 skill：放入 `capabilities/<能力>/skills/<skill>/SKILL.md`。已有 `namespace` 投影会自动发现新增 skill；每个 skill 的 frontmatter 必须包含 `name` 和 `description`。
- 共享 MCP：更新该能力的 `mcps.json`，并在 `capability.yaml` 的 `role_projections` 中声明投影。
- 外部供应商：在 `capability.yaml` 的 `vendors` 中声明仓库、固定 commit 与需要的 skill 路径；同一供应商跨能力复用时必须使用一致的来源、版本和 setup。
- 角色专属资产：放在 `roles/<role>/`。角色只选择能力，无需逐个复制公共供应商配置。

公共分发和能力测试放在 `scripts/lib/__test__/`；角色专属测试放在 `roles/<role>/__test__/`。
