# Verification

| Command | Status | Notes |
|---|---|---|
| `npm run rules:build` | PASS | 已重建 `rules/AGENTS.md`，移除 `AIRULES:SKILL-INDEX` 块。 |
| `npm run rules:check` | NOT RUN | 待运行。 |
| `npm run verify:changes` | NOT RUN | 待运行。 |
| `npx vitest run tests/assemble-baseline.test.ts tests/change-packs.test.ts tests/delivery-control.test.ts` | NOT RUN | 待运行。 |
| `npm run verify:control:l2` | NOT RUN | 待运行。 |

## 风险 / MISSING / 待确认

无。
