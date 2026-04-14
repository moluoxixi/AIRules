# AIRules 安装指南 (Qoder)

在 Qoder 中启用 AIRules。

## 前置条件

- Qoder
- Git & Node.js

## 安装步骤

运行标准安装脚本（该脚本包含**自动依赖安装及环境校验**）：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm run rules:install -- --host qoder
```

安装完成后，脚本会自动输出验证报告。如果报告显示 `✅ qoder 验证通过`，则表示安装成功，只需重启 Qoder 即可。

## 更新 (Update)

```bash
npm run rules:install -- --host qoder
```

## 卸载 (Uninstall)

```bash
npm run rules:install -- --host qoder --mode uninstall
```
