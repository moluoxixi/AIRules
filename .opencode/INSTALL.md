# Moluoxixi Skills 安装指南 (OpenCode)

## 前置条件

- 已安装 [OpenCode.ai](https://opencode.ai)

## 安装步骤

在你的 `opencode.json` (全局或项目级) 的 `plugin` 数组中添加 moluoxixi：

```json
{
  "plugin": ["moluoxixi@git+https://github.com/moluoxixi/AIRules.git"]
}
```

重启 OpenCode。大功告成 —— 插件会自动安装并注册所有技能。

### 手动安装 (本地开发)

克隆并运行安装脚本：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm install
npm run setup -- --host opencode --mode install
```

可以通过询问 “Tell me about your moluoxixi skills” 来验证。

## 更新

当你重启 OpenCode 时，技能会自动更新。

## 故障排除

使用 OpenCode 原生的 `skill` 工具可以列出已发现的技能。
