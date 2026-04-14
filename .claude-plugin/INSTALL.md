# Moluoxixi Skills 安装指南 (Claude)

## 前置条件

- 已安装 Git
- 已安装 Node.js
- Claude / Claude Code 运行正常

## 安装指令

### 市场安装 (推荐)

在 Claude Code 中，先注册插件市场：

```bash
/plugin marketplace add moluoxixi/AIRules
```

然后从该市场安装插件：

```bash
/plugin install moluoxixi-ai-rules@AIRules
```

### 手动安装 (推荐)

克隆仓库并运行标准安装脚本：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm install
npm run setup -- --host claude --mode install
```
