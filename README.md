# Moluoxixi AIRules

AIRules distributes AI skills and host configuration through the `airules` CLI.

Role manifests ship with the package. At runtime, first-party skills, agents, hooks, and rules are synchronized from remote repositories as a complete role path instead of being projected from the package's local role directory. The default role is `moluoxixi`; pass `--role <name>` to select another role explicitly.

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
airules verify --host all
airules --version
airules contract-diff --capabilities
airules contract-diff --expected <openapi.json|yaml> --actual <openapi.json|yaml> --output <audit.json>
```

Two peer installation roles are available, with neither selected by default:

```bash
airules sync --host all --role trellis-development
airules sync --host all --role superpowers-openspec-development
```

- `trellis-development` distributes a pinned Trellis installation skill; project initialization requires explicit license acceptance, platform, developer identity, and monorepo selection.
- `superpowers-openspec-development` distributes Superpowers skills from a pinned commit, provides a pinned local OpenSpec tool cache with safe ledger initialization, and composes six bounded, language-neutral OpenSpec specification Agents, including deterministic contract integration analysis between design and implementation planning.

- `sync` refreshes selected remote assets and projects them to supported hosts.
- `verify` checks managed host projections.
- `contract-diff` deterministically compares immutable OpenAPI 3.x JSON/YAML snapshots. Exit `0` has no blocking gap, `2` preserves a valid blocking-gap report, and `1` writes a structured error audit for invalid or unsupported input when a safe output path is available. It fails closed for OpenAPI wire semantics it cannot compare. File output uses an anchored create-only direct-write protocol: an existing target is idempotently reused only while it remains the exact baseline inode with the requested content, while an absent target is opened exclusively so every concurrent appearance fails. This protocol does not promise rename-style atomic visibility. Before semantic commit, a new file starts with `!` and is deliberately invalid JSON; a crash or concurrent read can leave or observe that incomplete file. Success is reported only after the invalid-marked payload is fully written and synced, protected inputs and the target inode are revalidated, the first byte is replaced with `{` and synced, and the pathname is confirmed to still name the created inode. Consumers must fail closed on JSON or schema validation, and the evidence owner must explicitly remove any invalid partial file before retrying.
- `contract-diff --capabilities` exposes the CLI version, audit report version, and exit-code contract as machine-readable JSON so remotely synchronized roles can reject an incompatible executable before analysis.
- `--skip-vendors` skips refresh only after validating the cached checkout origin, worktree, and any pinned revision; an unpinned complete remote role path must be refreshed.
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
      "support_files": ["workflow-hook-lib.mjs"],
      "hosts": ["claude", "codex", "cursor"],
      "event_by_host": { "cursor": "stop" }
    }
  ]
}
```

`support_files` declares same-directory `.mjs` helper modules imported by the main script; sync copies and verifies them without registering them as event commands. Sync converts the manifest to each host's JSON or TOML shape, removes AIRules-managed entries that are no longer declared, preserves user hooks, and makes `verify` check script hashes and exact command structure.

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
