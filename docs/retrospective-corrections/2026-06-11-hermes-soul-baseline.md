# 偏差原因分析

## 确认后的标准

Hermes `SOUL.md` 只用于身份、语气和沟通风格，不作为 AIRules 规则入口。AIRules 对 Hermes 宿主只投影 skills 到 `~/AppData/Local/hermes/skills/<skill-name>`，不得把 `rules/AGENTS.md` 或 `vendor/AGENTS.md` 写入、链接或同步到 `SOUL.md`。

## 事实证据

- 用户反馈指出：`soul.md` 不应该是规则，AIRules 与 Hermes 二者存在语义差异。
- Hermes 官方文档说明：`SOUL.md` 是 Hermes 实例的 primary identity，用于 tone、personality、communication style，并明确不用于 repo-specific coding conventions、file paths、commands 或 architecture notes。
- 修复前 `constants/hosts.ts` 将 Hermes baseline 配置为 `SOUL.md`，安装逻辑会无条件把 `vendor/AGENTS.md` 链接到宿主 baseline 文件。
- 修复前测试断言 Hermes 投影后 `SOUL.md` 内容等于规则 baseline，说明旧验收标准把身份文件误当规则文件。

## 根因分类

- 主因：`RULE_GAP`
- 次因：`REQUIREMENT_AMBIGUITY`

## 为什么不是其它分类

- 不是单纯 `AI_EXECUTION_ERROR`：现有实现和测试都把 Hermes `SOUL.md` 当作 baseline，AI 只是沿用了项目既有规则与断言。
- 不是 `SKILL_GAP`：问题发生在宿主投影配置、安装逻辑和文档边界，不是某个任务技能缺少步骤。
- 不是 `CONTEXT_LOSS`：关键证据存在于当前项目和 Hermes 文档中，偏差来自规则语义未被建模，而不是读取遗漏。
- 不是 `TOOL_OR_ENVIRONMENT`：工具可正常读取、修改和验证；失败不是权限、缓存或平台问题导致。

## 修复动作

- 在 `constants/hosts.ts` 增加 `projectBaseline` 显式配置，Hermes 和 Hermes Desktop 设置为 `false`。
- 在 `scripts/lib/install.ts` 中让 `projectToHost` 尊重 `projectBaseline`，Hermes 仍同步 skills，但不写入或链接 `SOUL.md`。
- 在 `linkHostBaseline` 中对不支持规则 baseline 的宿主显式抛错，避免调用方误以为已成功映射。
- 更新 `tests/install-coverage.test.ts`，断言 Hermes 不创建 `SOUL.md`，并断言显式 baseline 链接会失败。
- 更新 README、架构文档和 Hermes 边界文档，说明 `SOUL.md` 不是 AIRules 规则入口。
- 修复 `package.json` 的 JSON 语法错误，使测试入口可执行。

## 验证结果

- `npm test -- tests/install-coverage.test.ts`：PASS，23 tests passed。
- `npm run typecheck`：PASS。
- `npm test -- tests/verify-coverage.test.ts`：PASS，7 tests passed。
- `npm run lint:check`：PASS。
- `npm test`：PASS，15 files passed，136 passed，1 skipped。

## 预防动作

- 宿主配置必须显式表达规则 baseline 是否适配，不能假设所有宿主的首选 Markdown 文件都能承载 AIRules 规则。
- 新增或修改宿主时，测试必须覆盖“规则 baseline 投影”和“skills 投影”两个独立语义。
- 文档中的宿主矩阵必须区分 rules baseline、identity/persona 文件和 skills 目录，避免用“引导文件”混淆不同宿主语义。
