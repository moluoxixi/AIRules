# AIRules 安装指南 (Qoder)

在 Qoder 中启用 AIRules。

## 前置条件

- Qoder CLI
- Git & Node.js

## 安装步骤

1. **运行标准安装脚本：**
   ```bash
   git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
   cd ~/.moluoxixi
   npm install
   npm run setup -- --host qoder --mode install
   ```

2. **重启 Qoder**。

## 验证 (Verification)

运行以下命令查看已安装的技能：

```bash
ls -la ~/.qoder/skills/
```

## 更新 (Update)

```bash
cd ~/.moluoxixi && git pull && npm run setup -- --host qoder --mode install
```

## 卸载 (Uninstall)

```bash
npm run setup -- --host qoder --mode uninstall
```
