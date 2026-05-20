# Skill 结构示例与反模式

## 最小结构

```text
my-skill/
  SKILL.md
```

```yaml
---
name: my-skill
description: 从 PDF 提取文本和表格，填充表单，合并文档。用于处理 PDF 文件或用户提及 PDF、表单、文档提取时。
---
```

要点：description 同时写了"做什么"和"何时使用"，关键 use case 在前，第三人称。

## 带资源结构

```text
my-skill/
  SKILL.md
  examples/
    sample-output.md
  scripts/
    validate.py
  validation/
    checklist.md       # 可选，仅当 SKILL.md rubric 不够时
```

所有 reference 文件从 SKILL.md 直接索引（一层深）：

```markdown
## 辅助资源

- [examples/sample-output.md](examples/sample-output.md)：输出示例
- [validation/checklist.md](validation/checklist.md)：校验清单
```

## 反模式

### 杂项文档

```text
my-skill/
  SKILL.md
  README.md          ← 禁止：制造重复入口
  QUICK_REFERENCE.md ← 禁止：和 SKILL.md 职责重叠
  CHANGELOG.md       ← 禁止：和 skill 执行无关
```

### 深层跳转

```text
SKILL.md → advanced.md → details.md → actual-info.md
```

Claude 可能只部分读取深层文件。所有 reference 应从 SKILL.md 直接链接。

### description 写法

```yaml
# 太模糊
description: Helps with documents

# 第一人称
description: I can help you process Excel files

# 只写流程不写触发
description: 先分析输入，再应用规则，最后输出结果

# 包含保留词
description: Use claude-helper to process files

# 过长（超过 160 字符）
description: 用于创建、修改或评审任意 Claude/Codex skill 后，校验其是否符合官方 Skills 最佳实践，包括 SKILL.md 元数据、触发描述质量、正文精简度、资源拆分、引用深度、脚本语义和内容质量。
```

### 正确写法

```yaml
description: 校验 Claude/Codex skill 是否符合官方最佳实践。用于创建、修改或评审 skill 后。
```
