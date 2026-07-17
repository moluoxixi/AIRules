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

- Sync installs the complete role at `~/.moluoxixi/roles/moluoxixi` with rollback-safe replacement. The mandatory `~/.agents/skills` canonical layer is always synchronized and does not belong in role host allowlists. AIRules then projects canonical skills and any explicitly selected role-owned MCP configuration to supported optional hosts. The Moluoxixi role exposes one global skill, `init-project`, and owns the CodeGraph setup/MCP declaration; roleless sync does not install CodeGraph or modify MCP files.
- `init-project` owns the remaining role assets. It installs 15 project skills with unprefixed names such as `start`, `check`, and `channel`, the project runtime, and native agents, commands, hooks, plugins, extensions, and settings for 18 hosts. Host-specific sources remain independent under `assets/hosts/<host>`; only genuinely host-neutral skills, commands, and hooks live under `assets/shared`. Agent identities and commands use the `moluoxixi-*` namespace.
- `roles/moluoxixi` contains a curated role subset from `mindfold-ai/Trellis` `v0.6.7` commit `e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a`. Repository automation, package workspaces, tests, demos, release-only assets, backups, and upstream project migration history are intentionally omitted. Moluoxixi starts its own version line at `0.1.0`; the initializer uses adapted role assets and does not install or invoke the Trellis npm CLI.
- Runtime transport comes from the complete `roles/moluoxixi` path in the AIRules remote repository; the curated Trellis assets are excluded from the AIRules npm package. This sync entry becomes available after the branch is merged into the remote default branch.
- `sync` refreshes selected remote assets, synchronizes the mandatory Agent skills layer, intersects the public selectable-host registry with the selected role's host ID allowlist, projects canonical skills, runs selected role setup commands, and projects selected role MCP declarations where a host has an MCP contract. `hermes desktop` is accepted as an input alias for the canonical `hermes` host; `cc-switch` is not configured.
- `verify` strictly checks the mandatory Agent skills layer and checks AIRules-managed projections for selected optional hosts. Project-native agents, commands, hooks, plugins, extensions, and settings belong to project initializers and are left untouched by the common layer.
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

Remote revisions are declared by each role manifest and validated during sync; there is no second repository-level vendor lock path.

## License

AIRules public code is licensed under MIT.
