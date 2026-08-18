# Moluoxixi AIRules

AIRules 为支持的 AI 编程宿主安装 skills 与角色资产。

> npm 的 `latest` 版本可能落后于仓库。下面的提示词会从源码安装当前版本。

## 从源码安装

首次执行以下命令即可安装最新的 Moluoxixi 角色，并注册 `airules` 命令：

```bash
git clone https://github.com/moluoxixi/AIRules.git
cd AIRules
npm install
npm run build
npm link
airules install moluoxixi --host all
```

安装 Matt 角色时，将 `moluoxixi` 替换为 `matt`。后续更新只需执行 `airules install <role> --host all`；安装和验证角色前会先快进更新干净的源码 checkout。

## Moluoxixi 角色

Moluoxixi 角色用于安装 `init-project` skill、CodeGraph、相关 MCP 配置，以及 Matt Pocock 的生产率 skills。

### 使用 AI 安装

将下面的提示词复制给你的 AI 编程助手：

```text
请在这台机器上通过 AIRules 安装 Moluoxixi 角色。

1. 检查 Node.js 22 或更高版本、npm 和 Git 是否可用。
2. 确定我的用户根目录，将 https://github.com/moluoxixi/AIRules.git 克隆到 `<用户根目录>/AIRules`。不要克隆到业务项目中，也不要克隆为 `<用户根目录>/.moluoxixi`。
3. 进入 `<用户根目录>/AIRules`。
4. 依次执行 `npm install`、`npm run build` 和 `npm link`。
5. 执行 `airules --version`，确认安装的版本为 0.2.0 或更高版本。
6. 安装前，先告知我 AIRules 会先对干净的 Git checkout 执行 `git pull --ff-only`，再把 Moluoxixi 资产和 Matt Pocock 生产率 skills 写入 `<用户根目录>/.moluoxixi`、`<用户根目录>/.agents/skills` 以及受支持的 AI 宿主配置目录。角色安装是用户级操作，不需要在业务项目中执行。
7. 得到我确认后，执行 `airules install moluoxixi --host all`。
8. 安装命令会自动验证结果；请报告安装版本、已更新的宿主、实际写入目录和所有错误。

不要使用 sudo，不要传入 `--skip-vendors` 或 `--no-verify`，不要删除或覆盖不由 AIRules 管理的文件。
```

### 用法

安装或更新角色：

```bash
airules install moluoxixi --host all
```

不重新安装，仅再次验证：

```bash
airules verify moluoxixi --host all
```

角色安装是用户级操作，可以在 `<用户根目录>/AIRules` 中执行。初始化项目时，先进入目标业务项目，再在 AI 编程宿主中调用 `init-project` skill。

## Matt 角色

Matt 角色用于安装 `mattpocock/skills` 中的全部工程化与生产率 skills，并固定到角色清单记录的上游 revision。

### 使用 AI 安装

将下面的提示词复制给你的 AI 编程助手：

```text
请在这台机器上通过 AIRules 安装 Matt 角色。

1. 检查 Node.js 22 或更高版本、npm 和 Git 是否可用。
2. 确定我的用户根目录，将 https://github.com/moluoxixi/AIRules.git 克隆到 `<用户根目录>/AIRules`。不要克隆到业务项目中，也不要克隆为 `<用户根目录>/.moluoxixi`。
3. 进入 `<用户根目录>/AIRules`。
4. 依次执行 `npm install`、`npm run build` 和 `npm link`。
5. 执行 `airules --version`，确认安装的版本为 0.2.0 或更高版本。
6. 安装前，先告知我 AIRules 会先对干净的 Git checkout 执行 `git pull --ff-only`，再克隆固定 revision 的 Matt Pocock skills，并将工程化与生产率 skills 写入 `<用户根目录>/.moluoxixi`、`<用户根目录>/.agents/skills` 以及受支持的 AI 宿主目录。
7. 得到我确认后，执行 `airules install matt --host all`。
8. 安装命令会自动验证结果；请报告安装版本、已更新的宿主、实际写入目录和所有错误。

不要使用 sudo，不要传入 `--skip-vendors` 或 `--no-verify`，不要删除或覆盖不由 AIRules 管理的文件。
```

### 用法

安装或更新角色：

```bash
airules install matt --host all
```

不重新安装，仅再次验证：

```bash
airules verify matt --host all
```

## 查看版本

```bash
airules --version
```

English documentation: [README.md](README.md)

## 许可证

MIT
