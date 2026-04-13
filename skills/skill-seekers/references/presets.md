# 增强工作流预设

## 概述

工作流预设定义 AI 如何将原始文档转换为精心打磨的技能。可重用的 YAML 文件。

## 内置预设（5个）

| 预设 | 用途 |
|------|------|
| `default` | 标准转换 |
| `minimal` | 最小化输出 |
| `security-focus` | 安全审查 |
| `architecture-comprehensive` | 架构分析 |
| `api-documentation` | API文档 |

---

## 安全重点预设 (security-focus)

```yaml
name: security-focus
description: "安全重点审查：漏洞、认证、数据处理"
version: "1.0"
stages:
  - name: vulnerabilities
    type: custom
    prompt: "审查 OWASP Top 10 和常见安全漏洞..."
  - name: auth-review
    type: custom
    prompt: "检查认证和授权模式..."
    uses_history: true
```

## 架构分析预设 (architecture-comprehensive)

```yaml
name: architecture-comprehensive
description: "全面架构分析：设计模式、组件关系、数据流"
version: "1.0"
stages:
  - name: patterns
    type: pattern_recognition
    prompt: "识别架构模式和设计模式..."
  - name: components
    type: dependency_analysis
    prompt: "分析组件依赖关系..."
  - name: data-flow
    type: flow_analysis
    prompt: "追踪数据流动..."
```

## API文档预设 (api-documentation)

```yaml
name: api-documentation
description: "生成完整的API参考文档"
version: "1.0"
stages:
  - name: endpoints
    type: api_extraction
    prompt: "提取所有API端点..."
  - name: parameters
    type: parameter_doc
    prompt: "记录参数和返回值..."
  - name: examples
    type: example_generation
    prompt: "生成使用示例..."
```

---

## 管理命令

```bash
# 列出所有预设
skill-seekers workflows list

# 查看预设内容
skill-seekers workflows show security-focus

# 复制到用户目录
skill-seekers workflows copy security-focus

# 添加自定义预设
skill-seekers workflows add ./my-workflow.yaml

# 删除用户预设
skill-seekers workflows remove my-workflow

# 验证预设
skill-seekers workflows validate security-focus

# 链式使用多个工作流
skill-seekers create ./my-project \
  --enhance-workflow security-focus \
  --enhance-workflow minimal
```

---

## 创建自定义预设

位置: `~/.config/skill-seekers/workflows/`

```yaml
name: my-custom-workflow
description: "我的自定义工作流"
version: "1.0"
stages:
  - name: stage1
    type: custom
    prompt: "执行特定任务..."
  - name: stage2
    type: enhancement
    prompt: "AI增强..."
```

## 预设类型

| 类型 | 说明 |
|------|------|
| `custom` | 自定义提示词 |
| `pattern_recognition` | 设计模式检测 |
| `api_extraction` | API端点提取 |
| `example_generation` | 示例生成 |
| `documentation` | 文档整理 |
| `enhancement` | AI增强 |
