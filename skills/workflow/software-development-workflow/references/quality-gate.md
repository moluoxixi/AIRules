# Quality Gate

## Required Dimensions

Every code change needs evidence for:
- static quality, such as lint or formatter checks;
- type correctness, such as TypeScript, vue-tsc, tsc, or equivalent;
- automated tests for changed behavior;
- coverage when the project has coverage tooling or the change adds meaningful logic;
- build or packaging when runtime delivery can be affected;
- task-specific manual or browser verification when automated checks do not cover user behavior.

## Command Discovery

Do not hard-code command names as requirements. Discover commands from:
- `package.json` scripts;
- workspace config such as pnpm, npm, turbo, nx, vite, vitest, playwright, eslint, tsconfig;
- repository docs;
- existing CI configuration;
- project-specific agent instructions.

Examples are illustrative only: `pnpm lint`, `npm test`, `pnpm exec tsc --noEmit`, `pnpm build`, `pnpm coverage`.

## Coverage Baseline

Use project thresholds first. If none exist, report against the common baseline of 80% statements, branches, functions, and lines.

Changed or new logic should aim for 90%+ meaningful coverage. High-risk areas such as auth, payment, deletion, migration, security boundaries, and core business rules need success, failure, boundary, and exception-path tests.

## Reporting Status

Use explicit statuses:
- `PASS`: command ran and met the relevant threshold.
- `FAIL`: command ran and failed.
- `MISSING`: no project script, config, dependency, or test file exists for this dimension.
- `NOT RUN`: command was intentionally skipped or could not be run; include the reason.

Never convert `FAIL`, `MISSING`, or `NOT RUN` into success.
