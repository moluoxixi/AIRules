# Moluoxixi AIRules

AIRules 为支持的 AI 编程宿主安装 skills 与角色资产。

> npm 的 `latest` 版本可能落后于仓库。下面的提示词会从源码安装当前版本。

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
6. 同步前，先告知我 AIRules 将把 Moluoxixi 资产和 Matt Pocock 生产率 skills 写入 `<用户根目录>/.moluoxixi`、`<用户根目录>/.agents/skills` 以及受支持的 AI 宿主配置目录。角色同步是用户级操作，不需要在业务项目中执行。
7. 得到我确认后，执行 `airules sync --host all --role moluoxixi`。
8. 执行 `airules verify --host all --role moluoxixi`，并报告安装版本、已更新的宿主、实际写入目录和所有错误。

不要使用 sudo，不要传入 `--skip-vendors` 或 `--no-verify`，不要删除或覆盖不由 AIRules 管理的文件。
```

### 用法

安装或更新角色：

```bash
airules sync --host all --role moluoxixi
```

验证安装结果：

```bash
airules verify --host all --role moluoxixi
```

角色同步是用户级操作，可以在 `<用户根目录>/AIRules` 中执行。初始化项目时，先进入目标业务项目，再在 AI 编程宿主中调用 `init-project` skill。

## Trellis 角色

Trellis 角色用于安装官方 Trellis CLI、`init-project` skill、默认的 CodeGraph、Context7、Sequential Thinking 和 Playwright MCP 服务，以及 Matt Pocock 的生产率 skills。

### 使用 AI 安装

将下面的提示词复制给你的 AI 编程助手：

```text
请在这台机器上通过 AIRules 安装 Trellis 角色。

1. 检查 Node.js 22 或更高版本、npm、Git 和 Python 3.9 或更高版本是否可用。
2. 确定我的用户根目录，将 https://github.com/moluoxixi/AIRules.git 克隆到 `<用户根目录>/AIRules`。不要克隆到业务项目中，也不要克隆为 `<用户根目录>/.moluoxixi`。
3. 进入 `<用户根目录>/AIRules`。
4. 依次执行 `npm install`、`npm run build` 和 `npm link`。
5. 执行 `airules --version`，确认安装的版本为 0.2.0 或更高版本。
6. 同步前，先告知我 AIRules 将安装官方 Trellis 和 CodeGraph CLI、将初始化和 Matt 生产率 skills 写入受支持的 AI 宿主目录，并把默认 MCP 服务合并到受支持的宿主配置。角色同步是用户级操作，不需要在业务项目中执行。
7. 得到我确认后，执行 `airules sync --host all --role trellis`。
8. 执行 `airules verify --host all --role trellis`，并报告安装版本、已更新的宿主、实际写入目录和所有错误。

不要使用 sudo，不要传入 `--skip-vendors` 或 `--no-verify`，不要删除或覆盖不由 AIRules 管理的文件。
```

### 用法

安装或更新角色：

```bash
airules sync --host all --role trellis
```

验证安装结果：

```bash
airules verify --host all --role trellis
```

角色同步是用户级操作，可以在 `<用户根目录>/AIRules` 中执行。初始化项目时，先进入目标业务项目，再调用 `init-project` skill，或直接执行：

```bash
trellis init -u <你的名字>
```

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
6. 同步前，先告知我 AIRules 将克隆固定 revision 的 Matt Pocock skills，并将工程化与生产率 skills 写入 `<用户根目录>/.moluoxixi`、`<用户根目录>/.agents/skills` 以及受支持的 AI 宿主目录。
7. 得到我确认后，执行 `airules sync --host all --role matt`。
8. 执行 `airules verify --host all --role matt`，并报告安装版本、已更新的宿主、实际写入目录和所有错误。

不要使用 sudo，不要传入 `--skip-vendors` 或 `--no-verify`，不要删除或覆盖不由 AIRules 管理的文件。
```

### 用法

安装或更新角色：

```bash
airules sync --host all --role matt
```

验证安装结果：

```bash
airules verify --host all --role matt
```

## 查看版本

```bash
airules --version
```

English documentation: [README.md](README.md)

## 许可证

MIT
