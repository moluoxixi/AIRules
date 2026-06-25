# Layer Delta

## repo-maintenance

### ADDED

- `docs/delivery/change-pack.md`：定义 AIRules L2 变更包契约。
- `docs/changes/index.md`：登记活动与归档变更包。
- `docs/changes/2026-06-25-remove-skill-index/`：记录本次 L2 变更。
- `scripts/verify-change-packs.mjs`：校验变更包结构。
- `tests/change-packs.test.ts`：覆盖变更包校验。

### MODIFIED

- `docs/delivery/control-contract.md`：加入 L2 变更包控制面。
- `docs/map.md`：加入 `docs/changes/` 导航。
- `package.json`：加入 `verify:changes` 并接入 `verify:control:l2`。
- `scripts/verify-delivery-control.mjs` 与测试：将变更包校验纳入执行层。
- `scripts/assemble-baseline.mjs` 与测试：baseline 只由 `rules/sources/*.md` 拼接。
- `scripts/lib/install.ts`、`scripts/lib/tool.ts`：移除安装期 vendor baseline skill index 注入。

### REMOVED

- `scripts/lib/skill-index.mjs` 与类型声明。
- `tests/skill-index.test.ts`。

## global-baseline

### ADDED

- N/A。

### MODIFIED

- `rules/AGENTS.md` 由 `rules/sources/*.md` 重新生成。

### REMOVED

- `AIRULES:SKILL-INDEX` 静态 skill 触发索引块。

## project-init

### ADDED

- N/A。

### MODIFIED

- N/A。

### REMOVED

- N/A。

## generated-project

### ADDED

- N/A。

### MODIFIED

- N/A。

### REMOVED

- N/A。
