# Runtime Source Notice

This directory is distributed by AIRules as part of the `moluoxixi` role. It does not load or install the `@mindfoldhq/trellis` or `@mindfoldhq/trellis-core` npm packages.

`vendor/channel-mem.mjs` contains the Trellis v0.6.7 channel and memory implementations migrated from revision `e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a`. The corresponding TypeScript source is under `source/` and remains licensed under AGPL-3.0-only; source, revision, and license metadata are recorded in the role manifest. `source/packages/cli/src/commands/channel/spawn.ts` is modified so detached supervisors re-enter the AIRules bundle. Migration and modification date: 2026-07-16.

The bundle includes Commander 12.1.0 and Chalk 5.6.2 under their MIT licenses. Their license texts are under `legal/`.

`trellis.mjs` is the AIRules-owned dispatcher and implements local workflow selection and project update routing without the upstream CLI package.
