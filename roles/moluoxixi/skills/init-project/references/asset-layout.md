# AIRules Extension Boundary

```text
roles/moluoxixi/
  packages/                         synchronized external baseline
  skills/init-project/
    assets/project-extension/       AIRules-owned project payload
    scripts/install-extension.mjs   extension planner and installer
    scripts/core/                   transaction and safety code
```

The wrapper runs the finalized role CLI before the extension installer. The
installer reads only its own `assets/project-extension` tree and never writes to
`roles/moluoxixi/packages` or `.sync`.

Managed extension files and merged blocks are recorded in
`.moluoxixi/airules-init-manifest.json`. Knowledge source and derived data are
preserved project data and do not appear in the manifest.
