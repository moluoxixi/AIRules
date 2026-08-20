# Skills Organization

本文档说明 AIRules 项目的 skills 组织结构和同步机制。

## 目录结构

```
AIRules/
├── skills/                    # 跨角色共享 skills
│   └── common/               # 通用 skills（多个角色都用到）
│       ├── create-skill/    # 创建新 skill 的元技能
│       └── spec-organization/ # 规范文档组织
└── roles/
    ├── moluoxixi/
    │   ├── constants/
    │   │   └── skills.ts    # ⚙️ Moluoxixi 的 vendor projection 配置
    │   └── skills/          # Moluoxixi 角色专属 skills
    │       └── init-project/
    └── trellis/
        ├── constants/
        │   └── skills.ts    # ⚙️ Trellis 的 vendor projection 配置
        └── skills/          # Trellis 角色专属 skills
            └── init-project/
```

## 分类说明

### `skills/common/` - 跨角色共享
多个角色都会用到的通用功能：
- 文档和规范组织
- 开发流程辅助工具
- 元技能（如 create-skill）

**判断标准**：如果 moluoxixi 和 trellis 都需要这个 skill，就放在 `skills/common/`。

### `roles/<role>/skills/` - 角色专属
特定角色的定制化 skills：
- 角色特定的工作流程
- 角色独有的配置和集成
- 同名但实现不同的 skills（如两个角色都有 init-project，但实现不同）

## Vendor Projection 机制

项目通过 `constants/skills.ts` 配置 vendor projection，实现跨仓库的 skills 同步。

### 配置示例

```typescript
// roles/moluoxixi/constants/skills.ts
export const vendors: VendorRepo[] = [
  {
    name: 'moluoxixi',
    source: 'https://github.com/moluoxixi/AIRules.git',
    projections: [
      {
        kind: 'role-assets',
        sourceDir: 'roles/moluoxixi',
      },
      {
        kind: 'namespace',
        sourceDir: 'skills/common',
        output: 'common',
      },
    ],
  },
]
```

### Projection 类型

1. **`role-assets`** - 投影角色的所有资产
   - 包括 `roles/<role>/skills/` 下的所有 skills
   - 包括角色的其他资产（constants, mcp 等）

2. **`namespace`** - 投影共享 skills 目录
   - 递归扫描 `sourceDir` 找到所有包含 `SKILL.md` 的目录
   - 将这些 skills 扁平化投影到 `vendor/skills/`
   - 例如 `skills/common/spec-organization/` → `vendor/skills/spec-organization/`

### 同步后的结构

当用户 clone 仓库并运行同步命令后：

```
vendor/
└── skills/
    ├── spec-organization/    # 来自 skills/common/
    ├── create-skill/         # 来自 skills/common/
    └── init-project/         # 来自 roles/<role>/skills/
```

## 添加新 Skill

使用 `skills/common/create-skill` 指南创建新 skill。

### 选择位置

1. **多个角色都需要** → `skills/common/`
   - 添加后需要在每个使用该 skill 的角色的 `constants/skills.ts` 中添加 namespace projection
   
2. **只有一个角色需要** → `roles/<role>/skills/`
   - 该角色的 `role-assets` projection 会自动包含

### 配置 Projection

如果添加到 `skills/common/`，需要更新使用该 skill 的角色配置：

```typescript
// roles/<role>/constants/skills.ts
projections: [
  {
    kind: 'role-assets',
    sourceDir: 'roles/<role>',
  },
  {
    kind: 'namespace',
    sourceDir: 'skills/common',  // 已存在，无需重复添加
    output: 'common',
  },
]
```

如果 `skills/common` projection 已存在，新加的 skill 会自动被包含（因为 namespace 会递归扫描整个目录）。

## 维护原则

1. **避免重复**：相同功能只在一处维护
2. **明确边界**：清晰划分通用、框架特定和角色专属
3. **文档完整**：每个 skill 必须包含 README.md 和 SKILL.md
4. **版本兼容**：共享 skills 的变更需考虑所有使用者
