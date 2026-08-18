# Moluoxixi Package Overlays

This directory contains runtime template replacements and additions consumed by
the role-local initializer.

```text
../packages/cli/src/templates/<path> -> packages/cli/src/templates/overrides/<path>
new template target <path>           -> packages/cli/src/templates/additions/<path>
```

`manifest.json` records every payload file, target path, capability owner, source
hash, and overlay hash. The initializer validates the manifest before building a
plan and installs this directory with the role for offline project updates.

Repository maintenance metadata does not belong here. Upstream package baselines,
AI review rules, and generated diff reports live under `/.sync/moluoxixi`.
