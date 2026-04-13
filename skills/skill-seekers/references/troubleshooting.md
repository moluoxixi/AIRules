# 故障排查指南

## 安装问题

### Python 未找到

**症状：**
```
python: command not found
```

**解决方案：**
```bash
# 检查 Python 版本
python3 --version

# 如果 Python 3.10+ 已安装但不在 PATH，添加到 PATH
export PATH="/usr/local/bin/python3:$PATH"

# 使用完整路径
/usr/local/bin/python3 -m pip install skill-seekers
```

### 模块未找到

**症状：**
```
ModuleNotFoundError: No module named 'skill_seekers'
```

**解决方案：**
```bash
# 确认已安装
pip list | grep skill-seekers

# 重新安装
pip install --upgrade skill-seekers

# 如果使用虚拟环境，确保已激活
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

### 权限拒绝

**症状：**
```
Permission denied: '/usr/local/lib/python3.x/site-packages'
```

**解决方案：**
```bash
# 使用用户安装
pip install --user skill-seekers

# 或使用虚拟环境（推荐）
python -m venv venv
source venv/bin/activate
pip install skill-seekers
```

### 依赖安装失败

**症状：**
```
ERROR: Could not build wheels for some-packages
```

**解决方案：**
```bash
# 更新 pip
pip install --upgrade pip

# 安装构建工具
# Ubuntu/Debian:
sudo apt install build-essential python3-dev

# macOS:
xcode-select --install

# Windows:
# 安装 Visual Studio Build Tools
```

## 运行时问题

### 文件未找到

**症状：**
```
FileNotFoundError: [Errno 2] No such file or directory: 'config.json'
```

**解决方案：**
```bash
# 检查文件是否存在
ls -la config.json

# 使用绝对路径
skill-seekers scrape --config /full/path/to/config.json

# 或从当前目录运行
cd /path/to/project
skill-seekers scrape --config config.json
```

### 配置文件未找到

**症状：**
```
ConfigError: Configuration file not found
```

**解决方案：**
```bash
# 验证配置文件语法
skill-seekers validate config.json

# 使用预设配置
skill-seekers list-configs
skill-seekers create https://docs.react.dev/ -p standard
```

### 命令未找到

**症状：**
```
skill-seekers: command not found
```

**解决方案：**
```bash
# 检查安装路径
pip show skill-seekers

# 使用 Python 模块方式运行
python -m skill_seekers create https://docs.react.dev/

# 或添加到 PATH（如果使用用户安装）
export PATH="$HOME/.local/bin:$PATH"
```

## 抓取问题

### 速度慢/挂起

**症状：** 抓取过程非常慢或长时间无响应

**解决方案：**
```bash
# 使用异步模式
skill-seekers create https://docs.example.com/ --async

# 增加工作线程数
skill-seekers create https://docs.example.com/ --workers 10

# 使用预设配置（quick 模式）
skill-seekers create https://docs.example.com/ -p quick

# 检查网络连接
ping docs.example.com
```

### 无内容提取

**症状：** 输出目录为空或内容不完整

**解决方案：**
```bash
# 检查 URL 是否可访问
curl -I https://docs.example.com/

# 使用不同的用户代理
skill-seekers create https://docs.example.com/ --user-agent "Mozilla/5.0"

# 检查网站是否有反爬虫机制
# 可能需要添加认证或 cookies
```

### 429 限速错误

**症状：**
```
HTTP 429: Too Many Requests
```

**解决方案：**
```bash
# 配置 GitHub Token（提高速率限制）
export GITHUB_TOKEN=ghp_xxx

# 使用多 Token 轮换
skill-seekers config --github

# 添加延迟
skill-seekers create https://docs.example.com/ --delay 2

# 使用速率限制策略
skill-seekers create https://docs.example.com/ --rate-limit strategy:wait
```

### SSL 证书错误

**症状：**
```
SSL: CERTIFICATE_VERIFY_FAILED
```

**解决方案：**
```bash
# 更新证书
# macOS:
/Applications/Python\ 3.x/Install\ Certificates.command

# Linux:
sudo apt install ca-certificates
sudo update-ca-certificates

# 临时禁用 SSL 验证（不推荐）
skill-seekers create https://docs.example.com/ --no-verify-ssl
```

## MCP 设置问题

### 服务器未加载

**症状：** Claude Code 或 Cursor 中 MCP 工具未显示

**解决方案：**
```bash
# 检查服务器是否运行
python -m skill_seekers.mcp.server_fastmcp

# 检查 Claude Code 配置
cat ~/.claude/claude_desktop_config.json

# 确保 MCP 服务器已正确安装
pip install skill-seekers[mcp]
```

### 占位符路径

**症状：** MCP 配置中使用 `/path/to/...` 占位符

**解决方案：**
```bash
# 替换占位符为实际路径
# 在 ~/.claude/claude_desktop_config.json 中：
{
  "mcpServers": {
    "skill-seekers": {
      "command": "python",
      "args": ["-m", "skill_seekers.mcp.server_fastmcp"],
      "env": {
        "PYTHONPATH": "/actual/path/to/skill-seekers"
      }
    }
  }
}
```

### 工具不工作

**症状：** MCP 工具调用失败或返回错误

**解决方案：**
```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY
echo $GOOGLE_API_KEY
echo $OPENAI_API_KEY

# 重新启动 MCP 服务器
# 在 Claude Code 中：Cmd+Shift+P → MCP: Restart Server

# 查看服务器日志
python -m skill_seekers.mcp.server_fastmcp --verbose
```

## GitHub 速率限制问题

**症状：**
```
GitHub API rate limit exceeded
```

**解决方案：**
```bash
# 配置 GitHub Token
export GITHUB_TOKEN=ghp_xxx

# 配置多个 Token
skill-seekers config --github

# 使用 GitHub 配置文件
skill-seekers github --repo owner/repo --profile my-profile

# 等待速率限制重置（通常 1 小时）
```

## 增强功能问题

### API Key 未设置

**症状：**
```
APIKeyError: ANTHROPIC_API_KEY not set
```

**解决方案：**
```bash
# 设置环境变量
export ANTHROPIC_API_KEY=sk-ant-xxx

# 或使用 LOCAL 模式（无需 API Key）
skill-seekers enhance output/skill --mode LOCAL
```

### LOCAL 模式不工作

**症状：** LOCAL 模式增强失败

**解决方案：**
```bash
# 确保已安装 Claude Code
claude --version

# 检查 Claude Code 配置
cat ~/.claude/claude_desktop_config.json

# 使用 API 模式作为备选
export ANTHROPIC_API_KEY=sk-ant-xxx
skill-seekers enhance output/skill --mode api
```

### 增强超时

**症状：** AI 增强过程超时

**解决方案：**
```bash
# 降低增强级别
skill-seekers enhance output/skill --level 1

# 使用后台运行
skill-seekers enhance output/skill --background

# 分批处理
skill-seekers enhance output/skill --mode api --level 2
```

## 平台特定问题

### macOS

**问题：** Apple Silicon GPU 未检测

**解决方案：**
```bash
# 检查 MPS 可用性
python -c "import torch; print(torch.backends.mps.is_available())"

# 重新运行 GPU 设置
skill-seekers video --setup

# 确保使用正确的 Python 架构
arch -arm64 python -m pip install skill-seekers[video-full]
```

### Linux

**问题：** 权限问题或系统依赖缺失

**解决方案：**
```bash
# 安装系统依赖
sudo apt install build-essential python3-dev tesseract-ocr ffmpeg

# 使用虚拟环境避免权限问题
python -m venv venv
source venv/bin/activate
pip install skill-seekers[all]
```

### Windows WSL

**问题：** GPU 加速不可用

**解决方案：**
```bash
# WSL2 不支持 GPU 直通，使用 Windows 原生 Python

# 或使用 CPU 模式
skill-seekers video --url <url> --name tutorial --whisper-model tiny
```

## 快速修复检查清单

遇到问题时，按以下顺序检查：

1. **版本检查**
   ```bash
   python --version  # 应该是 3.10+
   pip list | grep skill-seekers
   ```

2. **环境变量**
   ```bash
   echo $ANTHROPIC_API_KEY
   echo $GOOGLE_API_KEY
   echo $OPENAI_API_KEY
   echo $GITHUB_TOKEN
   ```

3. **网络连接**
   ```bash
   ping docs.example.com
   curl -I https://docs.example.com/
   ```

4. **依赖完整性**
   ```bash
   pip install --upgrade skill-seekers[all]
   ```

5. **配置文件**
   ```bash
   skill-seekers validate config.json
   ```

6. **权限**
   ```bash
   ls -la output/
   ```

7. **磁盘空间**
   ```bash
   df -h
   ```

## 验证命令集

使用以下命令诊断问题：

```bash
# 基本安装检查
skill-seekers --version

# 依赖检查
pip check

# 配置验证
skill-seekers validate config.json

# 列出预设
skill-seekers list-configs

# 测试基本功能
skill-seekers create https://docs.python.org/ --name test --dry-run

# GPU 检查（视频功能）
skill-seekers video --setup

# MCP 服务器测试
python -m skill_seekers.mcp.server_fastmcp --help

# 查看详细日志
skill-seekers create https://docs.example.com/ --verbose
```

## 获取帮助

如果以上方法都无法解决问题：

1. 查看完整错误日志
   ```bash
   skill-seekers create https://docs.example.com/ --verbose --debug
   ```

2. 检查 GitHub Issues
   - 搜索类似问题
   - 创建新 Issue（包含完整错误信息和环境）

3. 提供环境信息
   ```bash
   python --version
   pip list | grep -E "skill-seekers|torch|transformers"
   uname -a  # Linux/macOS
   ```
