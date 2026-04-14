# Moluoxixi AIRules (Codex 版)

本指南介绍如何在 OpenAI Codex 中通过原生技能发现机制使用 Moluoxixi AIRules。

## 快速安装

## 安装引导

直接告诉 Codex 尝试下载脚本进行安装：

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

## 进阶安装

对于需要深度定制的用户，建议克隆代码仓库：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm install
npm run setup -- --host codex --mode install
```

## 工作模式

Codex 具有原生的技能发现功能 —— 它在启动时会扫描 `~/.codex/skills/` 目录。

在这一版本中，Moluoxixi 采用了**全扁平化插件模式**。运行安装脚本后，每一个独立的技能（如 `antfu`, `gemini` 等）都会直接以软链接的形式投影到 Codex 的技能目录中，确保最大程度的发现兼容性。

## 更新与自愈

```bash
npm run setup -- --host codex --mode install
```
该脚本不仅会更新技能，还会自动清理已失效或已从清单中移除的技能链接。

## 故障排除

1. 验证软链接状态：`ls -la ~/.codex/skills/`
2. 重启 Codex —— 技能仅在启动时加载一次
