# Moluoxixi AIRules

AIRules installs AI skills and role assets for supported coding hosts.

> The npm `latest` release may lag behind the repository. The prompts below install the current version from source.

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
6. Before syncing, tell me that AIRules will write the Moluoxixi assets and Matt Pocock productivity skills to `<user-home>/.moluoxixi`, `<user-home>/.agents/skills`, and supported AI host configuration directories. The sync command is user-level and does not need to run inside a project.
7. After I confirm, run `airules sync --host all --role moluoxixi`.
8. Run `airules verify --host all --role moluoxixi` and report the installed version, updated hosts, written directories, and any errors.

Do not use sudo. Do not pass `--skip-vendors` or `--no-verify`. Do not delete or overwrite files that are not managed by AIRules.
```

### Usage

Install or update the role:

```bash
airules sync --host all --role moluoxixi
```

Verify the installation:

```bash
airules verify --host all --role moluoxixi
```

Role synchronization is user-level and can be run from `<user-home>/AIRules`. To initialize a project, enter the target project first, then invoke the `init-project` skill in your AI coding host.

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
6. Before syncing, tell me that AIRules will install the official Trellis and CodeGraph CLIs, write the initialization and Matt productivity skills to supported AI host directories, and merge the default MCP servers into supported host configurations. The sync command is user-level and does not need to run inside a project.
7. After I confirm, run `airules sync --host all --role trellis`.
8. Run `airules verify --host all --role trellis` and report the installed versions, updated hosts, written directories, and any errors.

Do not use sudo. Do not pass `--skip-vendors` or `--no-verify`. Do not delete or overwrite files that are not managed by AIRules.
```

### Usage

Install or update the role:

```bash
airules sync --host all --role trellis
```

Verify the installation:

```bash
airules verify --host all --role trellis
```

Role synchronization is user-level and can be run from `<user-home>/AIRules`. To initialize a project, enter the target project first, then invoke the `init-project` skill in your AI coding host or run:

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
6. Before syncing, tell me that AIRules will clone the pinned Matt Pocock skills revision and write engineering and productivity skills to `<user-home>/.moluoxixi`, `<user-home>/.agents/skills`, and supported AI host directories.
7. After I confirm, run `airules sync --host all --role matt`.
8. Run `airules verify --host all --role matt` and report the installed version, updated hosts, written directories, and any errors.

Do not use sudo. Do not pass `--skip-vendors` or `--no-verify`. Do not delete or overwrite files that are not managed by AIRules.
```

### Usage

Install or update the role:

```bash
airules sync --host all --role matt
```

Verify the installation:

```bash
airules verify --host all --role matt
```

## Version

```bash
airules --version
```

Chinese documentation: [README-zh.md](README-zh.md)

## License

MIT
