# Moluoxixi AIRules

AIRules distributes AI skills, MCP configuration, and role assets for supported coding hosts.

## Install the package

Install the published package globally:

```bash
npm install --global moluoxixi-ai-rules
```

Check the installed CLI:

```bash
airules --version
```

## Install a role

Install or update a role for every supported host:

```bash
airules install moluoxixi --host all
```

Other available roles use the same package command:

```bash
airules install trellis --host all
airules install matt --host all
```

Verify an installed role without changing it:

```bash
airules verify moluoxixi --host all
```

Installation is user-level. Run project initialization commands from the target project after the role is installed.

## Moluoxixi package CLI

The Moluoxixi role publishes its own CLI package as `@moluoxixi/airules-moluoxixi-cli`:

```bash
npm install --global @moluoxixi/airules-moluoxixi-cli
moluoxixi --version
```

Use `moluoxixi --help` to see the commands included in the installed package.

## Shared skills

AIRules maintains canonical skills in `~/.agents/skills`. Codex, Cursor, Qoder, Trae, Trae CN, Trae Solo, Trae Solo CN, Hermes, and OpenCode discover that directory directly, so AIRules does not create duplicate skills in those hosts' private directories. MCP configuration remains host-specific.

## Role capabilities

Roles declare reusable capabilities, and the shared registry composes their skills and MCP servers:

| Role | Capabilities |
|---|---|
| `trellis` | `common`, `coding`, `productivity`, `frontend` |
| `moluoxixi` | `common`, `coding`, `productivity`, `frontend` |
| `matt` | `engineering`, `productivity` |

The `frontend` capability pins Anthropic's `frontend-design` skill and includes the Playwright MCP server. See [capabilities/README.md](capabilities/README.md) for the complete mapping.

## Version

```bash
airules --version
```

Chinese documentation: [README-zh.md](README-zh.md)

## License

MIT

<!-- AIRULES:TRELLIS:START -->

## Trellis workflow

This project uses Trellis for AI-assisted development. In an AI coding assistant, you can send:

```text
Use Trellis to start this request: <describe the request>
Use Trellis to continue the current task.
Use Trellis to check the current changes.
Use Trellis to finish this work.
```

Project workflow, task, and specification state is stored in `.trellis/`.

<!-- AIRULES:TRELLIS:END -->
