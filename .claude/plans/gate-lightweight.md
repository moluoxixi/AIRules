# 门禁轻量化 — 只保留分发/安装逻辑校验

## 最终判定（用户确认）

一刀切：**与分发、安装逻辑无关的校验全部删除**，包括所有 skills/agents 的格式与内容校验。
- `assemble-baseline.mjs` 生成逻辑功能性保留（`rules:build` 生成投影产物 rules/AGENTS.md），删除 `--check` 漂移校验与其测试。
- 治理文档（docs/changes、docs/delivery、scripts/purity）一并删除。
- skills/agents/rules 内容产物本身保留，只是不再有任何校验。

## 删除清单（脚本）
- `scripts/verify-skills.mjs`
- `scripts/verify-skill-frontmatter.mjs`
- `scripts/verify-delivery-control.mjs`
- `scripts/verify-rule-self-sufficiency.mjs`
- `scripts/verify-change-packs.mjs`
- `scripts/verify-learning-candidates.mjs`
- `scripts/purity/`（整个目录）
- `assemble-baseline.mjs` 的 `--check` 分支（脚本保留，仅删校验模式）

## 删除清单（测试）
- `tests/delivery-control.test.ts`
- `tests/rule-self-sufficiency.test.ts`
- `tests/skill-frontmatter-script.test.ts`
- `tests/skill-validation.test.ts`
- `tests/change-packs.test.ts`
- `tests/purity-check.test.ts`
- `tests/learning-pipeline.test.ts`
- `tests/assemble-baseline.test.ts`（测内容拼接+漂移，非分发）

## 保留（分发/安装/流程）
- 脚本：`scripts/lib/**`、`cli.ts`、`host-setup.ts`、`sync-vendors.ts`、`verify-host.ts`、`assemble-baseline.mjs`（仅生成）。
- 测试：`agent-mcp-projection`、`install`、`install-coverage`、`tool`、`vendors`、`vendor-sync`、`verify-coverage`、`commitlint`。
- `constants/**`、host 映射、投影/安装逻辑、`skills/**`、`agents/**`、`rules/**`。

## 删除清单（治理文档）
- `docs/changes/`（含变更包 + index.md + archive）
- `docs/delivery/`（control-contract.md、change-pack.md、purity-check.md）

## 接线清理
- package.json scripts 删除：`delivery:verify`、`verify:skills`、`verify:rules:self-sufficiency`、`verify:changes`、`verify:control:l2`、`rules:check`、`purity:assemble`、`purity:check`。保留 `rules:build`、build/lint/test/typecheck/coverage/sync 等。
- ci.yml 删除步骤：Verify rules baseline、Verify delivery control、Verify rule self-sufficiency、Verify skill frontmatter。保留 Lint/Typecheck/Test。
- publish.yml 删除步骤：上述四个 + 已坏的 Verify knowledge source registry。保留 Verify tag/Lint/Typecheck/Test/publish。
- .husky/pre-push：`verify:skills` 行删除，保留 `typecheck`。

## 根 AGENTS.md / CLAUDE.md 清理（两者同步，保持一致）
- 删除 “First-Party Skill Authoring Rules” 整节。
- 删除 “AIRules 规则资产层级判定” 中已失去落点的门禁描述；保留工作区/vendor 红线、元认知隔离、受众隔离等仍有效约束。
- 删除对 `docs/delivery/**`、`scripts/verify-*.mjs`、纯净测试的引用。

## README / README-zh 清理
- 删除 “Delivery control gate / 交付控制门禁” 特性条目与 CLI 表里 `npm run delivery:verify` 行。

## 验证
- `npm run typecheck` PASS
- `npm test`（仅保留的分发/安装/host/vendor/tool/commitlint 测试）PASS
- `npm run lint:check` PASS
- `npm run rules:build` 仍能生成 rules/AGENTS.md
- grep 全仓库确认无残留引用被删脚本/路径/命令（package/CI/husky/README/根规则/lib）

