# 完整命令参考

## create（统一命令 - 推荐）

自动检测来源类型，一条命令搞定所有场景。

```bash
skill-seekers create <source> [选项]
```

**来源类型自动检测：**
- URL (http://, https://) → 文档网站
- owner/repo → GitHub仓库
- ./path → 本地目录
- *.pdf,*.epub → 文档文件

| 选项 | 说明 |
|------|------|
| `-p, --preset` | 预设模式: quick/standard/comprehensive |
| `--enhance-level 0-3` | AI增强级别（0=禁用） |
| `--enhance-workflow <name>` | 增强工作流（可多次使用） |
| `--dry-run` | 预览而不执行 |
| `--name <name>` | 指定技能名称 |
| `--output <path>` | 输出目录 |
| `--async` | 异步模式（更快） |
| `--workers <n>` | 异步工作线程数 |

---

## scrape（文档网站）

```bash
skill-seekers scrape --config <config.json>
skill-seekers scrape --url <url> --name <name>
```

---

## github（GitHub仓库）

```bash
skill-seekers github --repo <owner/repo> [选项]
```

| 选项 | 说明 |
|------|------|
| `--code-analysis-depth` | 分析深度: surface/basic/c3x |
| `--include-issues` | 包含Issues |
| `--max-issues <n>` | 最多Issues数 |
| `--profile <name>` | GitHub配置文件 |
| `--include-changelog` | 提取 CHANGELOG 和版本历史 |

---

## analyze（本地代码库）

```bash
skill-seekers analyze --directory <path> [选项]
```

| 选项 | 说明 |
|------|------|
| `--quick` | 快速分析（1-2分钟） |
| `--comprehensive` | 完整分析（20-60分钟） |
| `--enhance` | 启用AI增强 |
| `--skip-patterns` | 跳过模式检测 |
| `--skip-how-to-guides` | 跳过指南生成 |

---

## package（打包）

```bash
skill-seekers package <skill-dir> [选项]
```

| 选项 | 说明 |
|------|------|
| `--target` | LLM平台: claude/gemini/openai/markdown |
| `--format` | RAG格式: langchain/llama-index/haystack/chroma/faiss/qdrant/weaviate |
| `--upload` | 打包后上传 |

---

## enhance（AI增强）

```bash
skill-seekers enhance <skill-dir> [选项]
```

| 选项 | 说明 |
|------|------|
| `--mode api\|local` | 增强模式 |
| `--level 0-3` | 增强级别 |
| `--language <LANG>` | 输出语言，如 zh（中文）、en（英文）、ja（日文）、ko（韩文） |
| `--background` | 后台运行 |

---

## install（一键安装）

```bash
skill-seekers install --config <name> [--no-upload] [--dry-run]
```

---

## install-agent（安装到 AI Agent）

```bash
skill-seekers install-agent <skill-dir> --agent <agent-name>
```

| 选项 | 说明 |
|------|------|
| `--agent <name>` | 目标 Agent: cursor/claude-code/vscode/amp/goose/opencode/windsurf/all |
| `--dry-run` | 预览安装路径而不执行 |

**Agent 安装路径：**

| Agent | 路径 | 类型 |
|-------|------|------|
| Claude Code | `~/.claude/skills/` | 全局 |
| Cursor | `.cursor/skills/` | 项目级 |
| VS Code / Copilot | `.github/skills/` | 项目级 |
| Amp | `~/.amp/skills/` | 全局 |
| Goose | `~/.config/goose/skills/` | 全局 |
| OpenCode | `~/.opencode/skills/` | 全局 |
| Windsurf | `~/.windsurf/skills/` | 全局 |

---

## resume（断点续传）

```bash
skill-seekers resume --list                    # 列出可恢复的任务
skill-seekers resume <job_id>                   # 恢复指定任务
```

| 选项 | 说明 |
|------|------|
| `--list` | 列出所有可恢复的任务及进度 |
| `<job_id>` | 恢复指定任务（如 github_react_20260117_143022） |

自动保存进度（默认间隔 60 秒），自动清理过期任务（默认 7 天）。

---

## enhance-status（增强状态监控）

```bash
skill-seekers enhance-status <skill-dir> [--watch]
```

| 选项 | 说明 |
|------|------|
| `--watch` | 持续监控后台增强任务状态 |

---

## config（配置管理）

```bash
skill-seekers config [选项]
```

| 选项 | 说明 |
|------|------|
| `--github` | 配置 GitHub Token（支持多账号、多策略） |
| `--api-keys` | 配置 LLM API Key（Claude/Gemini/OpenAI） |
| `--show` | 显示当前配置 |

---

## 其他命令

```bash
skill-seekers list-configs              # 列出预设配置
skill-seekers estimate --config <file>   # 估算页面数
skill-seekers validate <config.json>     # 验证配置
skill-seekers video --url <url> --name <name>  # 视频提取
skill-seekers cloud upload --provider s3 --bucket <name> <file>  # 云存储
skill-seekers workflows list|show|copy|add|remove|validate  # 工作流管理
skill-seekers-setup                              # 交互式安装向导
```
