# Moluoxixi Skills 安装指南 (Codex)

通过原生技能发现机制在 Codex 中启用 Moluoxixi 技能。只需克隆并建立软链接。

## 前置条件

- Git

## 安装步骤

1. **运行标准安装脚本：**
   ```bash
   git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
   cd ~/.moluoxixi
   npm install
   npm run setup -- --host codex --mode install
   ```

3. **重启 Codex** (退出并重新启动 CLI) 以发现新技能。

## 验证 (Verification)

运行以下命令查看已安装的技能：

```bash
ls -la ~/.codex/skills/
```

你应该能看到 `antfu`, `code-reviewer`, `superpowers` 等技能以顶级软链接的形式存在。

## 更新 (Update)

```bash
cd ~/.moluoxixi && git pull && npm run setup -- --host codex --mode install
```

## 卸载 (Uninstall)

```bash
npm run setup -- --host codex --mode uninstall
# 或者手动删除安装目录和软链接：
# rm -rf ~/.moluoxixi
# rm -rf ~/.codex/skills/*
```
