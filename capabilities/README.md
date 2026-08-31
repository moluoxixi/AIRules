# Role Capabilities

角色通过 `roles/<role>/constants/skills.ts` 声明 capability，公共 registry 再组合对应的 skills 与 MCP，最终仍输出安装器使用的 `VendorRepo[]`。

| Capability | Skills | MCP |
|---|---|---|
| `common` | AIRules `create-skill`、`spec-organization` | 无 |
| `coding` | 无 | CodeGraph、Context7、Sequential Thinking |
| `frontend` | Anthropic `frontend-design` | Playwright |
| `productivity` | Matt Pocock productivity skills | 无 |
| `engineering` | Matt Pocock engineering skills | 无 |

当前角色矩阵：

| Role | Capabilities |
|---|---|
| `trellis` | `common`, `coding`, `productivity`, `frontend` |
| `moluoxixi` | `common`, `coding`, `productivity`, `frontend` |
| `matt` | `engineering`, `productivity` |

角色自有 CLI、`init-project`、hooks、agents、packages 与 `role-assets` 不属于 capability，由角色清单直接维护。
