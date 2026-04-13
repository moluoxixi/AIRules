# 三流 GitHub 分析

## 概述

将 GitHub 仓库拆分为三个独立流进行分析：

1. **代码流** - 深度 AST 解析（模式、示例、指南、配置、架构）
2. **文档流** - 仓库文档（README、CONTRIBUTING、docs/*.md）
3. **洞察流** - 社区知识（Issues、标签、Stars、Forks）

## 使用方式

```bash
# 基础分析
skill-seekers github --repo owner/repo

# 深度分析（C3.x）
skill-seekers github --repo owner/repo --code-analysis-depth c3x

# 三流分析
skill-seekers analyze --directory ./my-repo --comprehensive
```

## 代码分析深度

| 级别 | 时间 | 功能 |
|------|------|------|
| `surface` | 1-2分钟 | 基础结构 |
| `basic` | 5-10分钟 | 简单分析 |
| `c3x` | 20-60分钟 | 完整C3.x功能 |

## C3.x 功能套件

### C3.1 设计模式检测

检测 10 种 GoF 模式：Singleton、Factory、Observer、Strategy、Decorator、Builder、Adapter、Command、Template Method、Chain of Responsibility。

支持 9 种语言：Python、JavaScript、TypeScript、C++、C、C#、Go、Ruby、Rust。

```bash
skill-seekers analyze --directory . --enhance
# 输出：pattern_recognition.json
```

### C3.2 测试示例提取

从测试文件中提取真实使用示例。

```bash
# 提取示例
skill-seekers extract test_examples --directory tests/

# 分类：instantiation、method_call、config、setup、workflow
```

### C3.3 操作指南生成

将测试工作流转换为教育指南。

```bash
skill-seekers how-to-guides output/test_examples.json --output output/guides/
```

生成内容包括：
- 步骤说明
- 故障排除
- 前提条件
- 后续步骤
- 使用场景

### C3.4 配置模式提取

提取配置文件、CLI 参数、环境变量。

```bash
skill-seekers analyze --directory . --enhance-level 2
```

支持 9 种格式：JSON、YAML、TOML、ENV、INI、Python、JavaScript、Dockerfile、Docker Compose。

### C3.5 架构概览

生成 `ARCHITECTURE.md` 文件和路由技能。

```bash
skill-seekers generate router --directory .
```

### C3.6 AI 增强

使用 Claude API 增强 C3.1-C3.5 的分析结果。

```bash
# API 模式
skill-seekers analyze --directory . --enhance --mode api

# LOCAL 模式（使用 Claude Code）
skill-seekers analyze --directory . --enhance --mode local
```

### C3.7 架构模式检测

检测 8 种架构模式：MVC、MVVM、MVP、Repository、Unit of Work、Observer、Decorator、AOP。

```bash
skill-seekers analyze --directory . --comprehensive
```

### C3.8 独立代码库抓取

无需文档，从代码本身生成 300+ 行的 SKILL.md。

```bash
skill-seekers analyze --directory . --quick
skill-seekers analyze --directory . --comprehensive
```

### C3.9 项目文档提取

从项目中提取并分类所有 markdown 文件。

```bash
skill-seekers analyze --directory . --skip-docs  # 跳过文档提取
```

### C3.10 信号流分析（Godot）

Godot 项目的完整信号流分析。

```bash
skill-seekers analyze --directory ./godot-project --comprehensive
```

检测：
- EventBus 模式（0.90 置信度）
- Observer 模式（0.85 置信度）
- 事件链（0.80 置信度）

---

## GitHub 元数据

自动获取：
- Stars、Forks、Watchers
- 开放 Issues 和 PR
- CHANGELOG 和发布历史
- 标签权重（关键词检测效果翻倍）

```bash
skill-seekers github --repo owner/repo --include-issues --max-issues 100
```
