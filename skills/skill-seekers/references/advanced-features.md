# 高级功能

## 云存储集成

### AWS S3
```bash
skill-seekers cloud upload --provider s3 --bucket my-skills output/react.zip
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
```

### Google Cloud Storage
```bash
skill-seekers cloud upload --provider gcs --bucket my-skills output/react.zip
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### Azure Blob
```bash
skill-seekers cloud upload --provider azure --container my-skills output/react.zip
export AZURE_STORAGE_CONNECTION_STRING=xxx
```

---

## 视频提取

```bash
# 安装依赖
pip install skill-seekers[video-full]
skill-seekers video --setup  # 自动检测GPU

# YouTube
skill-seekers video --url https://youtube.com/watch?v=xxx --name tutorial --visual

# 本地视频
skill-seekers video --video-file recording.mp4 --name demo

# 裁剪片段
skill-seekers video --url <url> --start-time 1:30 --end-time 5:00
```

---

## 冲突检测

统一抓取时自动检测文档与代码的差异：

```bash
# 创建统一配置
skill-seekers unified --config configs/myframework_unified.json
```

**检测类型：**
| 类型 | 说明 |
|------|------|
| 🔴 代码中缺失 | 已文档化但未实现 |
| 🟡 文档中缺失 | 已实现但未文档化 |
| ⚠️ 签名不匹配 | 参数/类型不同 |

---

## CI/CD 集成

### Docker
```dockerfile
FROM python:3.10-slim
RUN pip install skill-seekers
WORKDIR /data
CMD ["skill-seekers", "scrape", "--config", "/data/config.json"]
```

```bash
docker run -v $(pwd):/data skill-seekers scrape --config /data/config.json
```

### GitHub Actions
```yaml
- name: Update skill
  run: |
    skill-seekers create https://docs.framework.com/
    skill-seekers package output/framework --target claude
    cp output/framework-claude/SKILL.md .cursorrules
```

---

## 速率限制管理

### 多 Token 配置

```bash
# 交互式配置（推荐）
skill-seekers config --github

# 使用指定配置文件
skill-seekers github --repo mycompany/private-repo --profile work

# CI/CD 模式（无交互，快速失败）
skill-seekers github --repo owner/repo --non-interactive
```

### 四种速率限制策略

| 策略 | 行为 | 适用场景 |
|------|------|----------|
| `prompt`（默认） | 限速时询问用户：等待/切换/设置Token/取消 | 交互式使用 |
| `wait` | 自动等待并显示倒计时（遵守超时设置） | 耐心等待 |
| `switch` | 自动切换到下一个可用配置文件 | 多账号设置 |
| `fail` | 立即失败并输出清晰错误信息 | CI/CD 流水线 |

### 配置示例

```json
{
  "profiles": {
    "personal": {
      "token": "ghp_xxx",
      "rate_limit_strategy": "prompt",
      "timeout_minutes": 30
    },
    "work": {
      "token": "ghp_yyy",
      "rate_limit_strategy": "wait",
      "timeout_minutes": 60
    }
  }
}
```

配置文件位置：`~/.config/skill-seekers/config.json`（权限 600）

---

## Bootstrap（自举）

将 skill-seekers 自身转为 Claude Code 技能，实现自我文档化。

```bash
# 生成技能
./scripts/bootstrap_skill.sh

# 安装到 Claude Code
cp -r output/skill-seekers ~/.claude/skills/
```

**生成内容：**
- 完整的技能文档（SKILL.md）
- CLI 命令参考
- 快速入门示例和常见工作流
- 自动生成的 API 文档（代码分析、模式、示例）

---

## 增量更新

```bash
# 检查变化
skill-seekers sync --source <url> --target output/skill/ --check-changes

# 执行更新
skill-seekers update --skill output/skill/ --check-changes
```

---

## 质量度量

```bash
skill-seekers quality --skill output/react/ --report
```

---

## llms.txt 自动检测

抓取文档网站时，系统会自动检测站点是否提供 LLM 友好的文档文件：

**检测顺序：**
1. `llms-full.txt` — 完整版 LLM 文档
2. `llms.txt` — 标准版 LLM 文档
3. `llms-small.txt` — 精简版 LLM 文档

**优势：**
- 比传统网页抓取快 **10 倍**
- 内容已针对 LLM 优化，质量更高
- 自动跳过不必要的页面抓取

```bash
# 自动检测（无需额外配置）
skill-seekers create https://docs.example.com/
# 如果站点提供 llms.txt，将自动使用
```

---

## 私有 Git 配置仓库

通过 Git 仓库共享和管理团队配置文件。

### 支持的平台

| 平台 | Token 环境变量 |
|------|---------------|
| GitHub | `GITHUB_TOKEN` |
| GitLab | `GITLAB_TOKEN` |
| Gitea | `GITEA_TOKEN` |
| Bitbucket | `BITBUCKET_TOKEN` |

### 使用方式

```bash
# 注册团队配置仓库
skill-seekers config add-source \
  --name team \
  --git-url https://github.com/mycompany/skill-configs.git \
  --token-env GITHUB_TOKEN

# 从团队仓库获取配置
skill-seekers fetch-config --source team --name internal-api

# 列出已注册的配置源
skill-seekers config list-sources

# 删除配置源
skill-seekers config remove-source --name team
```

### 特性

- **智能缓存**：首次克隆后自动拉取更新
- **离线模式**：网络不可用时使用缓存配置
- **优先级解析**：CLI 参数 > 环境变量 > 配置文件 > 提示输入
- **团队协作**：3-5 人团队共享自定义配置
- **企业级**：支持 500+ 开发者的优先级解析
