# Moluoxixi AIRules

AIRules distributes AI skills and complete role assets through the `airules` CLI.

Role manifests ship with the package. At runtime, first-party assets are synchronized from remote repositories as a complete role path instead of being projected from the package's local role directory. Common mode selects no role by default; pass `--role <name>` to install one explicitly.

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

Select the `moluoxixi` role explicitly:

```bash
airules sync --host all --role moluoxixi
```

- Sync installs the complete role at `~/.moluoxixi/roles/moluoxixi` with rollback-safe replacement, then projects only AIRules-managed canonical skills to supported hosts. The role currently exposes one global skill: `init-project`.
- `init-project` owns the remaining role assets. It installs 15 project skills with unprefixed names such as `start`, `check`, and `channel`, together with the runtime and native Claude, Codex, Cursor, OMP, OpenCode, and Pi agents, commands, hooks, plugins, extensions, and settings.
- `roles/moluoxixi` contains a curated role subset from `mindfold-ai/Trellis` `v0.6.7` commit `e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a`. Repository automation, package workspaces, tests, demos, release-only assets, backups, and project-local `.trellis` history are intentionally omitted. The initializer uses migrated role assets and does not install or invoke the Trellis npm CLI.
- Runtime transport comes from the complete `roles/moluoxixi` path in the AIRules remote repository; the curated Trellis assets are excluded from the AIRules npm package. This sync entry becomes available after the branch is merged into the remote default branch.
- Trellis remains licensed under the upstream AGPL-3.0-only license and is not covered by this repository's MIT license.

- `sync` refreshes selected remote assets and projects their canonical skills to supported hosts.
- `verify` checks only AIRules-managed skill projections. Host-native assets belong to project initializers and are left untouched by the common layer.
- `contract-diff` deterministically compares immutable OpenAPI 3.x JSON/YAML snapshots. Exit `0` has no blocking gap, `2` preserves a valid blocking-gap report, and `1` writes a structured error audit for invalid or unsupported input when a safe output path is available. It fails closed for OpenAPI wire semantics it cannot compare. File output uses an anchored create-only direct-write protocol: an existing target is idempotently reused only while it remains the exact baseline inode with the requested content, while an absent target is opened exclusively so every concurrent appearance fails. This protocol does not promise rename-style atomic visibility. Before semantic commit, a new file starts with `!` and is deliberately invalid JSON; a crash or concurrent read can leave or observe that incomplete file. Success is reported only after the invalid-marked payload is fully written and synced, protected inputs and the target inode are revalidated, the first byte is replaced with `{` and synced, and the pathname is confirmed to still name the created inode. Consumers must fail closed on JSON or schema validation, and the evidence owner must explicitly remove any invalid partial file before retrying.
- `contract-diff --capabilities` exposes the CLI version, audit report version, and exit-code contract as machine-readable JSON so remotely synchronized roles can reject an incompatible executable before analysis.
- `--skip-vendors` skips refresh only after validating the cached checkout origin, worktree, and any pinned revision; an unpinned complete remote role path must be refreshed.
- `--no-verify` skips post-sync host verification.

## Maintenance

```bash
npm run typecheck
npm run build
npm run lint:check
npm test
```

`scripts/sync-vendors.ts` and `vendor-lock.json` are retained for vendor lock maintenance. Vendor synchronization is not run automatically before tests.

## License

AIRules public code is licensed under MIT. The included third-party Trellis assets under `roles/moluoxixi` remain licensed upstream under AGPL-3.0-only; their source, revision, and license are recorded in `role.yaml`. AIRules-specific role adapter files remain under this repository's license.
