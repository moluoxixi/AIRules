# AI Upstream Review Protocol

The AI agent owns the upstream update. No repository script may merge, transform,
or write the finalized role package trees.

1. Fast-forward the AIRules checkout with `git pull --ff-only` and require a clean
   finalized package tree.
2. Read `manifest.json`, `capability-map.md`, and `preservation-contracts.json`.
3. Clone or fetch Trellis under `work/trellis`, resolve the requested target to an
   exact commit, and run `scan.mjs`.
4. Compare three sources: the pinned upstream baseline, the checked-in finalized
   packages, and the candidate upstream commit. Treat scanner overlaps as review
   locations, not as merge decisions.
5. Rebuild the finalized `packages/core` and `packages/cli` trees from the candidate
   upstream source. Reapply only intentional Moluoxixi behavior and publication
   identity. Do not retain unexplained historical drift.
6. Preserve the task-complexity gate, the upstream small-task creation opt-out,
   review-gated spec proposals, collision-resistant package identities, role-local
   entrypoints, and the `.moluoxixi` channel/memory namespace.
7. Rebase runtime overlays manually when their upstream template inputs changed;
   all source and overlay hashes must pass the initializer integrity checks.
8. Review the complete diff, run root tests and the role publication gates, then
   update `manifest.json` to the exact reviewed commit. Baseline metadata advances
   only in the same commit as the finalized package result.

`work/` and `reports/` are disposable. The committed baseline facts, contracts,
tests, and finalized packages are the durable record.
