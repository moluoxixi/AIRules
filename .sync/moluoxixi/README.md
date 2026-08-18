# Moluoxixi Upstream Maintenance

This directory is the maintenance boundary for the Moluoxixi role. The checked-in
`roles/moluoxixi/packages/core` and `roles/moluoxixi/packages/cli` directories are
the only finalized package sources. Upstream checkouts and generated reports are
local working data and are ignored by Git.

There is no automated source updater. An AI agent performs each upstream review
in a local Git worktree, records the reviewed adaptations as local commits,
reviews that commit range, and exports only the verified package trees into the
finalized role. `scan.mjs` is read-only: it reports local package adaptations,
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
  work/trellis/                  clean local upstream clone, ignored
  work/rebuild/                  linked local adaptation worktree, ignored
  work/archive/                  superseded local workspaces, ignored
  reports/                       generated scan output, ignored
```

Clone or refresh the local upstream repository, run the scanner against an exact
candidate commit, then create a local rebuild branch from that same commit:

```bash
git clone https://github.com/mindfold-ai/Trellis.git .sync/moluoxixi/work/trellis
git -C .sync/moluoxixi/work/trellis fetch origin
node .sync/moluoxixi/scan.mjs --target <commit> --json
git -C .sync/moluoxixi/work/trellis worktree add \
  -b moluoxixi/rebuild-<short-commit> ../rebuild <commit>
```

The AI agent reapplies the preservation contracts inside `work/rebuild` and
commits each logical adaptation there. Those commits are a local review aid: the
branch is never pushed and its Git history is not copied into AIRules. After the
rebuild package trees pass review and verification, the AI agent exports them to
`roles/moluoxixi/packages/{core,cli}` and verifies Git blob and executable-mode
identity. No repository script performs that export.

Redirect JSON output into `.sync/moluoxixi/reports/` when a persistent local
review artifact is useful. The clone, rebuild worktree, local commits, archives,
and reports are disposable and are not committed.
