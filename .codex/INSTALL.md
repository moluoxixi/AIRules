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

## 验证

```bash
ls -la ~/.agents/skills/moluoxixi
```

你应该能看到一个指向 moluoxixi 技能目录的软链接（Windows 上为联接点）。

## 更新

```bash
cd ~/.moluoxixi && git pull
```

## 卸载

```bash
rm ~/.agents/skills/moluoxixi
```
