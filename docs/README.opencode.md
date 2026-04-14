# Moluoxixi AIRules (OpenCode 版)

本指南介绍如何在 [OpenCode.ai](https://opencode.ai) 中使用 Moluoxixi AIRules。

## 安装

在你的 `opencode.json` (全局或项目级) 的 `plugin` 数组中添加 moluoxixi：

```json
{
  "plugin": ["moluoxixi@git+https://github.com/moluoxixi/AIRules.git"]
}
```

或者使用本地安装脚本进行安装（推荐）：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm install
npm run setup -- --host opencode --mode install
```

重启 OpenCode。插件将通过 Bun 自动完成安装，并自动注册所有技能。

可以通过询问 “Tell me about your moluoxixi skills” 来验证。

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
