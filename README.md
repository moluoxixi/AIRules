# Moluoxixi AIRules

AIRules installs AI skills and role assets for supported coding hosts.

> The npm `latest` release may lag behind the repository. The prompts below install the current version from source.

## Install From Source

Run this once to install the current Moluoxixi role and expose the `airules` command:

```bash
git clone https://github.com/moluoxixi/AIRules.git
cd AIRules
npm install
npm run build
npm link
airules install moluoxixi --host all
```

Replace `moluoxixi` with `trellis` or `matt` to install another role. Later updates only require `airules install <role> --host all`; a clean source checkout is fast-forwarded before the role is installed and verified.

## Moluoxixi Role

The Moluoxixi role installs the `init-project` skill, CodeGraph, the related MCP configuration, and Matt Pocock's productivity skills.

### Install with AI

Copy this prompt into your AI coding assistant:

```text
Install the Moluoxixi role from AIRules on this machine.

1. Check that Node.js 22 or newer, npm, and Git are available.
2. Resolve my user home directory and clone https://github.com/moluoxixi/AIRules.git to `<user-home>/AIRules`. Do not clone it into a project or into `<user-home>/.moluoxixi`.
3. Enter `<user-home>/AIRules`.
4. Run `npm install`, `npm run build`, and `npm link`.
5. Run `airules --version` and confirm that version 0.2.0 or newer is installed.
6. Before installing, tell me that AIRules will first fast-forward its clean Git checkout with `git pull --ff-only`, then write the Moluoxixi assets and Matt Pocock productivity skills to `<user-home>/.moluoxixi`, `<user-home>/.agents/skills`, and supported AI host configuration directories. The install command is user-level and does not need to run inside a project.
7. After I confirm, run `airules install moluoxixi --host all`.
8. The install command verifies the result automatically. Report the installed version, updated hosts, written directories, and any errors.

Do not use sudo. Do not pass `--skip-vendors` or `--no-verify`. Do not delete or overwrite files that are not managed by AIRules.
```

### Usage

Install or update the role:

```bash
airules install moluoxixi --host all
```

Verify again without reinstalling:

```bash
airules verify moluoxixi --host all
```

Role installation is user-level and can be run from `<user-home>/AIRules`. To initialize a project, enter the target project first, then invoke the `init-project` skill in your AI coding host.

## Trellis Role

The Trellis role installs the official Trellis CLI, its `init-project` skill, the default CodeGraph, Context7, Sequential Thinking, and Playwright MCP servers, and Matt Pocock's productivity skills.

### Install with AI

Copy this prompt into your AI coding assistant:

```text
Install the Trellis role from AIRules on this machine.

1. Check that Node.js 22 or newer, npm, Git, and Python 3.9 or newer are available.
2. Resolve my user home directory and clone https://github.com/moluoxixi/AIRules.git to `<user-home>/AIRules`. Do not clone it into a project or into `<user-home>/.moluoxixi`.
3. Enter `<user-home>/AIRules`.
4. Run `npm install`, `npm run build`, and `npm link`.
5. Run `airules --version` and confirm that version 0.2.0 or newer is installed.
6. Before installing, tell me that AIRules will first fast-forward its clean Git checkout with `git pull --ff-only`, then install the official Trellis and CodeGraph CLIs, write the initialization and Matt productivity skills to supported AI host directories, and merge the default MCP servers into supported host configurations. The install command is user-level and does not need to run inside a project.
7. After I confirm, run `airules install trellis --host all`.
8. The install command verifies the result automatically. Report the installed versions, updated hosts, written directories, and any errors.

Do not use sudo. Do not pass `--skip-vendors` or `--no-verify`. Do not delete or overwrite files that are not managed by AIRules.
```

### Usage

Install or update the role:

```bash
airules install trellis --host all
```

Verify again without reinstalling:

```bash
airules verify trellis --host all
```

Role installation is user-level and can be run from `<user-home>/AIRules`. To initialize a project, enter the target project first, then invoke the `init-project` skill in your AI coding host or run:

```bash
trellis init -u <your-name>
```

## Matt Role

The Matt role installs all engineering and productivity skills from `mattpocock/skills`, pinned to the revision recorded in the role manifest.

### Install with AI

Copy this prompt into your AI coding assistant:

```text
Install the Matt role from AIRules on this machine.

1. Check that Node.js 22 or newer, npm, and Git are available.
2. Resolve my user home directory and clone https://github.com/moluoxixi/AIRules.git to `<user-home>/AIRules`. Do not clone it into a project or into `<user-home>/.moluoxixi`.
3. Enter `<user-home>/AIRules`.
4. Run `npm install`, `npm run build`, and `npm link`.
5. Run `airules --version` and confirm that version 0.2.0 or newer is installed.
6. Before installing, tell me that AIRules will first fast-forward its clean Git checkout with `git pull --ff-only`, then clone the pinned Matt Pocock skills revision and write engineering and productivity skills to `<user-home>/.moluoxixi`, `<user-home>/.agents/skills`, and supported AI host directories.
7. After I confirm, run `airules install matt --host all`.
8. The install command verifies the result automatically. Report the installed version, updated hosts, written directories, and any errors.

Do not use sudo. Do not pass `--skip-vendors` or `--no-verify`. Do not delete or overwrite files that are not managed by AIRules.
```

### Usage

Install or update the role:

```bash
airules install matt --host all
```

Verify again without reinstalling:

```bash
airules verify matt --host all
```

## Version

```bash
airules --version
```

Chinese documentation: [README-zh.md](README-zh.md)

## License

MIT

<!-- AIRULES:TRELLIS:START -->

## Trellis 工作流

本项目使用 Trellis 管理 AI 辅助开发流程。在本项目中使用 AI 编程助手时，可以直接发送以下提示词：

```text
请使用 Trellis 开始处理这个需求：<描述需求>
请使用 Trellis 继续当前任务。
请使用 Trellis 检查当前改动。
请使用 Trellis 完成本次工作。
```

AI 编程助手会根据当前宿主选择可用的命令或技能。项目的工作流、任务和规范状态位于 `.trellis/`。

将接口文档、业务说明等文本资料放入 `.trellis/knowledge/sources/`。AI 会在每次对话时检查内容差异，把资料按业务域和稳定实体整理到 `.trellis/knowledge/library/`，并更新 `.trellis/knowledge/index.md`；只有遇到会实质影响整理结果的歧义时才会询问。

<!-- AIRULES:TRELLIS:END -->
