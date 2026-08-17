# Initializer Asset Layout

The `init-project` skill separates finalized package sources, role-local template
projection, and generated project state:

```text
../../packages/
  core/             finalized publishable core package
  cli/
    src/templates/  finalized base template source
../../overlays/
  manifest.json     source/overlay hashes and capability ownership
  packages/cli/src/templates/
    overrides/      replacements for matching base template paths
    additions/      Moluoxixi-only files projected beside base templates
assets/
  runtime/          project-local executable and bundled dependencies
scripts/
  core/             transactional installation and ownership engine
  hosts/            host catalog and output contracts
  migrations/       Moluoxixi-version migration engine
  templates.mjs     fail-closed package-template and overlay reader
```

## Ownership Rules

- `../../packages/cli/src/templates` is the only base template tree. The initializer reads it directly; it must never copy those templates beneath the `init-project` skill source.
- `../../overlays/packages/cli/src/templates/overrides` mirrors the package subtree it replaces. `../../overlays/packages/cli/src/templates/additions` contains files with no base counterpart. Every payload file is declared in `manifest.json` with capability ownership and SHA-256 integrity data.
- `scripts/templates.mjs` validates the base input hash, overlay hash, declaration completeness, and safe relative paths before any plan is built. Input drift fails closed.
- Both packages use collision-resistant scoped names and retain the upstream package boundary. They are publishable for SDK or standalone CLI consumers. Role-only CLI entrypoints stay outside the npm tarball because they require the complete installed role.
- Package release versions advance together and may move independently of the upstream package version. Both manifests identify `https://github.com/moluoxixi/AIRules` so npm provenance matches the publishing workflow repository.
- `pnpm test` retains the package regression suite. `pnpm run verify:publish` runs publication-focused tests, build, package linting, type-resolution checks, exact workspace dependency rewriting, and tarball installation.
- `assets/runtime` owns the project-local Moluoxixi executable and bundled runtime dependencies. Installation embeds the thin initializer below `.moluoxixi/runtime/update/init-project`, the template subtree below `.moluoxixi/runtime/update/packages/cli/src/templates`, and overlays below `.moluoxixi/runtime/update/overlays`.
- `references` documents the distributed initializer only. Repository-only upstream maintenance material lives outside the role under `/.sync/moluoxixi`.

Host output paths and capability contexts are declared in `scripts/hosts/catalog.mjs`;
projection code mirrors the package configurator maps instead of recursively
copying host directories.
