# Development

`development` 是开发通用模板，继承 [`general`](../general/README.md) 的记忆、skill 编写和文档整理能力，再提供效率 skills、代码工具和前端能力。

```text
general
└── development
    ├── matt
    ├── moluoxixi
    └── trellis
```

## 共享能力

| Capability | 提供的能力 |
|---|---|
| `common`，继承自 `general` | `create-skill`、`spec-organization`、`hindsight-memory`、`hindsight-docs`，以及 Hindsight 记忆 MCP 和可视化部署资产 |
| `coding` | CodeGraph、Context7、Sequential Thinking MCP |
| `productivity` | Matt Pocock 的效率 skills：`grilling`、`grill-me`、`handoff`、`teach`、`to-questionnaire`、`wait-what`、`writing-for-agents` 等 |
| `frontend` | Anthropic `frontend-design` skill 和 Playwright MCP |

共享能力只在 [`role.yaml`](role.yaml) 中选择；供应商、固定 commit 和远程投影统一维护在 [`capabilities/`](../../capabilities/README.md)。新增共享开发能力时更新本模板，所有子角色会随之获得。

三个子角色获得相同的基础 skills 和 MCP。`matt` 单独选择 `engineering`，提供 `ask-matt`、`tdd`、`code-review`、`diagnosing-bugs`、`to-spec`、`to-tickets` 等 Matt 工程工作流；`moluoxixi` 提供自身 CLI、项目工作流、hooks、agents 与知识库初始化；`trellis` 提供原生 Trellis CLI 与项目工作流初始化。工程工作流由各角色选择，基础模板集中维护共享工具。角色专属资产由子角色的 `installation.role_vendor` 全量远程同步，CLI 和 packages 由子角色自己声明。

## 继承模板

新增开发角色只需声明父模板和自身专属配置：

```yaml
# roles/<role>/role.yaml 的声明部分
schema_version: 2
role_id: example
extends_roles: [development]
provides:
  capabilities: []
```

如需附加共享能力，在自身 `provides.capabilities` 中追加。v2 支持多层与多父角色继承，例如 `extends_roles: [development, general]`；`general` 已经是 `development` 的祖先，仍只处理一次。重复能力和完全相同的 skill、MCP 声明自动去重，配置不一致时直接报错。父模板的私有资产、`role_vendor`、CLI、packages 和 hosts 不会随继承安装；这些设置放在子角色自己的 `installation` 中。完整规则与风险边界见 [角色继承](../../capabilities/README.md#角色继承)。

## 独立使用

模板也可独立安装，直接获得共享开发 skills 和 MCP：

```bash
npm install --global moluoxixi-ai-rules
airules install development --host all
airules verify development --host all
```

安装共享 MCP 时会执行其前置工具 setup。`development` 没有专属项目 CLI，也无需 `init-project`。需要项目工作流时安装相应子角色。

Hindsight MCP 默认连接 `http://localhost:8888/mcp/`，记忆控制台默认位于 `http://localhost:9999`。实际使用记忆前按[记忆可视化部署说明](../../capabilities/common/skills/hindsight-memory/references/visualization.md)启动服务并配置模型。
