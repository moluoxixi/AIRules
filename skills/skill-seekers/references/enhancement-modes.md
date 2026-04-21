# AI 增强模式完整指南

## 增强概述

AI 增强功能将原始抓取的文档转换为精心打磨、结构清晰、易于理解的技能内容。通过智能分析、重组和优化，大幅提升技能的质量和可用性。

### 增强的价值

1. **结构化**: 将混乱的原始内容组织成清晰的结构
2. **可读性**: 优化语言表达，提高阅读体验
3. **完整性**: 补充缺失的信息，确保内容完整
4. **实用性**: 添加示例、最佳实践等实用内容
5. **一致性**: 统一术语、格式和风格

---

## 增强模式

### API 模式

直接调用 Claude API 进行增强处理。

**特点**:
- 需要 `ANTHROPIC_API_KEY` 环境变量
- 速度较快：20-40 秒
- 质量稳定
- 需要付费（按 API 调用计费）

**配置**:
```bash
export ANTHROPIC_API_KEY="your-api-key-here"

# 使用 Claude 兼容 API 端点（如 GLM-4.7 智谱 AI）
export ANTHROPIC_BASE_URL="https://your-compatible-endpoint.com/v1"
```

**使用**:
```bash
# 自动检测到 API Key，使用 API 模式
skill-seekers scrape --url https://docs.example.com --enhance
```

**注意**：设置 `ANTHROPIC_BASE_URL` 后，所有 AI 增强功能将使用配置的兼容端点，支持 GLM-4.7 等 Claude 兼容 API 服务。

---

### LOCAL 模式

使用 Claude Code CLI 进行增强处理。

**特点**:
- 免费使用（需 Claude Code Max 计划）
- 速度稍慢：30-60 秒
- 依赖 Claude Code CLI 安装
- 无需额外 API 费用

**要求**:
- 已安装 Claude Code CLI
- 拥有 Claude Code Max 订阅

**配置**:
```bash
# 确保已安装 Claude Code CLI
claude --version
```

**使用**:
```bash
# 未设置 API Key，自动使用 LOCAL 模式
skill-seekers scrape --url https://docs.example.com --enhance
```

---

### 自动检测

系统会自动选择最合适的增强模式：

1. 检查是否设置了 `ANTHROPIC_API_KEY`
2. 如果有 API Key → 使用 **API 模式**
3. 如果没有 API Key → 使用 **LOCAL 模式**

**手动指定模式**:
```bash
# 强制使用 API 模式
skill-seekers scrape --url https://docs.example.com --enhance --mode api

# 强制使用 LOCAL 模式
skill-seekers scrape --url https://docs.example.com --enhance --mode local
```

---

## 增强级别

增强级别决定了增强处理的深度和广度。级别越高，处理越全面，但耗时也越长。

### Level 0: 禁用增强

**描述**: 仅输出原始抓取内容，不进行任何增强处理。

**适用场景**:
- 需要查看原始内容
- 快速测试抓取功能
- 对原始内容进行自定义处理

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --enhance-level 0
```

**输出**: 原始 HTML/Markdown 内容，未经优化。

---

### Level 1: 基础增强

**描述**: 仅增强 SKILL.md 文件，包括概述、结构和可读性优化。

**增强内容**:
- 生成清晰的概述和简介
- 优化文档结构和层次
- 改善语言表达和可读性
- 添加适当的标题和分段
- 基础格式整理

**适用场景**:
- 需要快速获得可用的技能
- 内容相对简单
- 对质量要求适中

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --enhance-level 1
```

**耗时**: 10-20 秒

**输出**: 优化后的 SKILL.md，参考文件保持原始状态。

---

### Level 2: 标准增强（推荐）

**描述**: 两遍增强处理。第一遍清理参考文件，第二遍运行工作流阶段并增强 SKILL.md。

**增强内容**:
- **第一遍**:
  - 清理和标准化参考文件
  - 去除重复内容
  - 优化代码示例
  - 统一格式和风格

- **第二遍**:
  - 包含 Level 1 的所有增强
  - 运行工作流阶段（如架构分析、API 文档生成等）
  - 添加使用示例和最佳实践
  - 生成索引和导航

**适用场景**:
- 大多数使用场景
- 需要高质量的技能
- 希望获得完整的文档体验

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --enhance-level 2

# 或简写（默认级别）
skill-seekers scrape --url https://docs.example.com --enhance
```

**耗时**: 30-60 秒

**输出**: 完整优化的技能，包括清理后的参考文件和增强的 SKILL.md。

---

### Level 3: 完整增强

**描述**: 最全面的增强处理。包含所有 Level-2 的工作，加上架构分析、配置分析和全面文档分析。

**增强内容**:
- **包含 Level 2 的所有内容**
- **额外增强**:
  - 深度架构分析
  - 配置文件解析和文档化
  - 完整的依赖关系分析
  - 性能优化建议
  - 安全性审查
  - 扩展性和可维护性分析
  - 生成详细的架构图和流程图（文本描述）

**适用场景**:
- 复杂项目或框架
- 需要深入理解系统设计
- 准备进行二次开发或定制
- 需要全面的文档支持

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --enhance-level 3
```

**耗时**: 60-120 秒

**输出**: 企业级质量的完整技能文档。

---

## 增强工作流预设

增强工作流定义了增强处理的具体步骤和策略。系统提供 5 个内置预设工作流。

### Default（默认）

**描述**: 标准转换工作流，适用于大多数场景。

**工作流步骤**:
1. 内容清理和标准化
2. 结构分析和重组
3. 语言优化
4. 示例提取和格式化
5. 索引生成

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --workflow default
```

---

### Minimal（最小化）

**描述**: 最小化输出，仅保留核心内容。

**工作流步骤**:
1. 基础清理
2. 核心内容提取
3. 简单格式化

**适用场景**:
- 快速获取关键信息
- 存储空间有限
- 需要自定义处理

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --workflow minimal
```

---

### Security-focus（安全审查）

**描述**: 专注于安全相关的分析和增强。

**工作流步骤**:
1. 安全漏洞识别
2. 最佳安全实践提取
3. 安全配置分析
4. 常见安全问题警示
5. 安全建议和指导

**适用场景**:
- 安全敏感的应用
- 需要安全审计
- 合规性要求

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --workflow security-focus
```

---

### Architecture-comprehensive（架构分析）

**描述**: 专注于架构和设计模式的深度分析。

**工作流步骤**:
1. 架构模式识别
2. 组件关系分析
3. 设计模式提取
4. 数据流分析
5. 扩展性评估

**适用场景**:
- 系统设计参考
- 架构决策
- 技术选型

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --workflow architecture-comprehensive
```

---

### API-documentation（API 文档生成）

**描述**: 专注于 API 的详细文档生成。

**工作流步骤**:
1. API 端点识别
2. 参数和返回值分析
3. 错误码和异常处理
4. 使用示例生成
5. 版本兼容性分析

**适用场景**:
- API 开发和集成
- SDK 开发
- 接口对接

**使用**:
```bash
skill-seekers scrape --url https://docs.example.com --workflow api-documentation
```

---

## 自定义工作流

如果预设工作流不能满足需求，可以创建自定义工作流。

### YAML 格式

自定义工作流使用 YAML 格式定义：

```yaml
name: my-custom-workflow
description: 自定义工作流描述
version: 1.0

# 增强阶段
stages:
  - name: content-cleaning
    description: 内容清理阶段
    enabled: true
    config:
      remove_duplicates: true
      normalize_format: true
      fix_code_blocks: true

  - name: structure-analysis
    description: 结构分析阶段
    enabled: true
    config:
      detect_sections: true
      generate_toc: true
      optimize_hierarchy: true

  - name: content-enhancement
    description: 内容增强阶段
    enabled: true
    config:
      improve_readability: true
      add_examples: true
      extract_best_practices: true

  - name: custom-analysis
    description: 自定义分析阶段
    enabled: true
    config:
      custom_param_1: value1
      custom_param_2: value2

# 输出配置
output:
  generate_index: true
  include_metadata: true
  format: markdown
```

### 使用自定义工作流

```bash
# 添加自定义工作流
skill-seekers workflow add ./my-workflow.yaml

# 使用自定义工作流
skill-seekers scrape --url https://docs.example.com --workflow my-custom-workflow
```

---

## 工作流管理命令

### List（列出工作流）

列出所有可用的工作流（内置和自定义）。

```bash
skill-seekers workflow list
```

**输出示例**:
```
Available Workflows:
  default              - Standard conversion workflow
  minimal              - Minimal output workflow
  security-focus       - Security-focused analysis
  architecture-comprehensive - Architecture deep-dive
  api-documentation    - API documentation generation
  my-custom-workflow   - Custom workflow (user-defined)
```

---

### Show（显示工作流详情）

显示指定工作流的详细信息。

```bash
skill-seekers workflow show default
```

**输出示例**:
```
Workflow: default
Description: Standard conversion workflow
Version: 1.0

Stages:
  1. content-cleaning
     - Remove duplicates: true
     - Normalize format: true
     - Fix code blocks: true

  2. structure-analysis
     - Detect sections: true
     - Generate TOC: true
     - Optimize hierarchy: true

  3. content-enhancement
     - Improve readability: true
     - Add examples: true
     - Extract best practices: true
```

---

### Copy（复制工作流）

复制现有工作流作为自定义工作流的模板。

```bash
# 复制内置工作流
skill-seekers workflow copy default my-workflow

# 复制自定义工作流
skill-seekers workflow copy existing-workflow new-workflow
```

---

### Add（添加工作流）

添加自定义工作流到系统。

```bash
skill-seekers workflow add ./my-workflow.yaml
```

**参数**:
- 工作流 YAML 文件路径

---

### Remove（移除工作流）

移除自定义工作流。

```bash
skill-seekers workflow remove my-workflow
```

**注意**: 只能移除自定义工作流，不能移除内置工作流。

---

### Validate（验证工作流）

验证工作流配置文件的正确性。

```bash
skill-seekers workflow validate ./my-workflow.yaml
```

**输出示例**:
```
✓ Workflow file is valid
✓ All stages are properly configured
✓ Output configuration is correct
```

---

## 链式工作流使用

可以将多个工作流串联起来，按顺序执行。

### 基本语法

```bash
skill-seekers scrape --url https://docs.example.com --workflow "minimal -> default -> api-documentation"
```

### 工作流顺序

1. **minimal**: 先进行最小化清理
2. **default**: 然后进行标准转换
3. **api-documentation**: 最后生成 API 文档

### 链式工作流的优势

- **渐进式增强**: 逐步提升内容质量
- **模块化**: 每个工作流专注特定任务
- **灵活性**: 可以自由组合不同的工作流

### 使用场景

```bash
# 场景 1: 先清理，再分析架构
skill-seekers scrape --url https://docs.example.com --workflow "minimal -> architecture-comprehensive"

# 场景 2: 安全审查后生成 API 文档
skill-seekers scrape --url https://docs.example.com --workflow "security-focus -> api-documentation"

# 场景 3: 完整的多阶段处理
skill-seekers scrape --url https://docs.example.com --workflow "minimal -> default -> architecture-comprehensive -> api-documentation"
```

---

## 使用示例

### 示例 1: 基础使用

使用默认设置抓取并增强文档：

```bash
skill-seekers scrape --url https://docs.example.com --enhance
```

**说明**:
- 自动检测增强模式（API 或 LOCAL）
- 使用 Level 2 增强级别
- 使用 default 工作流

---

### 示例 2: 指定增强级别

使用 Level 3 完整增强：

```bash
skill-seekers scrape --url https://docs.example.com --enhance-level 3
```

---

### 示例 3: 使用特定工作流

专注于安全分析：

```bash
skill-seekers scrape --url https://docs.example.com --workflow security-focus --enhance-level 2
```

---

### 示例 4: 链式工作流

多阶段增强处理：

```bash
skill-seekers scrape --url https://docs.example.com --workflow "minimal -> architecture-comprehensive" --enhance-level 2
```

---

### 示例 5: 自定义工作流

使用自定义工作流：

```bash
# 创建自定义工作流
cat > my-workflow.yaml << EOF
name: my-analysis
description: My custom analysis workflow
version: 1.0
stages:
  - name: content-cleaning
    enabled: true
  - name: custom-analysis
    enabled: true
    config:
      focus_area: "performance"
output:
  generate_index: true
EOF

# 添加工作流
skill-seekers workflow add ./my-workflow.yaml

# 使用自定义工作流
skill-seekers scrape --url https://docs.example.com --workflow my-analysis --enhance-level 2
```

---

### 示例 6: 强制使用 API 模式

确保使用 API 模式进行增强：

```bash
export ANTHROPIC_API_KEY="your-key"
skill-seekers scrape --url https://docs.example.com --enhance --mode api
```

---

### 示例 7: 完整配置示例

结合多种选项：

```bash
skill-seekers scrape \
  --url https://docs.example.com \
  --enhance-level 3 \
  --workflow "default -> api-documentation" \
  --mode api \
  --output ./my-skill \
  --verbose
```

---

## 性能考虑

### 增强模式对比

| 模式 | 速度 | 成本 | 质量 | 适用场景 |
|------|------|------|------|----------|
| API | 快 | 按调用计费 | 高稳定 | 生产环境 |
| LOCAL | 中 | 免费（需订阅） | 高 | 个人使用 |

### 增强级别对比

| 级别 | 耗时 | 输出质量 | 适用场景 |
|------|------|----------|----------|
| 0 | 最快 | 原始 | 测试、调试 |
| 1 | 快 | 基础 | 快速使用 |
| 2 | 中等 | 高 | 推荐、大多数场景 |
| 3 | 慢 | 最高 | 复杂项目、深度分析 |

### 优化建议

1. **选择合适的级别**: 大多数情况下 Level 2 是最佳选择
2. **使用链式工作流**: 避免过度处理，按需组合
3. **利用缓存**: 重复抓取时使用缓存减少时间
4. **批量处理**: 对于多个文档，考虑批量处理

---

## 常见问题

### Q: 增强失败怎么办？

A: 检查 API Key 是否正确、网络连接是否正常、Claude Code CLI 是否正确安装。使用 `--verbose` 查看详细错误。

### Q: 可以同时使用多个工作流吗？

A: 可以使用链式工作流语法串联多个工作流。

### Q: 增强级别和工作流有什么关系？

A: 增强级别决定增强的深度，工作流决定增强的方式。两者可以独立配置。

### Q: 如何提高增强速度？

A: 使用 API 模式、降低增强级别、选择更简单的工作流。

### Q: 自定义工作流支持哪些功能？

A: 支持自定义阶段、配置参数、输出格式等。详见工作流 YAML 格式。

---

## 相关资源

- [配置结构详解](config-structure.md)
- [命令参考](commands.md)
- [高级功能](advanced-features.md)
- [统一多源抓取](unified-scraping.md)
