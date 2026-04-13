# 快速参考卡

## 一句话命令

```bash
# 创建技能（自动检测来源）
skill-seekers create <url|repo|path|pdf>

# 从预设创建
skill-seekers create <source> -p quick|standard|comprehensive

# 打包为Claude技能
skill-seekers package <skill-dir> --target claude

# 一键创建+上传
skill-seekers install --config <name>
```

---

## 场景1：文档网站 → AI技能

```bash
skill-seekers create https://docs.react.dev/
skill-seekers package output/react/ --target claude
# 上传或复制到项目
```

---

## 场景2：GitHub仓库 → AI技能

```bash
skill-seekers create facebook/react
skill-seekers package output/react/ --target claude
```

---

## 场景3：本地代码库 → AI技能

```bash
skill-seekers create ./my-django-project
skill-seekers analyze --directory ./my-django-project --comprehensive
```

---

## 场景4：PDF → RAG知识库

```bash
skill-seekers create manual.pdf
skill-seekers package output/manual --format langchain
# 或直接到向量数据库
skill-seekers package output/manual --format chroma --upload
```

---

## 场景5：Cursor AI上下文

```bash
skill-seekers create https://docs.django.com/
skill-seekers package output/django/ --target claude
cp output/django-claude/SKILL.md .cursorrules
```

---

## 场景6：团队共享配置

```bash
# 推送到团队仓库
skill-seekers config --github
skill-seekers push-config --source team-configs

# 团队成员拉取
skill-seekers fetch-config --source team-configs --name my-api
```

---

## 常用选项

| 选项 | 说明 |
|------|------|
| `--enhance-level 0-3` | AI增强级别（0=禁用） |
| `--enhance-workflow <name>` | 使用特定工作流 |
| `--async` | 异步加速 |
| `--workers 8` | 8个工作线程 |
| `--dry-run` | 预览不执行 |
| `--quick` | 快速分析 |
| `--comprehensive` | 完整分析 |

---

## AI增强模式

```bash
# API模式（需要ANTHROPIC_API_KEY）
skill-seekers create <source> --enhance-level 2

# LOCAL模式（使用Claude Code Max，免费）
skill-seekers create <source> --enhance-level 2
# 自动检测，无API Key时使用LOCAL

# 强制LOCAL
skill-seekers enhance <skill-dir> --mode LOCAL
```

---

## 输出格式速查

| 目标 | 命令 |
|------|------|
| Claude | `--target claude` |
| Gemini | `--target gemini` |
| OpenAI | `--target openai` |
| LangChain | `--format langchain` |
| LlamaIndex | `--format llama-index` |
| ChromaDB | `--format chroma` |
| FAISS | `--format faiss` |
| Markdown | `--target markdown` |

---

## 安装选项

```bash
# 基础
pip install skill-seekers

# 所有LLM平台
pip install skill-seekers[all-llms]

# MCP支持
pip install skill-seekers[mcp]

# 视频支持
pip install skill-seekers[video]

# 全部功能
pip install skill-seekers[all]
```

---

## 环境变量

```bash
export ANTHROPIC_API_KEY=sk-ant-...    # Claude
export GOOGLE_API_KEY=...               # Gemini
export OPENAI_API_KEY=sk-...           # OpenAI
export GITHUB_TOKEN=ghp_...            # GitHub（提速率限）
```

---

## 状态码

| 状态 | 说明 |
|------|------|
| ✅ | 成功 |
| ⚠️ | 警告/冲突检测 |
| ❌ | 失败 |
| ⏳ | 处理中 |
