# Command Discovery

## Discovery Order

Find commands from:
- package manager lockfiles and workspace files;
- `package.json` scripts;
- framework configs such as Vite, Nuxt, Next, Vue, React, Vitest, Playwright, ESLint, TypeScript;
- CI files;
- repository documentation;
- project instructions.

Do not invent scripts that are not present. Do not make a command mandatory because it is common in another project.

## Common Script Categories

Look for scripts whose names imply:
- lint or static check;
- typecheck or compile-only type validation;
- test, unit, component, e2e, integration;
- coverage;
- build;
- preview or start;
- storybook, histoire, docs, or visual test when relevant.

Example command names are only examples: `pnpm lint`, `npm run typecheck`, `pnpm test`, `pnpm coverage`, `pnpm build`, `pnpm exec playwright test`.

## Result Labels

- `PASS`: command ran and succeeded.
- `FAIL`: command ran and failed.
- `MISSING`: no script, config, dependency, or test target exists.
- `NOT RUN`: skipped because of time, environment, dependency, or user instruction.

Always report the exact command that was run and its result.
