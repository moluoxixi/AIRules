# AIRules 安装指南 (OpenCode)

在 OpenCode 中启用 AIRules。

## 前置条件

- OpenCode CLI
- Git & Node.js

## 安装步骤

运行标准安装脚本（该脚本包含**自动依赖安装及环境校验**）：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm run rules:install -- --host opencode
```

安装完成后，脚本会自动输出验证报告。如果报告显示 `✅ opencode 验证通过`，则表示安装成功，只需重启 OpenCode 即可。

## 更新 (Update)

```bash
npm run rules:install -- --host opencode
```

## 卸载 (Uninstall)

```bash
npm run rules:install -- --host opencode --mode uninstall
```
