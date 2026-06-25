# Proposal: Remove Static Skill Index

## 目标

移除 `rules/AGENTS.md` 中由 `AIRULES:SKILL-INDEX` 标记包裹的静态 skill 触发索引，并删除生成 / 安装期自动注入该索引的代码路径。Qoder 已能正常读取 skills，不再需要把 skill 触发条件复制进 baseline。

同时引入 AIRules 自身的 L2 变更包契约，用于记录此类 rules / skills / 初始化 / 分发配置变更的意图、层级 delta、设计、任务与验证证据。

## 范围

- 移除 baseline 静态 skill 索引生成链路。
- 更新 `rules/AGENTS.md` 生成产物。
- 新增 `docs/changes/` 与 `docs/delivery/change-pack.md`。
- 新增变更包结构校验脚本，并接入 L2 聚合校验。
- 更新相关测试。

## 非目标

- 不改变 skills 的投影、链接或宿主目录结构。
- 不引入 OpenSpec CLI 默认安装。
- 不把变更包契约注入下游项目 `AGENTS.md`。

## 变更分级

L2。原因：本次修改影响 `rules/AGENTS.md` 生成链路、安装期宿主 baseline 内容、交付门禁和 repo-maintenance 文档契约。

## 影响层级

- `repo-maintenance`：新增变更包契约、校验脚本、测试和本次变更包。
- `global-baseline`：移除 `rules/AGENTS.md` 中的静态 skill 触发索引。
- `project-init`：N/A，不修改 `skills/init-project/references/**`。
- `generated-project`：N/A，不修改用户项目生成产物。

## 风险 / MISSING

- 风险：旧宿主如果仍依赖 baseline 内索引，可能看不到 skill 触发条件；用户已确认 Qoder 可正常读取 skills，风险可接受。
- MISSING：无。
