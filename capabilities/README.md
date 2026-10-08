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
| `productivity` | Matt Pocock productivity skills，包括 `grilling` | 无 |
| `engineering` | Matt Pocock engineering skills | 无 |

| Role | 继承 | 自身 Capabilities |
|---|---|---|
| [`general`](../roles/general/README.md) | 无 | `common` |
| [`development`](../roles/development/README.md) | `general` | `coding`, `productivity`, `frontend` |
| `trellis` | `development` | 无，使用模板的共享能力 |
| `moluoxixi` | `development` | 无，使用模板的共享能力 |
| `matt` | `development` | `engineering` |

角色选择示例：

```yaml
# roles/<role>/role.yaml
extends_roles: [development]
capabilities: []
```

`roles/<role>/role.yaml` 声明角色自身的 `role_vendor`、CLI 安装命令、宿主支持、继承关系和 publishable packages。角色自有的 `init-project`、hooks、agents、packages 等仍放在 `roles/<role>/`，由 `role-assets` 全量同步。旧包若仍带有 `constants/skills.ts`，安装器会在没有 `role.yaml` 时兼容读取它。

共享能力的上游仓库、固定 commit 和投影路径统一以 `capability.yaml` 的 `vendors` 为准；角色通过 `capabilities` 与 `extends_roles` 引用这些声明。

## 角色继承

`extends_roles` 将角色作为可复用的能力模板。每个角色只允许继承一个父角色，或用 `extends_roles: []` 声明没有父角色。多父角色声明会在加载阶段报错，重复填写相同父角色也会报错；YAML 与旧 `extendsRoles` 导出使用同一校验规则。

`general` 提供记忆、skill 编写与文档整理；`development` 继承 `general`，集中维护 `coding`、`productivity` 与 `frontend`。具体开发角色统一继承 `development` 的基础 skills 与 MCP，再选择自己的工程工作流。`engineering` 由 Matt 角色单独选择。两个基础角色也可独立安装。

子角色安装时沿单继承链读取父角色的 `capabilities`，再加入自己的能力；链上重复的能力只处理一次。子角色可用 `capabilities: []` 继承整组模板能力。能力组合仍会校验供应商版本和投影目标冲突。

继承范围是 capability 声明及其 skills、MCP 与供应商 setup。子角色的 `role_vendor`、角色专属资产、CLI packages 和 hosts 由自身声明；安装器将继承的第一方能力从子角色的 AIRules 远程 checkout 投影到 vendor。能力模板可只声明 `capabilities` 和 `extends_roles`；独立安装的角色需提供自身 `role_vendor`。

缺失父角色、循环继承、单份声明中的重复能力及供应商版本冲突会报错。同一供应商的同一源码只投影一次；不同来源的同名 skill 仍报冲突。`grilling` skill 归属 `productivity`，随该能力的 namespace 一起同步。

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
