# AIRules 角色路径与远程多资产分发设计

## 目标

AIRules 作为远程资产分发工具，根据必填 `--role <name>` 选择一套角色路径，把远程仓库中的 `skills`、`agents`、`rules`、`hooks`、`mcp` 资产汇聚到统一 staging，再按宿主格式投影。

角色只决定路径，不具备继承、组合、默认能力、工作流或治理语义。AIRules 自身仓库以 vendor `moluoxixi` 参与远程分发，并全量复制所选 `roles/<role>/` 下的可分发资产。

## 非目标

- 不保留 `common` 继承、`extendsRoles`、overlay 或隐式跨角色共享。
- 不提供默认角色；`sync`、`add`、`verify` 均强制指定 role。
- 不存在 workspace/local vendor、本地 assets 层、repoRoot 直读或远程失败后的本地 fallback。
- 不把 vendor 仓库中的 Prompt、规则或脚本作为 AIRules 运行时代码执行。
- 不从目录结构猜测远程资产语义；除 `moluoxixi` 的显式 `role-assets` 外，远程资产必须由 projection 声明。
- 不允许远程路径、角色路径或符号链接逃逸各自仓库根。

## 角色模型

仓库保留 tracked `roles/`：

```text
roles/
└── <role>/
    ├── constants/skills.ts
    ├── skills/
    ├── agents/
    ├── rules/AGENTS.md
    ├── hooks/
    └── mcp/mcp.json
```

约束：

1. role 名是安全的单路径标识符。
2. `roles/<role>` 与 `roles/<role>/constants/skills.ts` 必须存在。
3. 每个 role 的 vendor 配置独立完整，不加载其它 role 的 constants。
4. 角色资产目录可缺省；缺省表示没有该类第一方资产。
5. `rules` 使用中性 `AGENTS.md`；`mcp` 使用中性 `{ "mcpServers": {} }`。

## 远程 Vendor Projection

`VendorProjection` 支持：

- `skills`：从 `sourceBaseDir` 精确选择 skill，展平到 `vendor/skills/<name>`。
- `namespace`：把目录中的叶子 skills 展平到 `vendor/skills/`。
- `agents`：精确选择或完整转发 agent 目录到 `vendor/agents/`。
- `rules`：把一个中性规则文件转发到 `vendor/AGENTS.md`。
- `hooks`：精确选择或完整转发 hook 目录到 `vendor/hooks/`。
- `mcp`：把中性 MCP 文件转发到 `vendor/mcp/mcp.json`。
- `role-assets`：从一个角色根目录全量复制所有已识别资产类。

普通远程 vendor 使用显式 projection。`moluoxixi` 在每个 role 的 constants 中声明：

```ts
{
  name: 'moluoxixi',
  source: 'https://github.com/moluoxixi/AIRules.git',
  projections: [
    { kind: 'role-assets', sourceDir: 'roles/<role>' },
  ],
}
```

所有 vendor 均使用 Git remote checkout。当前仓库在分发模型中的 vendor ID 是 `moluoxixi`；运行时不得直接读取当前 repoRoot 作为资产源，也不得保留 `sourceMode: 'workspace'`。

## moluoxixi 全量复制

`role-assets` 只识别并全量复制所选角色中的分发资产：

```text
roles/<role>/skills/*       -> vendor/skills/*
roles/<role>/agents/*       -> vendor/agents/*
roles/<role>/rules/AGENTS.md -> vendor/AGENTS.md
roles/<role>/hooks/*        -> vendor/hooks/*
roles/<role>/mcp/mcp.json   -> vendor/mcp/mcp.json
```

`constants/`、README、测试与 skill 内部 assets/scripts 属于配置或 skill 自身内容：skill 目录被复制时其内部内容完整保留，但它们不单独成为顶层分发资产。

`moluoxixi` role-assets 在 staging 合并顺序中最后执行，用作所选角色的一方覆盖层。覆盖仅发生在本次同步创建的临时 staging 内，不覆盖用户宿主内容。

## Staging 与冲突

每次同步在系统临时目录构建完整 staging，通过验证后原子替换 `<home>/vendor` 的受管内容。禁止在构建失败时保留半成品或报告成功。

冲突规则：

1. 普通 vendor 之间目标路径冲突时显式失败。
2. `moluoxixi` role-assets 可覆盖普通 vendor 的同名受管目标。
3. 同一 role-assets 内大小写不敏感重名、非法 skill、非法 agent/hook 文件或中性配置损坏时失败。
4. staging 不读取或合并用户宿主目录；用户内容保护由 Host Projection 与 Projection State 负责。

## Host Projection

宿主定义保留五类信息：

- skills 目标目录与排除项；
- agent 格式、目标目录与必要转译；
- rules 基线文件及覆盖/受管块模式；
- MCP 文件格式、服务键与字段映射；
- hook 文件格式、事件名、脚本名与受管块格式。

宿主不支持某类 staging 资产时结果显式记录 `N/A`，不阻断其它支持资产。Agents 继续按宿主格式直接链接或转译，不得静默跳过已声明且可验证的输入。

## Projection State

每个宿主在 `<home>/state/projections/<host>.json` 记录当前 role、vendor staging 版本和五类受管目标。

切换角色时：

1. 完整构建并验证新 staging；
2. 读取旧宿主状态；
3. 仅清理仍匹配旧 source/hash/受管块的目标；
4. 保留用户替换或修改的内容，并将冲突显式失败；
5. 投影新 staging；
6. 原子写入新状态。

状态写入失败必须使同步失败。

## CLI

```text
airules sync --role <name> [--host <name|all>] [--home <dir>] [--user-home <dir>] [--no-verify]
airules add <skill-dir> --role <name> [--name <skill-name>] [--home <dir>] [--overwrite] [--skip-sync]
airules verify --role <name> [--host <name|all>] [--home <dir>] [--user-home <dir>]
```

`add` 是仓库维护命令，写入当前 checkout 的 `roles/<role>/skills/<skill-name>`，产物必须提交并推送后才会成为远程分发源。`sync` 始终重新对照 remote checkout，不直接消费尚未推送的本地 add 结果。Vendor 获取是 `sync` 的必经阶段，不提供跳过 vendor 后伪装完整同步的路径。

## 数据流

```text
CLI role + home
-> 加载 roles/<role>/constants/skills.ts
-> 获取/更新远程 vendor checkout
-> 展开普通 vendor projections
-> 全量展开 moluoxixi roles/<role> role-assets
-> 临时构建并验证 vendor staging
-> 原子提交 staging
-> 读取宿主映射与旧 Projection State
-> 清理旧 role 的未修改受管投影
-> 投影 skills / agents / rules / hooks / mcp
-> 原子提交新 Projection State
-> verify 对照 role manifest、staging、宿主目标与状态
```

## 错误处理

- 缺失 role、非法 role、角色目录或 constants 缺失：失败。
- vendor 获取失败、revision 不可解析或远程路径缺失：失败。
- 配置声明 workspace/local source、repoRoot source 或本地 fallback：失败。
- 非法 `SKILL.md`、agent、rules、hook、MCP JSON 或符号链接逃逸：宿主写入前失败。
- 普通 vendor staging 冲突：失败；不得按遍历顺序静默覆盖。
- staging 构建、原子替换、宿主合并、链接/复制、旧投影清理或状态提交失败：失败。
- 不使用默认角色、旧缓存、警告后继续或部分 staging 伪装成功。

## 测试策略

### Vendor 类型

- `skills`、`namespace`、`agents`、`rules`、`hooks`、`mcp` 分别覆盖精确、全目录、缺失和逃逸输入。
- 远程 vendor 的 hooks/agents/rules 可进入 canonical staging。
- 普通 vendor 冲突失败，moluoxixi role-assets 一方覆盖成功。

### Role Path

- role A 仅加载 `roles/A/constants/skills.ts` 与 `roles/A` 资产。
- A/B 使用不同 source path，无继承、overlay 或 common 注入。
- moluoxixi 全量复制所选 role 的五类已存在资产，缺省类不生成空伪资产。

### 宿主与切换

- 五类 staging 资产分别覆盖支持与 `N/A` 宿主。
- A -> B 删除 A 的未修改受管投影并保留用户内容。
- 同一 role 重复同步幂等。

### CLI 与发布

- `sync/add/verify` 强制 role。
- package 保留 roles、远程 vendor 与 agents 能力，不暴露默认角色或 overlay。
- 全仓库测试、typecheck、lint、临时 staging build 与 pack 通过。

## 完成标准

1. 远程 vendor 可转发 skills、agents、rules、hooks、mcp。
2. moluoxixi 全量复制所选 `roles/<role>` 的所有可分发资产。
3. role 只决定路径，运行时代码不存在继承、overlay 或默认角色。
4. 所有运行时资产均来自 remote checkout；代码中不存在 workspace/local source 分支。
5. canonical staging 与宿主投影均可验证，失败不提交半成品。
6. 双角色切换证明无跨角色资产串流且保留用户内容。
