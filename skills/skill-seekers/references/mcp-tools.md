# MCP 服务器集成（27个工具）

## 概述

Skill Seekers 提供 MCP 服务器，可在 Claude Code、Cursor、Windsurf、VS Code + Cline、IntelliJ IDEA 中使用。

## 启动 MCP 服务器

```bash
# stdio 模式（Claude Code、VS Code + Cline）
python -m skill_seekers.mcp.server_fastmcp

# HTTP 模式（Cursor、Windsurf、IntelliJ）
python -m skill_seekers.mcp.server_fastmcp --transport http --port 8765

# 一次性自动配置所有代理
./setup_mcp.sh
```

## 核心工具（9个）

| 工具 | 功能 |
|------|------|
| `list_configs` | 列出预设配置 |
| `generate_config` | 从文档URL生成配置 |
| `validate_config` | 验证配置结构 |
| `estimate_pages` | 估算页面数 |
| `scrape_docs` | 抓取文档 |
| `package_skill` | 打包技能 |
| `upload_skill` | 上传到平台 |
| `enhance_skill` | AI增强 |
| `install_skill` | 完整工作流自动化 |

## 扩展工具（11个）

| 工具 | 功能 |
|------|------|
| `scrape_github` | GitHub仓库分析 |
| `scrape_pdf` | PDF提取 |
| `scrape_generic` | 通用抓取（支持10种新来源） |
| `unified_scrape` | 多源抓取 |
| `merge_sources` | 合并文档+代码 |
| `detect_conflicts` | 检测冲突 |
| `add_config_source` | 注册Git仓库配置源 |
| `fetch_config` | 获取配置 |
| `list_config_sources` | 列出配置源 |
| `remove_config_source` | 删除配置源 |
| `split_config` | 拆分大配置 |

**scrape_generic 支持的来源：** Jupyter、HTML、OpenAPI、AsciiDoc、PowerPoint、RSS、Man手册、Confluence、Notion、Slack/Discord

## 向量数据库工具（4个）

| 工具 | 功能 |
|------|------|
| `export_to_chroma` | 导出到 ChromaDB |
| `export_to_weaviate` | 导出到 Weaviate |
| `export_to_faiss` | 导出到 FAISS |
| `export_to_qdrant` | 导出到 Qdrant |

## 云存储工具（3个）

| 工具 | 功能 |
|------|------|
| `cloud_upload` | 上传到 S3/GCS/Azure |
| `cloud_download` | 从云存储下载 |
| `cloud_list` | 列出云存储文件 |

**总计：27个MCP工具**

---

## MCP 配置示例

### Claude Code (stdio)

```json
{
  "mcpServers": {
    "skill-seekers": {
      "command": "python",
      "args": ["-m", "skill_seekers.mcp.server_fastmcp"]
    }
  }
}
```

### Cursor/Windsurf (HTTP)

```json
{
  "mcpServers": {
    "skill-seekers": {
      "url": "http://localhost:8765"
    }
  }
}
```

---

## 在 AI 对话中使用

启用 MCP 服务器后，可以直接用自然语言：

```
"抓取 GitHub 仓库 facebook/react"
"为 React 文档创建技能"
"导出到 ChromaDB"
```
