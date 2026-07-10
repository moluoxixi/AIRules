# airules-development

`airules-development` 是 AIRules 的单主线研发角色，覆盖需求、设计、任务、代码、测试、纠错、记忆和知识晋升。

## 所有权

- OpenSpec change 目录保存长期规格产物。
- `.airules/workflow` 保存项目内控制内核、schema 和配置。
- `evidence/events.jsonl` 是状态回放依据。
- AIRules conductor 是唯一流程控制者；外部 skills 只处理明确阶段。

## 外部能力

- Superpowers：需求澄清、计划、TDD、调试、评审、验证和分支完成。
- gstack：计划评审、独立代码评审、真实 QA 和发布文档校验。
- ECC：eval、检索、验证、安全扫描和候选学习。
- OpenAI Playwright：真实浏览器验证。

这些能力不得维护独立的 change 状态，也不得绕过 AIRules gate。

## 初始化

同步角色后，在目标项目触发 `init-project`。初始化器会安装：

- `openspec/schemas/airules-development/`
- `.airules/workflow/bin/workflow.mjs`
- `.airules/workflow/schemas/`
- 项目 `AGENTS.md` 中的受管工作流规则块

随后使用：

```text
node .airules/workflow/bin/workflow.mjs init <change>
node .airules/workflow/bin/workflow.mjs next <change>
node .airules/workflow/bin/workflow.mjs gate <change> <gate> --status pass --evidence <ref> --idempotency-key <key>
node .airules/workflow/bin/workflow.mjs replay <change>
```
