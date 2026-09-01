# Moluoxixi AIRules

AIRules distributes versioned AI skills, MCP configuration, and role-owned assets to supported coding hosts. Install the package once, then select the role that matches the workflow you want.

## Install

```bash
npm install --global moluoxixi-ai-rules
airules --version
```

Role installation is user-level. Project initialization commands should be run from the target project after the role is installed.

## `moluoxixi`

The main AIRules role. It combines shared coding, frontend, and productivity capabilities with role-local project initialization and publishable CLI packages.

```bash
airules install moluoxixi --host all
airules verify moluoxixi --host all
```

The role also publishes its own CLI package:

```bash
npm install --global @moluoxixi/airules-moluoxixi-cli
moluoxixi --version
```

Use `moluoxixi --help` to inspect the available project commands. Role assets live in [`roles/moluoxixi`](roles/moluoxixi).

## `matt`

Installs Matt Pocock's engineering and productivity skills without the project workflow or MCP assets included by the larger roles.

```bash
airules install matt --host all
airules verify matt --host all
```

Role assets live in [`roles/matt`](roles/matt).

## `trellis`

Installs the native Trellis project workflow together with shared coding, frontend, and productivity capabilities.

```bash
airules install trellis --host all
airules verify trellis --host all
```

After installation, initialize or update Trellis from the target project using the role's project initialization entrypoint. Role assets live in [`roles/trellis`](roles/trellis).

## Shared distribution

Roles declare reusable capabilities, and the shared registry composes the corresponding skills and MCP servers. See [capabilities/README.md](capabilities/README.md) for the complete mapping.

Canonical shared skills are installed in `~/.agents/skills`. Hosts that discover this directory directly do not receive duplicate copies in their private skill directories. MCP configuration remains host-specific.

## Repository migration

Preview a migration to another cloned repository:

```bash
node scripts/migrate-project.mjs <target-directory> --dry-run
```

Execute it after reviewing the paths:

```bash
node scripts/migrate-project.mjs <target-directory> --yes
node scripts/migrate-project.mjs <target-directory> --name <project-name> --yes
```

The default project name is `busyming`. Before copying, the target is cleared except for its root `.git`. The source repository remains unchanged; every `node_modules` directory, root `.github`, root `.claude`, `roles/trellis`, the migration script, and its test are excluded from the copy. The completed target contains neither Trellis paths nor Trellis text outside `.git`.

## Development

```bash
npm install
npm test
npm run typecheck
npm run lint:check
```

Chinese documentation: [README-zh.md](README-zh.md)

## License

MIT
