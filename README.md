# Moluoxixi AI Rules

基于 [obra/superpowers](https://github.com/obra/superpowers) 扩展的个人 AI 规则仓库。

目标：

- 先安装 `superpowers`
- 再叠加自己的 `rules`、`skills`、`agents`
- 同时支持 Claude 和 Codex
- 对可复用的第三方 skills 采用 `git clone` / `git pull` 的方式管理
- 最终统一落在 `~/.moluoxixi/` 目录下

## 目录说明

```text
repo/
  .claude/                  Claude 安装与升级文档
  .codex/                   Codex 安装与升级文档及全局 AGENTS
  agents/                   第一方 agents
  manifests/                vendor 仓库与链接映射
  rules/                    第一方规则
  skills/                   第一方自定义 skills
  scripts/                  vendor 同步与软链接重建脚本
  tests/                    脚本与文档的最小验证
```

## 安装后的目标结构

```text
~/.moluoxixi/
  vendors/
    superpowers/
    anthropic-skills/
    vercel-skills/
    vercel-labs-skills/
    gemini-skills/
    react-skills/
    awesome-llm-apps/
  rules/
  skills/
  agents/
```

其中：

- `vendors/` 保存第三方仓库真实 clone
- `skills/` 暴露最终启用的 skills
- `rules/` 与 `agents/` 由本仓库直接维护

## 当前范围

第一阶段包含：

- Claude / Codex 安装升级文档
- `~/.moluoxixi` 目录模型
- vendor manifest
- 软链接重建脚本
- 常见技术栈规则骨架
- 第一方 skills 骨架

## 参考来源

- `superpowers`
- `everything-claude-code`
- Trae 推荐技能清单

后续会继续补充更完整的规则细节、安装脚本和自动化验证。
