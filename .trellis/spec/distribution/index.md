# Distribution Specifications

本层描述 AIRules 角色分发配置、vendor 投影和宿主安装之间的可执行契约，适用于 `capabilities/`、`roles/*/constants/`、`mcps/` 与 `scripts/lib/vendor*`。

## Pre-Development Checklist

- 修改角色 skills/MCP 组成前，读取 [Role Capability Contract](role-capabilities.md)。
- 搜索所有角色的 `capabilities` 声明和同一 vendor/projection 目标。
- 确认变更属于公共 capability 还是 role-owned 资产。

## Quality Check

- capability composer 的顺序、输入不可变、去重和失败行为有公共测试。
- 角色声明与展开结果在 `roles/<role>/__test__/` 中验证。
- 新增外部 skill 固定完整 commit SHA，并由 pack verifier 验证编译后清单可导入。
- MCP server 名称冲突继续由 vendor staging 检查。

## Specifications

- [Role Capability Contract](role-capabilities.md)
