# Moluoxixi AIRules

AIRules distributes AI skills and host configuration through the `airules` CLI.

First-party skills, agents, hooks, and rules are synchronized from remote repositories as a complete role path. This repository does not embed role assets. The default role is empty; pass `--role <name>` to select a role explicitly.

## Install

```bash
npm install
npm run build
npm link
```

## CLI

```bash
airules sync --host all
airules sync --host all --role <name>
airules add ./my-skill --host all
airules verify --host all
```

- `sync` refreshes selected remote assets and projects them to supported hosts.
- `add` copies a directory containing `SKILL.md` into `~/.moluoxixi/local/skills/` and syncs it.
- `verify` checks managed host projections.
- `--skip-vendors` skips remote vendor refresh during `sync`.
- `--no-verify` skips post-sync host verification.

## Role hook manifest

Roles declare distributable hooks only through `roles/<role>/hooks/hooks.json`; scripts without a manifest are not enabled. Scripts must be regular `.mjs` files in the same directory, and event names may be overridden per host:

```json
{
  "version": 1,
  "hooks": [
    {
      "event": "Stop",
      "script": "workflow-dispatcher.mjs",
      "hosts": ["claude", "codex", "cursor"],
      "event_by_host": { "cursor": "stop" }
    }
  ]
}
```

Sync converts the manifest to each host's JSON or TOML shape, removes AIRules-managed entries that are no longer declared, preserves user hooks, and makes `verify` check script hashes and exact command structure.

## Maintenance

```bash
npm run typecheck
npm run build
npm run lint:check
npm test
```

`scripts/sync-vendors.ts` and `vendor-lock.json` are retained for vendor lock maintenance. Vendor synchronization is not run automatically before tests.

## License

MIT
