# Moluoxixi AIRules

AIRules 将带版本的 AI skills、MCP 配置和角色专属资产分发到受支持的编程宿主。只需安装一次 package，再选择符合目标工作方式的 role。

## 安装

```bash
npm install --global moluoxixi-ai-rules
airules --version
```

Role 安装在用户级目录。安装完成后，再从目标项目执行对应的项目初始化命令。

## `moluoxixi`

AIRules 的主角色。它组合公共的 coding、frontend 和 productivity capabilities，并提供角色专属的项目初始化能力和可发布 CLI package。

```bash
airules install moluoxixi --host all
airules verify moluoxixi --host all
```

该角色还发布独立 CLI package：

```bash
npm install --global @moluoxixi/airules-moluoxixi-cli
moluoxixi --version
```

使用 `moluoxixi --help` 查看可用的项目命令。角色资产位于 [`roles/moluoxixi`](roles/moluoxixi)。

## `matt`

安装 Matt Pocock 的 engineering 和 productivity skills，不包含较大角色提供的项目工作流或 MCP 资产。

```bash
airules install matt --host all
airules verify matt --host all
```

角色资产位于 [`roles/matt`](roles/matt)。

## `trellis`

安装原生 Trellis 项目工作流，以及公共的 coding、frontend 和 productivity capabilities。

```bash
airules install trellis --host all
airules verify trellis --host all
```

安装后，在目标项目中通过该角色的项目初始化入口初始化或更新 Trellis。角色资产位于 [`roles/trellis`](roles/trellis)。

## 公共分发机制

Role 只声明需要的公共 capabilities，由 registry 统一组合对应的 skills 与 MCP servers。完整映射见 [capabilities/README.md](capabilities/README.md)。

Canonical shared skills 安装到 `~/.agents/skills`。能够直接发现该目录的宿主不会在其私有 skills 目录中收到重复副本；MCP 配置仍按宿主分别管理。

## 仓库迁移

先预览迁移到另一个 clone 仓库的结果：

```bash
node scripts/migrate-project.mjs <target-directory> --dry-run
```

确认路径后执行迁移：

```bash
node scripts/migrate-project.mjs <target-directory> --yes
node scripts/migrate-project.mjs <target-directory> --name <project-name> --yes
node scripts/migrate-project.mjs <target-directory> --name <project-name> --repository-url <repository-url> --yes
```

默认项目名为 `busyming`。使用 `--repository-url` 可将本项目的 `https://github.com/moluoxixi/AIRules` 仓库链接（包括 `.git` 形式）替换为任意指定链接，其它链接保持不变。复制前会清空目标目录，仅保留目标根级 `.git`。源仓库保持不变；任意层级的 `node_modules`、根级 `.github`、根级 `.claude`、`roles/trellis`、迁移脚本及其测试不会被复制。完成后，目标 `.git` 之外不存在任何 Trellis 路径或文本。

## 开发

```bash
npm install
npm test
npm run typecheck
npm run lint:check
```

English documentation: [README.md](README.md)

## 许可证

MIT
