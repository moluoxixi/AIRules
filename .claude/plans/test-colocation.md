# 测试就近重组 — 功能在哪，测试在哪

## 目标（用户确认）

移除集中式 `tests/` 目录，按「功能在哪、测试在哪」把每个测试文件搬到被测代码旁的 `__test__/`。

## vitest 发现机制（已确认安全）

- `vitest.config.ts` 无 `include` 覆盖，默认 glob `**/*.test.ts`（排除 node_modules/dist/vendor/.skill-references/.cache-git）。测试放任何目录都会被发现。
- coverage `include` 仅 `constants/**`、`scripts/lib/**`，与测试位置无关，不需改。
- 搬家只需修正每个文件的相对 import 与 `__dirname` 基准路径。

## 迁移映射

### → `scripts/lib/__test__/`（测 scripts/lib/*）
| 文件 | import 改写 |
|---|---|
| `agent-mcp-projection.test.ts` | `'../scripts/lib/install.js'` → `'../install.js'` |
| `install.test.ts` | `'../scripts/lib/install.js'` → `'../install.js'` |
| `tool.test.ts` | `'../scripts/lib/tool.js'` → `'../tool.js'` |
| `vendor-sync.test.ts` | `'../scripts/lib/vendor-sync.js'` → `'../vendor-sync.js'` |
| `verify-coverage.test.ts` | `'../scripts/lib/verify.js'` → `'../verify.js'` |
| `install-coverage.test.ts` | `'../scripts/lib/X.js'`→`'../X.js'`；`'../constants/hosts.js'`→`'../../../constants/hosts.js'`；`new URL('../scripts/lib/vendors.ts')`→`new URL('../vendors.ts')` |
| `vendors.test.ts` | `'../scripts/lib/vendors.js'`→`'../vendors.js'`；`'../constants/skills.js'`→`'../../../constants/skills.js'` |

> 路径深度：`scripts/lib/__test__/` 到 `scripts/lib/` 是 `../`，到仓库根是 `../../../`，到 `constants/` 是 `../../../constants/`。

### → `skills/init-project/__test__/`（测 init-project 脚本）
| 文件 | 改写 |
|---|---|
| `init-project-scripts.test.ts` | 无相对 import；脚本用 `process.cwd()` 定位（cwd=仓库根，vitest 运行目录），**不变** |

### → 根级 `__test__/`（测仓库根提交规范，跨模块/仓库级）
| 文件 | 改写 |
|---|---|
| `commitlint.test.ts` | `rootDir = resolve(__dirname, '..')` → `resolve(__dirname, '..')` 保持（根级 `__test__/` 到仓库根就是 `..`），**实际不变** |

> commitlint 测仓库级提交规范，放仓库根 `__test__/`，与功能模块的 `__test__/` 区分开。`__dirname` 从 `tests/`（深度1）移到根 `__test__/`（深度1），`resolve(__dirname,'..')` 仍指仓库根，无需改。

## 执行步骤

1. 建目录：`scripts/lib/__test__/`、`skills/init-project/__test__/`、`scripts/__test__/`。
2. `git mv` 各测试文件到目标位置（保留 git 历史）。
3. 按上表逐文件改写相对 import 与 `__dirname` 基准。
4. 删除空的 `tests/` 目录。
5. 检查 tsconfig.build.json 的 `exclude: ["tests"]`——改为排除 `**/__test__/**`（避免测试进生产构建）。
6. 检查 vitest.config coverage `exclude: ['tests/**']` → 改为 `['**/__test__/**']`。
7. 检查 eslint 等对 `tests/` 的特殊配置。

## 验证

- `npx vitest run` → 全部测试仍被发现且通过（除既有 vendors 2 基线失败）。
- `npm run typecheck` → PASS（import 路径正确）。
- `npm run lint:check` → PASS。
- `npm run build`（tsc -p tsconfig.build.json）→ 确认 __test__ 不进 dist。
- grep 确认无残留 `tests/` 路径引用。

## 待确认 / 风险

- 既有 vendors 2 个基线失败仍在（与本次重组无关）。
