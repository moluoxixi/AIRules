# AIRules 安装指南 (Codex)

在 Codex 中启用 AIRules。

## 前置条件

- Codex
- Git & Node.js

## 安装步骤

运行标准安装脚本（该脚本包含**自动依赖安装及环境校验**）：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm run rules:install -- --host codex
```

安装完成后，脚本会自动输出验证报告。如果报告显示 `✅ codex 验证通过`，则表示安装成功，只需重启 Codex 即可。

## 更新 (Update)

```bash
npm run rules:install -- --host codex
```

## 卸载 (Uninstall)

```bash
npm run rules:install -- --host codex --mode uninstall
```
