# 配置文件结构

## 基本结构

```json
{
  "name": "framework-name",
  "description": "何时使用此技能",
  "base_url": "https://docs.example.com/",
  "selectors": {
    "main_content": "article",
    "title": "h1",
    "code_blocks": "pre code"
  },
  "url_patterns": {
    "include": ["/docs", "/guide"],
    "exclude": ["/blog", "/about"]
  },
  "categories": {
    "getting_started": ["intro", "quickstart"],
    "api": ["api", "reference"]
  },
  "rate_limit": 0.5,
  "max_pages": 500
}
```

## 字段说明

### name（必需）
技能名称，用于生成输出目录和文件名。

### description（必需）
描述此技能的使用场景，帮助AI决定何时使用。

### base_url（文档网站必需）
文档网站的基础URL。

### selectors（可选）
CSS选择器用于内容提取。

| 字段 | 默认值 | 说明 |
|------|--------|------|
| main_content | article | 主内容区域 |
| title | h1 | 页面标题 |
| code_blocks | pre code | 代码块 |

### url_patterns（可选）
控制抓取哪些页面。

```json
"url_patterns": {
  "include": ["/docs", "/api"],
  "exclude": ["/blog", "/changelog"]
}
```

### categories（可选）
内容分类规则，用于组织参考文档。

```json
"categories": {
  "getting_started": ["intro", "quickstart", "installation"],
  "api": ["api", "reference", "endpoints"],
  "guides": ["guide", "tutorial", "how-to"],
  "best_practices": ["best-practices", "performance"]
}
```

### rate_limit（可选）
请求间隔（秒），默认0.5。

### max_pages（可选）
最大抓取页面数。

---

## 统一配置（多源）

用于同时抓取文档+GitHub+PDF。

```json
{
  "name": "myframework",
  "merge_mode": "rule-based",
  "sources": [
    {
      "type": "documentation",
      "base_url": "https://docs.myframework.com/",
      "max_pages": 200
    },
    {
      "type": "github",
      "repo": "owner/myframework",
      "code_analysis_depth": "c3x"
    },
    {
      "type": "pdf",
      "file": "./manual.pdf"
    }
  ]
}
```

### merge_mode
- `rule-based`: 基于规则的冲突检测
- `ai-based`: AI驱动的冲突解决

---

## 预设配置示例

预设位置: `configs/` 目录

### react.json
```json
{
  "name": "react",
  "description": "用于React前端框架开发",
  "base_url": "https://react.dev/",
  "selectors": {
    "main_content": "article",
    "title": "h1",
    "code_blocks": "pre code"
  },
  "url_patterns": {
    "include": ["/learn", "/reference"],
    "exclude": ["/blog"]
  },
  "categories": {
    "getting_started": ["installation", "quick-start"],
    "core_concepts": ["components", "props", "state"],
    "hooks": ["useState", "useEffect", "custom-hooks"],
    "api": ["reference"]
  },
  "rate_limit": 0.5,
  "max_pages": 500
}
```

---

## 验证配置

```bash
# 验证配置语法
skill-seekers validate configs/myconfig.json

# 估算页面数
skill-seekers estimate --config configs/myconfig.json
```
