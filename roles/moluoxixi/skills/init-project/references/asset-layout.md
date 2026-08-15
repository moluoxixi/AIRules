# Initializer Asset Layout

The `init-project` skill separates source ownership from generated project paths:

```text
assets/
  core/          reusable cross-host projection sources
  hosts/<host>/  host-owned native overlays
  project/       payload installed into every initialized project
  runtime/       project-local executable and bundled dependencies
scripts/
  core/          transactional installation and ownership engine
  hosts/         host catalog and output contracts
  migrations/    Moluoxixi-version migration engine
../../packages/
  core/          complete upstream core package plus local identity/runtime adaptation
  cli/           complete upstream CLI package plus AIRules role-local entrypoints
```

## Ownership Rules

- `assets/core` owns skills, command bodies, and hook implementations reused by multiple hosts. Core sources may inspect host context at runtime; `core` means one canonical cross-host source, not host-agnostic behavior.
- Bundled skill entrypoints use `SKILL.md.txt`; projection restores the standard `SKILL.md` name in generated host directories. This keeps template assets from being recursively discovered as skills inside the `init-project` package.
- `assets/hosts/<host>` owns native agents, settings, plugins, extensions, and host-specific wrappers. A host overlay may read `assets/core`, but it must not read another host's directory.
- `assets/project` owns the workflow, specs, Python scripts, managed root instructions, and other files installed for every selected host set.
- `../../packages` owns the complete upstream v0.6.15 package baseline, including source, tests, templates, migrations, package build files, and release helpers. Moluoxixi changes are limited to collision-resistant package identities, role-local entrypoints, and the channel/memory runtime contract.
- Both packages use collision-resistant scoped names and retain the upstream package boundary. They are publishable for consumers that need the SDK or standalone CLI. Role-only CLI entrypoints stay outside the npm tarball because they require the complete installed role; role installation and project initialization continue to use that local role and never require registry access.
- Package release versions advance together and may move independently of the synchronized upstream baseline when Moluoxixi publication metadata or adaptations change. Both manifests must identify `https://github.com/moluoxixi/AIRules` so npm provenance matches the publishing workflow repository.
- `pnpm test` retains the complete upstream package regression suite. `pnpm run test:publish` is the cross-platform publication gate for the Moluoxixi core SDK and adapted channel/memory/upgrade CLI surfaces; `pnpm run verify:publish` additionally runs build, package linting, type-resolution checks, exact workspace dependency rewriting, and tarball installation. `pnpm run publish:dry-run` then exercises both package lifecycle hooks and npm publication dry runs.
- `assets/runtime` owns the project-local Moluoxixi executable and bundled runtime dependencies. The updater and migration scripts are source-owned under `scripts/` and embedded below `.moluoxixi/runtime/update/init-project` during installation, so initialized projects remain self-contained without copying package source.
- `references` documents the initializer. Upstream parity belongs in `upstream-capability-map.md`; synchronization-preservation rules belong in `sync-preservation-contracts.json`; current output paths belong in `platforms.md`.

Hosts without an `assets/hosts/<host>` directory currently need only core skills and workflows. Their output paths are still declared in `scripts/hosts/catalog.mjs`.
