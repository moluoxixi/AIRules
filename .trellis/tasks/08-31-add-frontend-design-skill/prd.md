# 建立角色能力配置与初始化治理

## 目标

建立公共 capability 配置层，让每个 AIRules 角色只声明自己支持的能力，由能力定义统一拼装对应的 skills 与 MCP；同时增强 Trellis/Moluoxixi 的 `init-project`，把首次初始化产生的通用 spec 和 bootstrap task 整理成有项目事实支撑的资产，避免无用模板长期污染项目。

## 背景与已确认事实

- 当前角色在各自 `roles/<role>/constants/skills.ts` 中直接维护完整 `VendorRepo[]`，共享 skills、第三方 skills 和 MCP 都是硬编码 projection。
- `VendorRepo` 已同时支持 `namespace`、精确 `skills`、`mcp` 和 `role-assets` projection；`loadVendorManifest()` 也能合并同名且来源、revision 一致的 vendor，但当前没有命名 capability、角色能力声明或组合校验。
- AIRules 安装数据面已经能从规范化 vendor manifest 汇总 skills 与 MCP，因此能力层应在角色清单生成阶段完成组合，不需要另建一套安装协议。
- 当前 `mcps/code/mcps.json` 同时包含 `codegraph`、`context7`、`sequential-thinking` 和偏前端/UI 验证的 `playwright`。
- Anthropic 官方 `frontend-design` 位于 `https://github.com/anthropics/skills.git` 的 `skills/frontend-design/`；规划时固定 commit 为 `3b3fad96af16a10759d930941b4520ba0c40edae`。
- Trellis/Moluoxixi 的 `markdown/spec` 不是纯展示示例，而是初始化时写入项目的通用 spec 脚手架。会话和开发流程先发现其 index，再由 before-dev、任务 JSONL 或子代理上下文按需读取具体文件；它们能约束 AI，但不是可执行校验，也不是基于目标项目代码生成的事实规范，未经项目化维护时价值有限。
- 官方 init 会在 fresh project 创建 `00-bootstrap-guidelines`，其目标本来就是把通用模板改造成真实项目规范并在完成后归档；当前 AIRules `init-project` 只运行 init、安装知识扩展和本地化 Trellis bootstrap task，没有把 spec 整理与 task 收尾纳入自身完成条件。
- Trellis wrapper 已能证明 bootstrap task 是否在本次 init 前存在；Moluoxixi wrapper 尚未暴露同等 fresh-init 状态。

## 范围内

- 定义类型安全、顺序确定的公共 capability registry 和组合函数。
- 允许 capability 同时贡献 AIRules 自有 projection 与第三方 vendor projection，从而共同拼装 skills 和 MCP。
- 角色显式导出支持的 capability 名称，并从公共配置生成最终 `vendors`。
- 定义 `frontend` capability：精确投影固定版本的 Anthropic `frontend-design`，并根据最终决策绑定前端 MCP。
- `trellis` 与 `moluoxixi` 启用 `frontend`；其它角色显式声明自己的能力集合，不因本任务意外获得前端能力。
- 对未知能力、重复能力、vendor 定义不一致、重复 skill 目标和 MCP 冲突保持确定性失败。
- 更新组织文档、公共组合测试、各角色契约测试、安装/验证覆盖，并完成本机 canonical skills 安装验证。
- 在两个 `init-project` 中增加 bootstrap hygiene 分支：复用各自原生 `*-spec-bootstrap` 进行项目事实分析，删除不适用模板，维护 index，并在规范有效后结束和归档本次新建的 bootstrap task。
- wrapper 只报告 fresh-init、bootstrap task 创建/本地化等确定性状态；是否保留、改写或删除 spec 由 agent 按项目证据执行。
- 已存在或已自定义的 spec/task 默认只审计和报告，不由 re-init 自动删除。

## 范围外

- 不修改 Anthropic 的 `frontend-design` 正文。
- 不修改 Trellis/Moluoxixi 上游 CLI 的 spec 模板源码或 task 创建协议。
- 不修改 `roles/moluoxixi/.sync`、`.sync/rebuild` 或 `roles/moluoxixi/packages`。
- 不把 role-owned `init-project`、CLI package、hooks、agents 或项目初始化资产改造成 capability。
- 不处理许可证文件或建立许可证证明材料。

## 要求

- capability 必须是公共单一事实源；角色不能重复写 capability 所属的 skill/MCP projection。
- 角色配置必须可读地表达“支持哪些能力”，而不是只导出已展开且无法追溯来源的 vendor 数组。
- 组合结果继续使用现有 `VendorRepo[]`/`VendorManifest` 协议，安装器和宿主投影无需理解 capability。
- 组合顺序、去重和冲突行为必须有测试，不能依赖对象遍历或 import 顺序的偶然结果。
- `frontend-design` 必须固定完整 commit SHA，只安装目标 skill，不能扫描 Anthropic 仓库的其它 skills。
- 本机只在 canonical `~/.agents/skills/frontend-design` 暴露一份，不在 `~/.codex/skills` 建立重复副本。
- 角色专属断言留在 `roles/<role>/__test__/`；纯 capability 组合行为放在公共测试目录。
- `init-project` 只有在确认 workflow 根或 bootstrap task 是本次 fresh init 新建时，才可自动整理这些生成物；re-init 不得把既有项目内容视作模板垃圾。
- spec 整理必须复用原生 `trellis-spec-bootstrap` / `moluoxixi-spec-bootstrap` 的项目分析契约，不在两个 init skill 中复制规范写作手册。
- 完成 init-project 时不得遗留仍为通用模板的 spec，也不得遗留无下一步意义的 active bootstrap task。
- 初始化整理期间归档 task 必须避免隐式提交用户工作区；是否提交仍由用户明确决定。

## 已确认决策

- capability 层统一接管现有共享 skills/MCP；role-owned 初始化器、packages、hooks 和 agents 保持直接配置。
- `playwright` 从 coding MCP catalog 拆到 frontend MCP catalog，`frontend` 由 `frontend-design` 与 `playwright` 组成。
- 角色矩阵：Trellis/Moluoxixi 使用 `common`、`coding`、`productivity`、`frontend`；Matt 使用 `engineering`、`productivity`。
- fresh project 没有足够代码或约定支撑真实 spec 时，删除本次 init 新建且仍未修改的通用 spec 与 `00-bootstrap-guidelines`；报告清理结果，并提示项目具备事实依据后显式运行 spec-bootstrap。

## 验收标准

- [x] 公共 registry 能由 capability 名称稳定生成现有 vendor manifest 协议，并覆盖组合、去重和冲突测试。
- [x] 每个角色显式声明自己的 capability 集合，且角色测试验证声明与展开结果一致。
- [x] `trellis` 与 `moluoxixi` 的展开结果包含固定 revision 的 `frontend-design` 和最终确认的前端 MCP。
- [x] 未声明 `frontend` 的角色不会获得 `frontend-design` 或前端 MCP。
- [x] fresh init 的非空项目会按 init skill 契约生成基于真实代码的 spec，相关 bootstrap task 以 `--no-commit` 方式归档。
- [x] re-init 或已自定义 bootstrap task/spec 不会被自动删除或覆盖。
- [x] 无证据可整理的 fresh project 按 init skill 契约删除本次 init 新建且仍未修改的通用 spec 与 bootstrap task。
- [x] 相关公共测试、三个角色测试、typecheck、lint、构建和打包验证通过。
- [x] 本机 canonical `frontend-design` 可解析、可被 Codex 发现，且没有 `.codex/skills` 重复安装。

## 风险与回滚

- capability 展开若改变 projection 顺序或 vendor 名称，可能影响本机 checkout 路径、setup 顺序和测试快照；设计应保持现有 vendor identity 与可观察安装顺序。
- MCP 拆分必须保证声明 frontend 的现有角色安装后仍得到 Playwright，同时未声明 frontend 的角色不会残留由 AIRules 管理的旧 Playwright 配置。
- 回滚应能恢复角色原始直接 vendor 数组和原 MCP catalog，不触碰角色包或 Moluoxixi 外部基线。
