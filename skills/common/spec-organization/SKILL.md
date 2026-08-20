# Spec Organization

整理 `.moluoxixi/spec/` 或 `.trellis/spec/` 目录中的规范文件。

## 操作步骤

### 1. 审计当前结构

```bash
# 列出所有 spec 文件
find .moluoxixi/spec -name "*.md" -type f

# 查看目录结构
tree .moluoxixi/spec
```

### 2. 分析和分类

询问用户：
- 当前 spec 的主要用途是什么？
- 哪些 spec 经常一起使用？
- 团队按什么方式思考这些规范？

### 3. 选择组织模式

根据项目特点选择：

**按层次**（适合有明确架构层次的项目）：
```
spec/
  architecture/
  implementation/
  testing/
```

**按功能领域**（适合领域驱动的项目）：
```
spec/
  auth/
  api/
  data/
```

**按技术栈**（适合全栈项目）：
```
spec/
  frontend/
  backend/
  infrastructure/
```

### 4. 执行重组

```bash
# 创建新目录结构
mkdir -p .moluoxixi/spec/{category1,category2,category3}

# 移动文件
mv .moluoxixi/spec/old-file.md .moluoxixi/spec/category1/new-name.md
```

### 5. 更新链接

使用相对路径更新所有内部链接：

```markdown
详见 [认证](./auth/authentication.md)
数据库模式参考 [数据库 Schema](../data/database-schema.md)
```

### 6. 创建索引文件

为每个主要分类创建 `README.md` 或 `index.md`：

```markdown
# API 规范

- [REST 约定](./rest-conventions.md) - HTTP API 设计规则
- [版本管理](./versioning.md) - API 版本策略
- [认证](./authentication.md) - API 认证要求
```

### 7. 验证完整性

```bash
# 检查断链
grep -r "\[.*\](.*.md)" .moluoxixi/spec

# 验证所有文件都已移动
git status
```

## 命名规则

```bash
# ✅ 正确
error-handling.md
rest-api-conventions.md
test-strategy.md

# ❌ 错误
ErrorHandling.md
api.md
testing-strategy.md  # 在 testing/ 目录下冗余
```

## 拆分决策

**拆分单个文件**当：
- 超过 500 行
- 包含多个独立主题
- 不同团队成员负责不同部分

**合并多个文件**当：
- 总共少于 500 行
- 主题紧密耦合
- 总是一起被引用

## 常见分类

```
spec/
├── architecture/      # 系统设计、边界、模式
├── coding/           # 语言约定、风格指南
├── testing/          # 测试策略、覆盖率
├── deployment/       # CI/CD、基础设施
├── api/              # 接口契约、协议
├── data/             # 数据库、schema、迁移
├── security/         # 认证、权限、合规
└── processes/        # 工作流、审查流程
```

## 反模式警告

避免：
- 深度嵌套（>3 层）
- 模糊分类（`misc/`、`other/`）
- 重复信息
- 以实现细节命名
- 按团队结构组织

## 迁移清单

- [ ] 审计所有现有 spec
- [ ] 选择组织模式
- [ ] 设计目标结构
- [ ] 创建新目录
- [ ] 移动文件
- [ ] 更新所有内部链接
- [ ] 创建索引文件
- [ ] 验证没有断链
- [ ] 提交更改
