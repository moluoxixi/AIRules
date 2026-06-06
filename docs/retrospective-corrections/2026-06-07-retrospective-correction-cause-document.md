# 偏差原因分析

## 确认后的标准

`retrospective-correction` 在修复完成并通过验证后，必须生成独立原因分析文档。该文档必须明确判断偏差主因是 AI 执行错误、skill 缺口、rules 缺口、需求不明确、上下文丢失还是工具环境问题；最终回复只能摘要和链接文档，不能替代文档本身。

## 事实证据

- 用户反馈：需要知道问题原因究竟是 AI 执行偏差，还是 skills/rules 问题。
- 用户要求：修复完成后必须输出一份新文档。
- 修改前的 `retrospective-correction` 已有“原因报告格式”，但只约束聊天输出格式，没有强制写入独立文档。
- 修改前的流程在“执行修复”后只要求“预防建议”，没有“生成原因文档”步骤。
- 修改前的硬性规则没有要求根因分类必须给出主因和排除其它分类。

## 根因分类

- 主因：`SKILL_GAP`
- 次因：无

## 为什么不是其它分类

- 不是 `AI_EXECUTION_ERROR`：已有 skill 没有明确要求修复后创建独立原因文档，AI 即使只在最终回复中说明原因，也不能判定为违反既有明确规则。
- 不是 `RULE_GAP`：缺口位于 `retrospective-correction` skill 的流程与输出物定义，而不是项目级 AGENTS/rules 没覆盖。
- 不是 `REQUIREMENT_AMBIGUITY`：用户已经明确要求区分 AI 执行偏差和 skills/rules 问题，并要求产出新文档。
- 不是 `CONTEXT_LOSS`：当前问题不是遗漏上下文，而是 skill 本身缺少强制文档产物。
- 不是 `TOOL_OR_ENVIRONMENT`：没有工具、权限、缓存或平台因素导致偏差。

## 修复动作

- 在 `skills/retrospective-correction/SKILL.md` 的硬性规则中新增：修复和验证完成后必须生成独立《偏差原因分析》文档。
- 在流程中新增“生成原因文档”和“最终回复链接原因文档”步骤。
- 新增默认输出路径：`docs/retrospective-corrections/<YYYY-MM-DD>-<短问题名>.md`。
- 规定原因文档必须给出主因和次因，并说明为什么不是其它分类。
- 更新原因报告格式与示例，增加“验证结果”章节。

## 验证结果

- `npx vitest run tests/skill-validation.test.ts`：PASS，8 passed。
- `npm run lint:check`：PASS。
- `git diff --check`：PASS，仅 Windows CRLF 提示。

## 预防动作

- 后续使用 `retrospective-correction` 时，不能只在聊天里输出偏差原因；必须在修复和验证后落地独立原因分析文档。
- 最终交付必须链接原因文档，并摘要主因分类、修复动作和验证结果。
