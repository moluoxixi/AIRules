# AI 编程助手集成

## Cursor IDE

```bash
# 1. 创建并打包
skill-seekers create https://docs.fastapi.com/
skill-seekers package output/fastapi --target claude

# 2. 安装
cp output/fastapi-claude/SKILL.md .cursorrules

# 3. 重启Cursor
```

---

## Windsurf

```bash
skill-seekers create https://docs.django.com/
skill-seekers package output/django --target claude

mkdir -p .windsurf/rules
cp output/django-claude/SKILL.md .windsurf/rules/django.md
```

---

## Cline (VS Code)

```bash
skill-seekers create https://docs.pytest.org/
skill-seekers package output/pytest --target claude
cp output/pytest-claude/SKILL.md .clinerules
```

---

## Continue.dev（通用）

适用于 VS Code、JetBrains、Vim、Emacs。

```bash
# 1. 创建技能
skill-seekers create https://docs.sqlalchemy.org/
skill-seekers package output/sqlalchemy --target claude

# 2. 启动上下文服务器
python -m skill_seekers.cli.context_server --port 8765

# 3. 配置 ~/.continue/config.json
```

---

## 使用脚本安装

```bash
# 使用技能自带的安装脚本
./scripts/install-skill.sh output/react-claude
./scripts/install-skill.sh output/react-claude --target all
```

---

## CI/CD 自动更新

```yaml
# .github/workflows/update-skill.yml
name: Update Framework Skill
on:
  schedule:
    - cron: '0 0 * * 0'  # 每周
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install skill-seekers
      - run: |
          skill-seekers create https://react.dev/
          skill-seekers package output/react/ --target claude
          cp output/react-claude/SKILL.md .cursorrules
      - run: |
          git config user.name "CI Bot"
          git add -A
          git diff --exit-code || git commit -m "chore: update React skill"
```

---

## 一键安装到 AI Agent

```bash
# 安装到指定 Agent
skill-seekers install-agent output/react/ --agent cursor

# 安装到所有 Agent
skill-seekers install-agent output/react/ --agent all

# 预览安装路径
skill-seekers install-agent output/react/ --agent cursor --dry-run
```

### 支持的 Agent

| Agent | 安装路径 | 类型 |
|-------|---------|------|
| **Claude Code** | `~/.claude/skills/` | 全局 |
| **Cursor** | `.cursor/skills/` | 项目级 |
| **VS Code / Copilot** | `.github/skills/` | 项目级 |
| **Amp** | `~/.amp/skills/` | 全局 |
| **Goose** | `~/.config/goose/skills/` | 全局 |
| **OpenCode** | `~/.opencode/skills/` | 全局 |
| **Windsurf** | `~/.windsurf/skills/` | 全局 |