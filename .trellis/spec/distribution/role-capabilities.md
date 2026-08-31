# Role Capability Contract

## 1. Scope / Trigger

修改 `capabilities/`、角色 `constants/skills.ts`、共享 MCP catalog，或把可复用 skill/MCP 分配给角色时，必须遵循本契约。角色自有 CLI、`init-project`、hooks、agents、packages 和 `role-assets` 不进入 capability registry。

## 2. Signatures

公共入口：

```typescript
type CapabilityName = 'common' | 'coding' | 'frontend' | 'productivity' | 'engineering'

function composeCapabilities(
  capabilities: readonly CapabilityName[],
  options: {
    roleVendor: VendorRepo
    roleVendorPosition?: 'before' | 'after'
  },
): VendorRepo[]
```

角色清单必须同时导出声明与兼容输出：

```typescript
export const capabilities = ['common', 'coding'] as const satisfies readonly CapabilityName[]
export const vendors: VendorRepo[] = composeCapabilities(capabilities, { roleVendor })
```

## 3. Contracts

- `capabilities` 数组顺序决定 vendor 首次出现和 role projection 追加顺序。
- composer 是纯配置变换：不读取文件系统、不执行 setup、不修改输入，输出继续使用 `VendorRepo[]`。
- capability 的 AIRules 自有 projection 追加到角色的 AIRules vendor；第三方来源保持独立 vendor，并按 `name` 合并兼容 projection。
- 同名 vendor 只有 `source`、`revision` 和 `setup` 完全一致时才能合并。
- 外部 skill 使用精确 `skills` projection 和完整 40 位 commit SHA；不能依赖远端默认分支扫描整个仓库。
- MCP catalog 按能力域存放在 `mcps/<capability>/mcps.json`；角色只通过 capability 获取共享 catalog。
- composer 负责已知 projection 目标冲突，catalog 内容中的 MCP server 名称冲突由 `vendor-staging.ts` 在读取 catalog 后负责。
- role-owned vendor identity 和最终安装协议保持稳定；安装器与宿主投影不解析 capability。

## 4. Validation & Error Matrix

| 条件 | 结果 |
|---|---|
| 未知 capability 名称 | 抛出 `Unknown capability` |
| 同一角色重复声明 capability | 抛出 `declared more than once` |
| 同名 vendor 的 source/revision/setup 不一致 | 抛出 vendor definition conflict |
| 两个非相同 projection 写入同一 skill/MCP/role 目标 | 抛出 projection target conflict |
| 完全相同的 projection 重复出现 | 只保留首次出现项 |
| 两个 MCP catalog 声明同名 server | vendor staging 失败并报告两个 owner |
| capability 输入或 role vendor 被输出修改反向污染 | 单元测试失败；composer 必须深复制受支持配置字段 |

## 5. Good / Base / Bad Cases

Good：`frontend` 同时贡献固定 revision 的 `frontend-design` vendor 和 `mcps/frontend/mcps.json`，角色只声明 `'frontend'`。

Base：角色只声明所需能力，role-owned `role-assets` 仍直接写在该角色的 `roleVendor`。

Bad：在 Trellis 和 Moluoxixi 清单中分别复制 Anthropic repo、revision 与 Playwright projection。该写法产生多个事实源，版本或 MCP 分类会漂移。

## 6. Tests Required

- `scripts/lib/__test__/capabilities.test.ts`：稳定顺序、输入不可变、未知/重复能力、vendor 合并与 projection 冲突。
- `scripts/lib/__test__/vendor-staging.test.ts`：跨 catalog MCP server 名称冲突。
- `roles/<role>/__test__/`：每个角色的 capability 声明、展开 vendor/link、MCP 归属和 role-owned 资产。
- `scripts/verify-packed-airules.mjs`：打包产物包含 `dist/capabilities`，并能导入编译后的角色清单。

## 7. Wrong vs Correct

Wrong：角色重复维护公共能力。

```typescript
export const vendors = [{
  name: 'role',
  projections: [
    { kind: 'mcp', sourceFile: 'mcps/frontend/mcps.json', output: 'mcps/frontend/mcp.json' },
  ],
}]
```

Correct：角色声明能力，公共 registry 拥有 projection。

```typescript
export const capabilities = ['frontend'] as const satisfies readonly CapabilityName[]
export const vendors = composeCapabilities(capabilities, { roleVendor })
```
