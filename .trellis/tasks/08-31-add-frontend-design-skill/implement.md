# 实施计划

## 1. 公共 capability 层

- [x] 盘点现有 `VendorRepo`、vendor manifest 合并与角色投影契约，确认可复用边界。
- [x] 新建类型安全的 capability 定义、registry 和纯组合函数，保持输出为现有 `VendorRepo[]`。
- [x] 实现稳定顺序、输入不可变、未知/重复 capability 拒绝，以及 vendor、skill 目标和 MCP 冲突校验。
- [x] 为 `common`、`coding`、`frontend`、`productivity`、`engineering` 建立单一配置源。

## 2. MCP 与角色迁移

- [x] 将 Playwright 从 `mcps/code/mcps.json` 移到 `mcps/frontend/mcps.json`。
- [x] 在 `frontend` capability 中固定 Anthropic repo、commit 和 `skills/frontend-design` 精确投影。
- [x] 迁移 Trellis、Moluoxixi、Matt 的角色清单，使其显式声明 capability，同时保留 role-owned vendor 与现有安装协议。
- [x] 更新构建包含路径和架构文档，删除已被 capability 接管的重复共享配置。

## 3. Init-project bootstrap hygiene

- [x] 扩展 Trellis wrapper 的 fresh-init 状态输出，保持脚本只报告可证明事实。
- [x] 为 Moluoxixi wrapper 增加等价的 bootstrap task 预存在检测与默认内容指纹保护，不修改外部基线或导出 packages。
- [x] 更新两个 `init-project` skill：fresh init 有真实证据时调用原生 spec-bootstrap，并以 `task.py archive --no-commit` 收尾。
- [x] 更新两个 `init-project` skill：fresh init 无真实证据时只删除本次创建且仍为默认内容的通用 spec/task；re-init 或已修改内容只审计报告。
- [x] 保持规范写作规则由原生 `*-spec-bootstrap` 单一维护，init skill 只承担分支编排和完成标准。

## 4. 测试与 Review 门禁

- [x] 公共测试覆盖组合顺序、去重、冲突、未知能力和输入不可变。
- [x] `roles/<role>/__test__/` 覆盖三个角色的声明、展开结果、MCP 归属和固定 revision。
- [x] Trellis/Moluoxixi 角色测试覆盖 fresh、pre-existing、customized 状态以及无证据清理和 `--no-commit` 契约。
- [x] 运行相关定向测试、typecheck、lint、build、pack，并执行 `git diff --check`。
- [x] 使用 skill validator 检查变更后的 skill，人工复核描述触发条件、分支边界和单一事实源。

## 5. 本机安装验证

- [x] 通过 pack verifier 导入 Trellis/Moluoxixi 编译清单，验证两者的新 capability 资产可发布。
- [x] 安装并验证 canonical `~/.agents/skills/frontend-design/SKILL.md` 来自固定 commit 且可发现。
- [x] 验证 `~/.codex/skills/frontend-design` 不存在重复副本，角色 MCP 投影符合声明矩阵。

## 回滚点

- capability 迁移可恢复为三个角色原有的直接 `VendorRepo[]`，同时合并回原 `mcps/code/mcps.json`。
- init hygiene 仅改 AIRules wrapper 与 role-owned skill；回滚不触碰 Moluoxixi `.sync`、`.sync/rebuild` 或 `packages`。
- 本机验证失败时停止安装收尾并报告，不覆盖非 AIRules 管理的既有 skill 或 MCP 配置。
