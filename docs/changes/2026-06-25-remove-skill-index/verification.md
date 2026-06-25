# Verification

| Command | Status | Notes |
|---|---|---|
| `npm run rules:build` | PASS | 已重建 `rules/AGENTS.md`，移除 `AIRULES:SKILL-INDEX` 块。 |
| `npm run rules:check` | PASS | `rules/AGENTS.md` 与 `rules/sources/` 一致。 |
| `npm run verify:changes` | PASS | 变更包契约、索引和本次变更包结构通过。 |
| `npx vitest run tests/assemble-baseline.test.ts tests/change-packs.test.ts tests/delivery-control.test.ts tests/install.test.ts tests/vendors.test.ts` | PASS | 5 个测试文件、86 个用例通过。 |
| `npm run verify:control:l2` | PASS | rules、delivery、changes、rules self-sufficiency、skills、knowledge sources 均通过。 |
| `npm run typecheck` | PASS | TypeScript 类型检查通过。 |
| `npm run lint:check` | PASS | ESLint 检查通过。 |

## 风险 / MISSING / 待确认

无。
