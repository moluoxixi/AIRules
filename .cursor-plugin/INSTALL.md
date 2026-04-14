# AIRules 安装指南 (Cursor)

在 Cursor Agent 中启用 AIRules。

## 前置条件

- Cursor Desktop
- Git & Node.js

## 安装步骤

1. **运行标准安装脚本：**
   ```bash
   git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
   cd ~/.moluoxixi
   npm install
   npm run setup -- --host cursor --mode install
   ```

2. **重启 Cursor** (或刷新 Agent 窗口)。

## 验证 (Verification)

运行以下命令查看已安装的技能：

```bash
ls -la ~/.cursor/skills/
```

你应该能看到 `antfu`, `gemini`, `superpowers` 等技能。

## 更新 (Update)

```bash
cd ~/.moluoxixi && git pull && npm run setup -- --host cursor --mode install
```

## 卸载 (Uninstall)

```bash
npm run setup -- --host cursor --mode uninstall
```
