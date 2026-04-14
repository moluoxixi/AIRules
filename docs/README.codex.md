# Moluoxixi AIRules (Codex 版)

本指南介绍如何在 OpenAI Codex 中通过原生技能发现机制使用 Moluoxixi AIRules。

## 快速安装

直接告诉 Codex：

```
Fetch and follow instructions from https://raw.githubusercontent.com/moluoxixi/AIRules/refs/heads/main/.codex/INSTALL.md
```

## 手动安装

### 前置条件

- OpenAI Codex CLI
- Git

### 步骤

1. 运行标准安装脚本：
   ```bash
   git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
   cd ~/.moluoxixi
   npm install
   npm run setup -- --host codex --mode install
   ```

2. 重启 Codex。

### Windows

使用联接点（Junction）代替软链接：

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
cmd /c mklink /J "$env:USERPROFILE\.agents\skills\moluoxixi" "$env:USERPROFILE\.moluoxixi\skills"
```

## 工作模式

Codex 具有原生的技能发现功能 —— 它在启动时会扫描 `~/.agents/skills/` 目录。Moluoxixi 的技能通过该目录下的一个软链接对外可见备份。

## 更新

```bash
cd ~/.moluoxixi && git pull
```

## 故障排除

1. 验证软链接：`ls -la ~/.agents/skills/moluoxixi`
2. 重启 Codex —— 技能仅在启动时加载
