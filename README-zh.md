# Moluoxixi AIRules (个人 AI 开发规则集)

Moluoxixi AIRules 是基于 Superpowers 架构开发的个人 AI 开发工作流与技能分发版。它提供了一套可组合的“技能”，旨在将你的 AI 代理提升为具备专业工程思维的协作伙伴。

## 工作原理

AIRules 不仅仅是代码片段的集合，它是一套系统性的 AI 辅助开发方法论。从最初的设计阶段到子代理驱动的实现，再到 TDD（测试驱动开发）验证，AIRules 确保你的 AI 代理始终遵循专业的工程标准。

当 AI 代理接收到任务时，它不会直接盲目写代码，而是先进入头脑风暴阶段，制定详细的实施计划，并通过严格的测试和审查阶段逐步推进任务。

## 安装指南

AIRules 以原生插件和市场扩展的形式进行分发。

### Claude Code
注册市场并安装插件：

```bash
/plugin marketplace add moluoxixi/AIRules
/plugin install moluoxixi-ai-rules@AIRules
```

### Cursor
在 Cursor Agent 聊天中添加插件：

```text
/add-plugin https://github.com/moluoxixi/AIRules
```

### OpenCode
在 `opencode.json` 中添加插件配置：

```json
{
  "plugin": ["moluoxixi@git+https://github.com/moluoxixi/AIRules.git"]
}
```

**详细内容:** [docs/README.opencode.md](docs/README.opencode.md)

### Codex / 其他代理
直接告诉你的 AI 代理：

```text
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

**详细内容:** [docs/README.codex.md](docs/README.codex.md)

## 核心技能

1. **frontend-workflow** - 针对现代前端开发的专业工作流，强调组件规范和状态管理。
2. **skill-creator-pro** - 用于在该分发版中设计、编写和测试新技能的元技能（Meta-skill）。
3. **skill-seekers** - 根据当前上下文自动发现并加载相关的技能。

## 开发哲学

- **个性化工作流**：反映特定工程审美和项目需求的量身定制规则。
- **系统化胜过随机性**：每一次代码变更都应遵循计划并通过测试。
- **发现优先**：技能由环境自然发现并按需加载，无需繁琐的手动配置。

## 许可证

MIT
