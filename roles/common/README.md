# common role

公共角色资产放置不属于单一开发/产品角色、且不携带角色规则语义的通用能力。

当前包含：

- hooks/session-log.mjs：在宿主 Stop/stop 事件时触发。用于记录轻量会话索引，只写 `knowledge/sessions/auto/*.log` 指针，不读取 transcript 正文。
- skills/frontend-testing：当前端 UI、页面、组件、交互流程或响应式行为变化时触发。用于建立前端测试矩阵并留下可复核验证证据。
- skills/handoff：在用户要求交接、换会话或上下文过长需要中断转移时触发。用于输出下一会话可直接消费的 `handoff.md`。
- skills/session-capture：在用户要求沉淀/记录当前会话关键信息时触发。用于把会话中的长期事实与可复用过程写入 `knowledge/sessions/`。
- skills/distill-candidates：在用户要求提炼/从会话里提炼 skill 和记忆时触发。用于产出 `knowledge/skills-candidates/` 与 `knowledge/memory-candidates/` 待审候选。
- skills/recall-memory：在项目存在 `knowledge/memory/MEMORY.md` 且开始任务时触发。用于读回相关项目记忆。
- skills/remember：在用户要求“记住这条”或转正已审核记忆候选时触发。用于写入 `knowledge/memory/`。
- skills/reflect：在用户要求复盘/追因时触发。用于诊断根因并路由可复用教训。

角色同步默认叠加 common：选择 `openspec-development`、`speckit-development`、`product` 或 `ecc-development` 时都会先同步 common，再同步目标角色；目标角色同名资产覆盖 common。
