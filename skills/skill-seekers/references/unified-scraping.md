# 统一多源抓取完整指南

## 概述

统一多源抓取功能允许将来自多个来源（官方文档、GitHub 代码仓库、PDF 手册等）的内容合并为一个统一的技能。这样可以确保技能包含完整、一致的信息，避免信息孤岛。

### 支持的数据源

- **Documentation（文档）**: 从官方网站、文档站点抓取 HTML 内容
- **GitHub（代码仓库）**: 从 GitHub 仓库抓取代码、README、文档等
- **PDF（文档）**: 从本地 PDF 文件提取文本内容

### 核心优势

1. **完整性**: 覆盖文档和代码两个维度的信息
2. **一致性**: 通过冲突检测机制确保信息一致
3. **自动化**: 一次性配置，自动抓取和合并多个来源
4. **智能化**: 支持基于规则和 AI 驱动的合并策略

---

## 统一配置文件格式

### 基本结构

```json
{
  "name": "myframework",
  "merge_mode": "rule-based",
  "sources": [
    {
      "type": "documentation",
      "base_url": "https://docs.example.com",
      "max_pages": 200
    },
    {
      "type": "github",
      "repo": "owner/repo",
      "code_analysis_depth": "c3x"
    },
    {
      "type": "pdf",
      "file": "./manual.pdf"
    }
  ]
}
```

### 配置字段说明

#### 顶层字段

- **name** (string): 技能名称，用于生成输出文件名
- **merge_mode** (string): 合并模式，可选值 `"rule-based"` 或 `"ai-based"`
- **sources** (array): 数据源配置列表

#### 数据源配置

##### Documentation 类型

```json
{
  "type": "documentation",
  "base_url": "https://docs.example.com",
  "max_pages": 200,
  "include_patterns": ["*/api/*", "*/guide/*"],
  "exclude_patterns": ["*/deprecated/*"],
  "follow_links": true
}
```

- **base_url**: 文档站点的根 URL
- **max_pages**: 最大抓取页面数（默认：100）
- **include_patterns**: URL 匹配模式数组（可选）
- **exclude_patterns**: URL 排除模式数组（可选）
- **follow_links**: 是否跟随链接抓取（默认：true）

##### GitHub 类型

```json
{
  "type": "github",
  "repo": "owner/repo",
  "code_analysis_depth": "c3x",
  "branches": ["main", "develop"],
  "include_paths": ["src/", "docs/"],
  "exclude_paths": ["tests/", ".github/"]
}
```

- **repo**: GitHub 仓库完整路径（owner/repo）
- **code_analysis_depth**: 代码分析深度
  - `c1x`: 仅文件名和基本结构
  - `c2x`: 函数签名和类定义
  - `c3x`: 完整代码分析（推荐）
- **branches**: 要分析的分支列表（可选，默认：main）
- **include_paths**: 包含的路径模式（可选）
- **exclude_paths**: 排除的路径模式（可选）

##### PDF 类型

```json
{
  "type": "pdf",
  "file": "./manual.pdf",
  "pages": "1-50",
  "ocr_enabled": false
}
```

- **file**: PDF 文件路径（相对或绝对路径）
- **pages**: 页面范围，格式 `"1-50"` 或 `"1,3,5-10"`（可选，默认：全部）
- **ocr_enabled**: 是否启用 OCR（默认：false）

---

## 合并模式

### Rule-based（基于规则）

使用预定义规则合并内容，速度快，可预测。

**适用场景**:
- 文档和代码结构清晰
- 需要快速生成结果
- 对合并逻辑有精确控制要求

**规则示例**:
- 优先保留文档中的详细描述
- 代码中的注释作为补充
- 相同内容去重
- 按模块/主题组织

### AI-based（AI 驱动）

使用 AI 智能分析和合并内容，质量更高。

**适用场景**:
- 文档和代码结构复杂
- 需要智能冲突解决
- 对质量要求极高

**AI 能力**:
- 理解上下文和语义
- 智能冲突解决
- 内容优化和重组
- 生成更好的摘要

---

## 冲突检测机制

统一抓取会自动检测并报告文档和代码之间的冲突。

### 冲突类型

#### 🔴 代码中缺失（高优先级）

**描述**: 文档中描述的功能在代码中未找到实现。

**示例**:
- 文档提到 `User.authenticate()` 方法
- 但代码中未定义此方法

**影响**: 高。可能导致用户尝试使用不存在的方法。

**建议**:
- 检查文档是否过时
- 确认代码是否完整
- 更新文档或补充代码实现

---

#### 🟡 文档中缺失（中优先级）

**描述**: 代码中实现的功能在文档中未找到说明。

**示例**:
- 代码定义了 `User.resetPassword()` 方法
- 但文档中未提及此功能

**影响**: 中。用户可能不知道某些功能的存在。

**建议**:
- 补充文档说明
- 添加使用示例
- 更新 API 参考文档

---

#### ⚠️ 签名不匹配（中优先级）

**描述**: 文档和代码中的函数/方法签名不一致。

**示例**:
- 文档: `User.login(username, password)`
- 代码: `User.login(email, password)`

**影响**: 中。用户调用参数错误会导致运行时错误。

**建议**:
- 统一命名规范
- 确认哪个是正确的
- 更新文档或代码

---

#### ℹ️ 描述不匹配（低优先级）

**描述**: 文档和代码对同一功能的描述或解释不同。

**示例**:
- 文档说此功能用于"快速搜索"
- 代码注释说此功能用于"精确匹配"

**影响**: 低。可能导致理解偏差。

**建议**:
- 统一术语和描述
- 明确功能边界
- 提供更准确的说明

---

## 使用命令

### 基本命令

```bash
skill-seekers unified --config configs/xxx_unified.json
```

### 常用选项

- `--config, -c`: 指定配置文件路径（必需）
- `--output, -o`: 指定输出目录（默认：当前目录）
- `--verbose, -v`: 显示详细输出
- `--dry-run`: 仅检查配置，不执行抓取
- `--force`: 强制重新抓取，忽略缓存

### 示例

```bash
# 使用配置文件抓取
skill-seekers unified --config configs/react_unified.json

# 指定输出目录
skill-seekers unified -c configs/myframework.json -o ./output/

# 详细模式
skill-seekers unified -c configs/django_unified.json -v

# 检查配置
skill-seekers unified -c configs/test.json --dry-run

# 强制重新抓取
skill-seekers unified -c configs/react_unified.json --force
```

---

## 现有统一预设配置示例

### React 统一配置

```json
{
  "name": "react_unified",
  "merge_mode": "rule-based",
  "sources": [
    {
      "type": "documentation",
      "base_url": "https://react.dev",
      "max_pages": 300,
      "include_patterns": ["*/learn/*", "*/reference/*"]
    },
    {
      "type": "github",
      "repo": "facebook/react",
      "code_analysis_depth": "c3x",
      "include_paths": ["packages/react/src/", "packages/react-dom/src/"]
    }
  ]
}
```

### Django 统一配置

```json
{
  "name": "django_unified",
  "merge_mode": "ai-based",
  "sources": [
    {
      "type": "documentation",
      "base_url": "https://docs.djangoproject.com",
      "max_pages": 500,
      "include_patterns": ["*/en/stable/*"]
    },
    {
      "type": "github",
      "repo": "django/django",
      "code_analysis_depth": "c3x",
      "branches": ["main", "stable/4.2.x"]
    }
  ]
}
```

### Vue 统一配置

```json
{
  "name": "vue_unified",
  "merge_mode": "rule-based",
  "sources": [
    {
      "type": "documentation",
      "base_url": "https://vuejs.org",
      "max_pages": 250
    },
    {
      "type": "github",
      "repo": "vuejs/core",
      "code_analysis_depth": "c3x"
    },
    {
      "type": "pdf",
      "file": "./vue-guide.pdf"
    }
  ]
}
```

---

## 冲突报告解读

执行统一抓取后，会生成冲突报告文件 `conflicts_report.json`。

### 报告结构

```json
{
  "summary": {
    "total_conflicts": 15,
    "high_priority": 3,
    "medium_priority": 8,
    "low_priority": 4
  },
  "conflicts": [
    {
      "type": "missing_in_code",
      "priority": "high",
      "source": "documentation",
      "target": "github",
      "description": "Method 'authenticate' not found in code",
      "location": {
        "doc_url": "https://docs.example.com/api/auth",
        "expected_file": "src/auth/User.js"
      }
    },
    {
      "type": "missing_in_doc",
      "priority": "medium",
      "source": "github",
      "target": "documentation",
      "description": "Method 'resetPassword' not documented",
      "location": {
        "file": "src/auth/User.js",
        "line": 45
      }
    }
  ]
}
```

### 查看报告

```bash
# 查看摘要
skill-seekers conflicts --summary

# 查看详细报告
skill-seekers conflicts --detail

# 导出为 HTML
skill-seekers conflicts --export-html conflicts.html

# 按优先级过滤
skill-seekers conflicts --priority high
```

---

## 最佳实践

### 1. 配置文件组织

```
configs/
├── react_unified.json
├── django_unified.json
├── vue_unified.json
└── custom/
    ├── myframework_unified.json
    └── internal_tools_unified.json
```

### 2. 选择合适的合并模式

- **rule-based**: 适用于结构化良好的文档和代码
- **ai-based**: 适用于复杂项目或需要高质量输出

### 3. 合理设置抓取范围

- 从小范围开始测试
- 根据需要逐步扩大
- 使用 `include_patterns` 和 `exclude_patterns` 精确控制

### 4. 处理冲突

- 优先解决高优先级冲突
- 定期更新文档和代码保持同步
- 建立文档更新流程

### 5. 性能优化

- 使用缓存机制
- 合理设置 `max_pages`
- 对于大型项目，分批次抓取

### 6. 版本管理

- 将配置文件纳入版本控制
- 记录每次抓取的版本信息
- 使用标签管理不同版本的技能

### 7. 质量保证

- 审查冲突报告
- 人工检查关键部分
- 定期更新技能内容

---

## 常见问题

### Q: 如何处理抓取失败的情况？

A: 检查网络连接、URL 有效性、访问权限等。使用 `--verbose` 选项查看详细错误信息。

### Q: 可以混合使用不同合并模式吗？

A: 目前不支持。每个配置文件只能指定一种合并模式。

### Q: 如何自定义合并规则？

A: 对于 rule-based 模式，可以在配置文件中添加自定义规则。对于 ai-based 模式，可以在提示词中指定。

### Q: 抓取速度慢怎么办？

A: 减少抓取页面数、使用更精确的 URL 模式、考虑使用 rule-based 模式。

### Q: 如何确保技能内容是最新的？

A: 定期重新运行抓取命令，使用 `--force` 选项强制更新。

---

## 相关资源

- [配置结构详解](config-structure.md)
- [命令参考](commands.md)
- [预设配置列表](presets.md)
- [高级功能](advanced-features.md)
