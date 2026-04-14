# Moluoxixi AIRules (个人 AI 开发规则集)

Moluoxixi AIRules 是基于 Superpowers 架构开发的个人 AI 开发工作流与技能分发版。它提供了一套可组合的“技能”，旨在将你的 AI 代理提升为具备专业工程思维的协作伙伴。

## 工作原理

AIRules 不仅仅是代码片段的集合，它是一套系统性的 AI 辅助开发方法论。从最初的设计阶段到子代理驱动的实现，再到 TDD（测试驱动开发）验证，AIRules 确保你的 AI 代理始终遵循专业的工程标准。

当 AI 代理接收到任务时，它不会直接盲目写代码，而是先进入头脑风暴阶段，制定详细的实施计划，并通过严格的测试和审查阶段逐步推进任务。

## 安装指南 (Installation)

AIRules 采用**脚本驱动的全量安装模式**。请根据你使用的 AI 代理，直接让其读取对应的远程安装说明并按步骤操作：

### 1. Codex / 其他 (通用)
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md

### 2. Claude Code
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.claude-plugin/INSTALL.md

### 3. Cursor
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.cursor-plugin/INSTALL.md

### 4. Qoder
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.qoder/INSTALL.md

### 5. Tare
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.tare/INSTALL.md

### 6. OpenCode
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.opencode/INSTALL.md

---
> [!TIP]
> 所有的安装逻辑最终都会通过本地运行 `npm run setup` 来完成，确保 50+ 供应商技能的物理完整性。

## 核心技能

1. **frontend-workflow** - 针对现代前端开发的专业工作流，强调组件规范和状态管理。
2. **skill-creator-pro** - 用于在该分发版中设计、编写和测试新技能的元技能（Meta-skill）。
3. **skill-seekers** - 根据当前上下文自动发现并加载相关的技能。

## 开发哲学

 - **个性化工作流**：反映特定工程审美和项目需求的量身定制规则。
 - **系统化胜过随机性**：每一次代码变更都应遵循计划并通过测试。
 - **自愈式分发**：技能由脚本自动同步，并自动处理环境适配与链接自愈，无需手动维护。

## 许可证

MIT
