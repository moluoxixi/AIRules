# Create Skill

创建新的 skill 的操作指南。

## 操作步骤

### 1. 确定 skill 范围

询问用户：
- 这个 skill 要解决什么问题？
- 谁会使用这个 skill？
- 适用于哪些角色？（moluoxixi、trellis 或通用）

### 2. 确定 skill 分类和创建目录

根据适用范围选择分类：

```bash
# 多个角色共享的通用 skill
mkdir -p skills/common/<skill-name>

# 角色专属 skill
mkdir -p roles/<role>/skills/<skill-name>
```

### 3. 创建 README.md（说明文档）

创建 `README.md` 包含：

````markdown
# <Skill Name>

简短描述（1-2 句话）

## 功能

此技能帮助：
- 功能点 1
- 功能点 2
- 功能点 3

## 适用范围

- 适用场景 1
- 适用场景 2

## 使用场景

- 何时使用这个 skill
- 典型的使用案例
```

### 4. 创建 SKILL.md（操作手册）

创建 `SKILL.md` 包含**可执行的操作步骤**：

```markdown
# <Skill Name>

简短描述操作目标。

## 操作步骤

### 1. 第一步标题

```bash
# 具体命令
command --flag value
```

具体操作说明。

### 2. 第二步标题

询问用户：
- 需要确认的问题？
- 需要选择的选项？

### 3. 后续步骤

继续详细的操作指导...

## 命令参考

```bash
# 常用命令 1
command1

# 常用命令 2
command2
```

## 检查清单

- [ ] 检查项 1
- [ ] 检查项 2
- [ ] 检查项 3

## 注意事项

- 警告 1
- 警告 2
````

### 5. 添加引用文档（可选）

如果 skill 复杂，创建 `references/` 目录：

```bash
mkdir -p roles/<role>/skills/<skill-name>/references
```

添加详细参考文档：
- `references/commands.md` - 命令参考
- `references/examples.md` - 示例
- `references/troubleshooting.md` - 故障排查

### 6. 文件命名规范

```
skill-name/
├── README.md          # 说明：功能、适用范围、使用场景
├── SKILL.md          # 操作：步骤、命令、检查清单
└── references/       # 可选：详细参考文档
    ├── commands.md
    ├── examples.md
    └── troubleshooting.md
```

### 7. 验证 skill 结构

```bash
# 检查文件是否存在
ls -la roles/<role>/skills/<skill-name>/

# 验证 Markdown 格式
cat roles/<role>/skills/<skill-name>/SKILL.md
```

### 8. 配置 vendor projection（共享 skill）

对于 `skills/common/` 中的共享 skill，需要在使用它的角色的 `constants/skills.ts` 中配置 projection：

```typescript
// roles/<role>/constants/skills.ts
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

这样当项目 clone 下来后，运行同步命令会自动将 `skills/common/` 下的所有 skills 投影到 `vendor/skills/` 目录。

## 文件职责

| 文件 | 职责 | 内容特点 |
|------|------|---------|
| `README.md` | 说明文档 | 功能介绍、适用范围、使用场景 |
| `SKILL.md` | 操作手册 | 步骤、命令、检查清单、可执行 |
| `references/*.md` | 参考文档 | 详细技术信息、示例、故障排查 |

## SKILL.md 写作原则

1. **可执行**：每个步骤都应该清晰、可操作
2. **结构化**：使用编号步骤和清晰的标题
3. **命令优先**：提供实际可运行的命令示例
4. **交互式**：包含需要询问用户的决策点
5. **检查清单**：提供验证步骤的清单

## README.md 写作原则

1. **简洁**：快速了解 skill 的作用
2. **场景驱动**：说明何时使用
3. **功能清单**：列举核心功能点
4. **适用范围**：明确边界

## 命名约定

```bash
# ✅ 正确
create-skill/
spec-organization/
debug-workflow/

# ❌ 错误
CreateSkill/
specOrganization/
Debug_Workflow/
```

## 示例结构

```
skills/
└── common/
    ├── spec-organization/
    │   ├── README.md
    │   └── SKILL.md
    └── create-skill/
        ├── README.md
        └── SKILL.md

roles/moluoxixi/skills/
└── init-project/
    ├── README.md
    └── SKILL.md

roles/trellis/skills/
└── init-project/
    ├── README.md
    ├── SKILL.md
    └── assets/
```

## 检查清单

- [ ] 创建目录结构
- [ ] 编写 README.md（说明文档）
- [ ] 编写 SKILL.md（操作手册）
- [ ] 添加 references/（如需要）
- [ ] 对于共享 skill，复制到两个角色
- [ ] 验证文件格式和结构
- [ ] 测试操作步骤可执行性
