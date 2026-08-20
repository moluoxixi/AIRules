# Shared Skills

跨角色共享的 skills 集合。

## 目录结构

```
skills/
└── common/          # 通用 skills，适用于所有角色
    ├── spec-organization/
    └── create-skill/
```

## 分类说明

### common/
通用 skills，不依赖特定角色或上游框架，多个角色都会用到：
- 文档组织（spec-organization）
- 开发流程辅助（create-skill）
- 通用工具

## 使用方式

各角色通过 `constants/skills.ts` 配置 vendor projection 来同步共享 skills：

```typescript
projections: [
  {
    kind: 'role-assets',
    sourceDir: 'roles/<role>',
  },
  {
    kind: 'namespace',
    sourceDir: 'skills/common',
    output: 'common',
  },
]
```

同步后的目录结构：
```
vendor/
└── skills/
    ├── spec-organization/    # 来自 skills/common/
    ├── create-skill/         # 来自 skills/common/
    └── init-project/         # 来自 roles/<role>/skills/
```

## 添加新 Skill

使用 `skills/common/create-skill` 指南创建新的共享 skill。

根据适用范围选择位置：
- 多个角色共享 → `skills/common/`
- 角色专属 → `roles/<role>/skills/`

添加共享 skill 后，需要在使用该 skill 的角色的 `constants/skills.ts` 中配置 projection。
