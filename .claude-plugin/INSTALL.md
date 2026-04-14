# AIRules 安装指南 (Claude Code)

通过原生插件发现机制在 Claude Code 中启用 AIRules。

## 前置条件

- Claude Code CLI
- Git & Node.js

## 安装步骤

运行标准安装脚本（该脚本包含**自动依赖安装及环境校验**）：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm run rules:install -- --host claude
```

安装完成后，脚本会自动输出验证报告。如果报告显示 `✅ claude 验证通过`，则表示安装成功，只需重启 Claude Code 即可。

## 更新 (Update)

```bash
npm run rules:install -- --host claude
```

## 卸载 (Uninstall)

```bash
npm run rules:install -- --host claude --mode uninstall
```
