# Moluoxixi AIRules (OpenCode 版)

本指南介绍如何在 [OpenCode.ai](https://opencode.ai) 中使用 Moluoxixi AIRules。

## 安装 (Installation)

OpenCode 用户应采用**脚本驱动的全量安装模式**。这能确保 .opencode 目录下的技能软链接由系统自动管理且保持最新。

直接运行设置脚本：

**macOS / Linux / Git Bash：**

```bash
git clone https://github.com/moluoxixi/AIRules.git "$HOME/.moluoxixi"
cd "$HOME/.moluoxixi"
npm install
npm run setup -- --host opencode --mode install
```

**Windows PowerShell：**

```powershell
git clone https://github.com/moluoxixi/AIRules.git "$env:USERPROFILE\.moluoxixi"
cd "$env:USERPROFILE\.moluoxixi"
npm install
npm run setup -- --host opencode --mode install
```

安装完成后，重启 OpenCode。脚本会自动在 `~/.config/opencode/skills/`（或对应系统的配置目录）中建立软链接。

## 使用方法

### 查找技能

使用 OpenCode 原生的 `skill` 工具：

```
use skill tool to list skills
```

### 加载技能

```
use skill tool to load moluoxixi/frontend-workflow
```

## 更新

当你重启 OpenCode 时，Moluoxixi 会自动更新。

## 工作模式

该插件主要完成两件事：

1. **注入引导上下文 (Bootstrap)**：通过 `experimental.chat.system.transform` 钩子，为每次对话注入 Moluoxixi 的规则意识。
2. **注册技能目录**：通过 `config` 钩子告知 OpenCode 技能所在位置，无需手动建立软链接。

## 故障排除

1. 检查日志：`opencode run --print-logs "hello" 2>&1 | grep -i moluoxixi`
2. 验证 `opencode.json` 中的插件配置行是否正确
