# 安装指南

## 环境要求

- **Python**: 3.10 或更高版本
- **Git**: 用于从 GitHub 仓库抓取代码
- **操作系统**: macOS, Linux, Windows (WSL)

## 基础安装

```bash
pip install skill-seekers
```

## 安装向导（推荐新用户）

```bash
skill-seekers-setup
```

交互式向导会引导你完成安装选项选择、环境变量配置和功能验证。

## 可选安装包（Extras）

Skill Seekers 提供了多个可选依赖包，根据你的需求选择性安装：

| 安装命令 | 功能说明 |
|---------|---------|
| **LLM 平台** | |
| `skill-seekers[gemini]` | Google Gemini 支持 |
| `skill-seekers[openai]` | OpenAI ChatGPT 支持 |
| `skill-seekers[minimax]` | MiniMax AI 支持（使用 OpenAI 兼容 API） |
| `skill-seekers[all-llms]` | 所有 LLM 平台（Gemini + OpenAI） |
| **MCP 服务器** | |
| `skill-seekers[mcp]` | MCP 服务器（27个工具） |
| **视频处理** | |
| `skill-seekers[video]` | YouTube/Vimeo 转录和元数据提取（轻量，~15MB） |
| `skill-seekers[video-full]` | Whisper 转录 + 视觉帧提取（完整视频功能） |
| **文档格式** | |
| `skill-seekers[docx]` | Word 文档（.docx）支持 |
| `skill-seekers[epub]` | EPUB 电子书支持 |
| `skill-seekers[jupyter]` | Jupyter Notebook 支持 |
| `skill-seekers[pptx]` | PowerPoint 支持 |
| `skill-seekers[asciidoc]` | AsciiDoc 文档支持 |
| **平台集成** | |
| `skill-seekers[confluence]` | Confluence wiki 支持 |
| `skill-seekers[notion]` | Notion 页面支持 |
| `skill-seekers[rss]` | RSS/Atom feed 支持 |
| `skill-seekers[chat]` | Slack/Discord 聊天导出支持 |
| `skill-seekers[haystack]` | Haystack RAG 框架支持 |
| **云存储** | |
| `skill-seekers[s3]` | AWS S3 云存储 |
| `skill-seekers[gcs]` | Google Cloud Storage |
| `skill-seekers[azure]` | Azure Blob Storage |
| `skill-seekers[all-cloud]` | 所有云存储提供商 |
| **RAG 向量数据库上传** | |
| `skill-seekers[chroma]` | ChromaDB 向量数据库 |
| `skill-seekers[weaviate]` | Weaviate 向量数据库 |
| `skill-seekers[pinecone]` | Pinecone 向量数据库 |
| `skill-seekers[sentence-transformers]` | 句子嵌入模型 |
| `skill-seekers[rag-upload]` | 所有 RAG 向量数据库上传 |
| **嵌入服务** | |
| `skill-seekers[embedding]` | 嵌入服务器（FastAPI + Sentence Transformers + Voyage AI） |
| **全部** | |
| `skill-seekers[all]` | 全部功能（不含 video-full 的重型原生依赖） |

### 常用组合示例

```bash
# 基础 + MCP 服务器
pip install skill-seekers[mcp]

# 完整视频功能
pip install skill-seekers[video-full]

# 全部 LLM 平台
pip install skill-seekers[all-llms]

# 完整安装（推荐）
pip install skill-seekers[all]
```

## GPU 设置（视频功能）

如果你使用视频提取功能，运行以下命令自动检测和配置 GPU：

```bash
skill-seekers video --setup
```

此命令会自动检测以下硬件：

- **NVIDIA CUDA**: 自动检测并配置 CUDA 支持
- **AMD ROCm**: 自动检测并配置 ROCm 支持
- **Apple Silicon**: 自动检测并配置 MPS 支持
- **CPU Fallback**: 如果未检测到 GPU，将使用 CPU（速度较慢）

## 系统依赖

### Tesseract OCR

用于视觉帧中的文字识别。

**Ubuntu/Debian:**
```bash
sudo apt install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
下载并安装 [Tesseract-OCR](https://github.com/UB-Mannheim/tesseract/wiki)

### FFmpeg

视频处理必需（通常随 `skill-seekers[video-full]` 自动安装）。

**Ubuntu/Debian:**
```bash
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

## 虚拟环境（推荐）

使用虚拟环境可以避免依赖冲突：

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 安装 skill-seekers
pip install skill-seekers[all]
```

## 环境变量配置

根据你使用的功能，配置相应的环境变量：

```bash
# Claude API（AI 增强功能）
export ANTHROPIC_API_KEY=sk-ant-xxx

# Google Gemini API
export GOOGLE_API_KEY=xxx

# OpenAI API
export OPENAI_API_KEY=sk-xxx

# GitHub Token（提高速率限制）
export GITHUB_TOKEN=ghp_xxx
```

### 永久配置（推荐）

将环境变量添加到你的 shell 配置文件中：

**macOS/Linux (zsh):**
```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-xxx' >> ~/.zshrc
echo 'export GOOGLE_API_KEY=xxx' >> ~/.zshrc
echo 'export OPENAI_API_KEY=sk-xxx' >> ~/.zshrc
echo 'export GITHUB_TOKEN=ghp_xxx' >> ~/.zshrc
source ~/.zshrc
```

**macOS/Linux (bash):**
```bash
echo 'export ANTHROPIC_API_KEY=sk-ant-xxx' >> ~/.bashrc
echo 'export GOOGLE_API_KEY=xxx' >> ~/.bashrc
echo 'export OPENAI_API_KEY=sk-xxx' >> ~/.bashrc
echo 'export GITHUB_TOKEN=ghp_xxx' >> ~/.bashrc
source ~/.bashrc
```

**Windows (PowerShell):**
```powershell
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-xxx', 'User')
[System.Environment]::SetEnvironmentVariable('GOOGLE_API_KEY', 'xxx', 'User')
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-xxx', 'User')
[System.Environment]::SetEnvironmentVariable('GITHUB_TOKEN', 'ghp_xxx', 'User')
```

## 验证安装

运行以下命令验证安装是否成功：

```bash
# 检查版本
skill-seekers --version

# 测试基本功能
skill-seekers create https://docs.python.org/ --name test

# 列出所有预设配置
skill-seekers list-configs

# 验证视频功能（如果已安装）
skill-seekers video --help
```

## 升级

```bash
pip install --upgrade skill-seekers
```

或升级到最新版本（包含所有 extras）：

```bash
pip install --upgrade skill-seekers[all]
```

## 卸载

```bash
pip uninstall skill-seekers
```

## 故障排查

如果遇到安装问题，请参考 [troubleshooting.md](troubleshooting.md) 文档。
