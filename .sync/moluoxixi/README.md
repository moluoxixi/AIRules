# Moluoxixi Upstream Maintenance

This directory is the maintenance boundary for the Moluoxixi role. The checked-in
`roles/moluoxixi/packages/core` and `roles/moluoxixi/packages/cli` directories are
the only finalized package sources. Upstream checkouts and generated reports are
local working data and are ignored by Git.

There is no automated source updater. An AI agent performs each upstream review,
edits the finalized role packages, reviews the resulting diff, and runs the full
verification gates. `scan.mjs` is read-only: it reports local package adaptations,
incoming upstream changes, and paths touched by both sides.

## Local Layout

```text
.sync/moluoxixi/
  manifest.json                  pinned upstream facts and package mappings
  AI-PROTOCOL.md                 required AI review contract
  capability-map.md              maintained behavior map
  preservation-contracts.json    intentional local behavior
  history/                       reviewed historical records
  scan.mjs                       read-only Git tree scanner
  work/                          local upstream clone, ignored
  reports/                       generated scan output, ignored
```

Clone or refresh the local working copy, then run the scanner against an exact
candidate commit:

```bash
git clone https://github.com/mindfold-ai/Trellis.git .sync/moluoxixi/work/trellis
git -C .sync/moluoxixi/work/trellis fetch origin
node .sync/moluoxixi/scan.mjs --target <commit> --json
```

Redirect JSON output into `.sync/moluoxixi/reports/` when a persistent local
review artifact is useful. Neither the clone nor reports are committed.
