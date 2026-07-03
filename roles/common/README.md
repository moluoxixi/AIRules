# common role

公共角色资产放置不属于单一开发/产品角色、且不携带角色规则语义的通用能力。

当前包含：

- hooks/session-log.mjs：宿主 Stop/stop 事件触发的轻量会话索引记录 hook，只写 `.airules/sessions/auto/*.log` 指针，不读取 transcript 正文。
- skills/session-capture：用户显式要求“沉淀会话/记录这次关键信息”时手动触发。
- skills/distill-candidates：用户显式要求“提炼/从会话里提炼 skill 和记忆”时手动触发。
- skills/recall-memory：项目存在 `.airules/memory/` 且开始任务时读回相关记忆。
- skills/remember：用户显式要求“记住这条”或转正已审核记忆候选时触发。
- skills/reflect：用户要求复盘/追因时触发。

角色同步默认叠加 common：选择 `development` 或 `product` 时都会先同步 common，再同步目标角色；目标角色同名资产覆盖 common。