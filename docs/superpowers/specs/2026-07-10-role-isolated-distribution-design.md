# AIRules 角色隔离分发内核设计

## 目标

AIRules 退回为纯分发工具。系统只负责把指定角色的 `skills`、`rules`、`hooks`、`mcp` 四类资产投影到不同 AI 宿主，不再内置或解释任何研发角色能力。

角色仅是资产分组标识，不具备继承、组合、默认能力、工作流、初始化逻辑或治理语义。

## 非目标

- 不内置任何角色或角色资产。
- 不保留 `common`、`extendsRoles`、overlay 或跨角色共享。
- 不分发 agents。
- 不负责拉取、安装或同步第三方 vendor 仓库。
- 不负责 OpenSpec、Spec Kit、ECC、Trellis、CodeGraph、知识库、候选审核或项目初始化。
- 不提供角色创建向导；角色资产由使用者直接维护或通过 `airules add` 写入。

## 资产模型

仓库只包含分发引擎，不包含 `roles/` 目录。用户资产位于分发 home：

```text
~/.moluoxixi/
└── roles/
    └── <role>/
        ├── skills/
        │   └── <skill>/SKILL.md
        ├── rules/
        │   └── AGENTS.md
        ├── hooks/
        │   └── <hook-script>
        └── mcp/
            └── mcp.json
```

约束：

1. `--role <name>` 必填，角色名必须是安全的单路径标识符。
2. `~/.moluoxixi/roles/<role>` 必须存在，否则显式失败。
3. 四类资产目录均可缺省；缺省表示该角色不分发该类资产。
4. 角色只能读取自身目录，禁止访问父目录、其他角色或符号链接逃逸目标。
5. `rules` 使用中性源 `AGENTS.md`，由宿主映射决定目标基线文件。
6. `mcp/mcp.json` 使用中性 `{ "mcpServers": {} }` 结构。
7. `hooks` 只允许投影宿主配置中显式声明的脚本名。
8. `skills` 只接受直接子目录中的有效 `SKILL.md`。

## 核心模块

### Role Source

单一接口根据 `home + role` 返回四类资产路径并完成角色名、真实路径和目录逃逸校验。该模块不加载角色代码，不执行 manifest，不解析能力或继承关系。

### Host Projection

宿主定义只保留四类分发信息：

- skills 目标目录与排除项；
- rules 基线文件、覆盖或受管块模式；
- MCP 文件格式、服务键和宿主字段映射；
- hook 文件格式、事件名、脚本名和受管块格式。

删除 agent 格式、agent 转译和 agent 目录投影。

### Projection State

每个宿主在 `~/.moluoxixi/state/projections/<host>.json` 维护一份 AIRules 受管投影状态，记录当前角色、skills 链接、rules 目标、MCP 服务和 hook 受管项。

切换角色时：

1. 读取上一份受管状态；
2. 仅删除仍指向 AIRules 受管源或仍匹配受管内容的旧投影；
3. 保留用户手工修改或非 AIRules 管理的内容；
4. 投影新角色资产；
5. 原子写入新状态。

状态写入失败必须使同步失败，不得报告成功。

## CLI

```text
airules sync --role <name> [--host <name|all>] [--home <dir>] [--user-home <dir>] [--no-verify]
airules add <skill-dir> --role <name> [--name <skill-name>] [--home <dir>] [--overwrite] [--skip-sync]
airules verify --role <name> [--host <name|all>] [--home <dir>] [--user-home <dir>]
```

删除以下接口：

- 默认角色；
- `--skip-vendors`、`--sync-vendors` 和所有 vendor 同步命令；
- 角色别名 npm scripts；
- 所有角色专用输出和官方安装状态。

## 数据流

```text
CLI role + home
→ Role Source 边界校验
→ 加载单角色四类资产
→ 读取宿主映射与上一份受管状态
→ 清理上一角色的受管投影
→ 投影 skills / rules / hooks / mcp
→ 写入新受管状态
→ verify 对照源资产、目标资产与状态
```

## 错误处理

- 缺失 `--role`、非法角色名或角色目录不存在：命令失败。
- 非法 `SKILL.md`、MCP JSON、规则源、hook 脚本或符号链接逃逸：同步前失败。
- 宿主不支持某类资产：结果中显式记录为 `N/A`，不投影该类资产；不得静默遗漏，也不得阻断该宿主支持的其他资产。
- 配置合并、文件写入、链接创建、旧投影清理或状态提交失败：命令失败。
- 不使用默认角色、空配置、警告后继续或旧角色残留来伪装成功。

## 删除范围

- 删除仓库中的 `roles/**`。
- 删除 `scripts/lib/roles.ts` 和所有角色继承逻辑。
- 删除 vendor 获取、锁定、同步与 setup 实现及其测试。
- 删除 agent 投影、格式转换与验证实现及其测试。
- 删除项目初始化、知识、候选审核和场景覆盖等非分发脚本与 package scripts。
- README 仅描述四类资产、角色隔离、支持宿主与 CLI。

仓库维护规则、测试基础设施、宿主映射、构建、lint、Git hooks 和发布配置保留。

## 测试策略

### Role Source

- 缺失角色、非法角色名、路径逃逸和符号链接逃逸必须失败。
- 四类目录缺省时返回空资产集。

### 资产投影

- skills、rules、hooks、MCP 分别覆盖支持、缺失、非法输入和宿主不支持场景。
- 所有目标只能写入已选宿主目录。

### 角色隔离

- 角色 A 同步后不得出现角色 B 的任何资产。
- A → B 切换必须删除 A 的受管投影并保留用户内容。
- 同一角色重复同步必须幂等。

### CLI 与发布

- `sync/add/verify` 均强制 `--role`。
- package 不包含内置 `roles/`、vendor 或 agent 能力。
- 全仓库测试、typecheck、lint、临时 staging 构建与 pack 必须通过。

## 完成标准

1. 仓库中不存在内置角色和 `common` 语义。
2. 运行时代码中不存在角色继承、overlay、agent 或 vendor 获取逻辑。
3. 四类资产可按指定角色独立投影并验证。
4. 双角色切换测试证明无资产串流和旧投影残留。
5. CLI、README、package 与测试只暴露纯分发能力。
