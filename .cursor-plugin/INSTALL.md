# Moluoxixi Skills 安装指南 (Cursor)

## 前置条件

- 已安装 Cursor

## 安装指令

在 Cursor Agent 聊天中直接添加插件：

```text
/add-plugin https://github.com/moluoxixi/AIRules
```

或者克隆仓库后，运行标准安装脚本：

```bash
git clone https://github.com/moluoxixi/AIRules.git ~/.moluoxixi
cd ~/.moluoxixi
npm install
npm run setup -- --host cursor --mode install
```
