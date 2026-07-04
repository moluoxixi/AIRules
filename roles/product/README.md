# product role

产品角色只维护产品侧第一方 `init-project`，用于初始化 OpenSpec 与 `product-pm-bridge` schema。PM / 产品方法论 skills 来自 `pmSkills` 上游 vendor。角色清单见：

- `roles/product/constants/skills.ts`

当前只建立 product `init-project` skill；rules、mcp、hooks、agents 暂未按产品角色拆分。

同步 product 角色时会默认叠加 `roles/common/`，因此仍包含公共的会话索引 hook 与手动会话沉淀 / 提炼 / 记忆能力。
