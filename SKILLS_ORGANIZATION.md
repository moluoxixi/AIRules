# Skills Organization

共享 skills 的源码统一放在 `capabilities/<能力>/skills/`，角色专属 skills 放在 `roles/<role>/skills/`。完整能力目录、供应商声明与 MCP 清单格式见 [capabilities/README.md](capabilities/README.md)。

```text
capabilities/common/skills/
├── create-skill/
├── hindsight-memory/
└── spec-organization/

roles/<role>/skills/
└── init-project/
```

每个 skill 必须包含带 `name` 和 `description` frontmatter 的 `SKILL.md`；`scripts/`、`references/`、`assets/` 等资源按需添加。新建或修订 skill 时使用 [create-skill](capabilities/common/skills/create-skill/SKILL.md) 指南。

角色在 `role.yaml` 中选择能力。共享 skill 的 `namespace` 投影由对应能力的 `capability.yaml` 声明，递归发现包含 `SKILL.md` 的目录；已有投影会自动包含新增 skill。第三方 skills 通过能力声明中的固定上游 commit 远程同步，角色无需重复维护供应商配置。

安装后的 skill 按名称展平到 `vendor/skills/<skill>/`，再投影到用户的 `~/.agents/skills/` 和宿主目录。共享源码来自 AIRules 的远程 checkout，保持与角色资产相同的远程分发机制。

共享资产的修改需兼顾所有选择该能力的角色。公共投影测试放在 `scripts/lib/__test__/`，角色专属测试放在 `roles/<role>/__test__/`。
