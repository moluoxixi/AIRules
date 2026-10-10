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
schema_version: 2
role_id: example
extends_roles: [development]
provides:
  capabilities: []
```

`roles/<role>/role.yaml` 把共享能力放在 `provides`，把角色自身的安装设置放在 `installation`。角色自有的 `init-project`、hooks、agents、packages 等仍放在 `roles/<role>/`，由 `role-assets` 全量远程同步。旧包若仍带有 `constants/skills.ts`，安装器会在没有 `role.yaml` 时兼容读取它；v2 声明不会执行这些旧模块。

共享能力的上游仓库、固定 commit 和投影路径统一以 `capability.yaml` 的 `vendors` 为准；角色通过 `provides.capabilities` 与 `extends_roles` 引用这些声明。

## 角色继承

`schema_version: 2` 支持在 `extends_roles` 中声明多个父角色。角色可以作为纯能力模板，也可以独立安装。继承只读取 `provides.capabilities`；`installation` 中的设置始终属于当前选择的角色：

| 字段 | 用途 | 是否继承 |
|---|---|---|
| `provides.capabilities` | 引用共享 skills、MCP 与供应商 setup | 是 |
| `installation.role_vendor` | 当前角色的远程资产与专属 setup | 否 |
| `installation.assets` | 当前角色的私有资产路径 | 否 |
| `installation.hosts` | 宿主支持范围 | 否 |
| `installation.packages` | 角色 CLI 与 npm 安装声明 | 否 |
| `installation.distribution`、`installation.entrypoints` | 分发约定与初始化入口 | 否 |

```yaml
schema_version: 2
role_id: example
extends_roles: [development, general]
provides:
  capabilities: []
installation:
  hosts: all
  role_vendor:
    name: example-role
    source: https://github.com/moluoxixi/AIRules.git
    projections:
      - kind: role-assets
        source_dir: roles/example
```

安装器按父角色声明顺序进行深度优先遍历，先处理祖先，再处理自身。上例中 `development` 已继承 `general`，最终顺序仍是 `general → development → example`；同一祖先与 capability 只处理一次。父角色顺序不会产生隐式覆盖。

`general` 提供记忆、skill 编写与文档整理；`development` 继承 `general`，集中维护 `coding`、`productivity` 与 `frontend`。具体开发角色统一继承 `development` 的基础 skills 与 MCP，再选择自己的工程工作流。`engineering` 由 Matt 角色单独选择。两个基础角色也可独立安装。

纯模板只需声明 `schema_version`、`role_id`、`extends_roles` 和 `provides.capabilities`。安装共享能力的具体角色必须提供自己的 `installation.role_vendor`，使第一方能力从该角色的 AIRules 远程 checkout 投影到 vendor；父模板的私有 skills、MCP、hooks、agents 和 packages 不会随继承安装。

重复与冲突按以下规则处理：

- 同一供应商必须使用相同仓库、revision 和有效 setup；兼容的投影可以合并。
- 同名 skill 只有供应商、来源、revision、源码路径、输出目标和有效 setup 全部相同时才去重。namespace 与显式 skill 选择的重叠也会校验；不同来源的同名 skill 直接报错。
- 同名 MCP 只有完整连接配置和有效 setup 相同时才去重。JSON 对象字段顺序不影响比较，`args`、`env`、URL、headers 或 setup 的差异都会报错。
- 相同 setup 命令组只执行一次；组内命令顺序与有意重复的命令保留。
- 缺失父角色、循环继承、重复填写父角色、单份声明中的重复 capability，以及供应商或文件目标的大小写冲突都会报错。冲突信息包含角色继承路径与能力来源。

安装器在执行 setup 前校验来源、内容和受管目标目录，再提交暂存结果。校验或 setup 失败时保留上一版受管资产；提交失败时尝试恢复旧内容，恢复失败会保留备份并报告错误。不同名称的 skills 仍可能在语义上重复，安装器无法判断这类冲突；外部 setup 命令造成的环境变化也不能自动回滚。

`schema_version: 1`、未声明版本的旧 YAML 和旧 `extendsRoles` 模块继续兼容单继承。迁移到 v2 时，将顶层 `capabilities` 移入 `provides`，将安装字段移入 `installation`。`grilling` skill 仍归属 `productivity`，没有独立的 grilling 分类。

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

## 安装验证

先执行 `npm run build`。`npm test` 中的 `role-install.e2e.test.mjs` 从空 AIRules home 开始，通过临时 `git://` 远端实际下载供应商，保留完整菱形继承声明，并执行真实 CLI 与 npm setup。用例覆盖重复 skills、MCP 和 setup 去重、父角色私有资产隔离、重复安装、冲突拒绝，以及 setup 失败后保留旧资产和宿主配置。宿主包含 Claude、Codex 和 OpenCode；用户目录、Git 配置与 npm prefix 均隔离。

`npm run verify:packed-airules` 把 npm tarball 安装到独立消费项目，再用打包后的 CLI 执行同一组安装用例。CI 在 Linux、Windows 和 macOS 上运行这些检查。

`npm run verify:remote-role-install` 从真实 GitHub 上游下载当前 AIRules commit 与 capability 固定的供应商 commit，安装 `common`、`productivity` 和 `frontend` 的菱形组合，比较 skills 与可视化资源内容，并校验三种宿主的 MCP 配置。该检查需要联网，由 Linux CI 执行；它验证安装与配置，不启动 MCP 服务或调用模型。
