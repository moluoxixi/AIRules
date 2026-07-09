# common assets

`common` 不是业务角色；它是可被其它角色通过 `extendsRoles = ['common']` 显式继承的公共资产包。新角色默认不会自动接入 common，只有在自己的 `roles/<role>/constants/skills.ts` 中声明继承后，才会获得这些公共 skills / hooks。

当前包含：

- hooks/session-log.mjs：在宿主 Stop/stop 事件时触发。用于记录轻量会话索引，只写 `knowledge/sessions/auto/*.log` 指针，不读取 transcript 正文。
- skills/frontend-testing：当前端 UI、页面、组件、交互流程或响应式行为变化时触发。用于建立前端测试矩阵并留下可复核验证证据。
- skills/handoff：在用户要求交接、换会话或上下文过长需要中断转移时触发。用于输出下一会话可直接消费的 `handoff.md`。
- skills/session-capture：在用户要求沉淀/记录当前会话关键信息时触发。用于把会话中的长期事实与可复用过程写入 `knowledge/sessions/`。
- skills/distill-candidates：在用户要求提炼/从会话里提炼 skill 和记忆时触发。用于产出 `knowledge/skills-candidates/` 与 `knowledge/memory-candidates/` 待审候选。
- skills/recall-memory：在项目存在 `knowledge/memory/MEMORY.md` 且开始任务时触发。用于读回相关项目记忆。
- skills/remember：在用户要求“记住这条”或转正已审核记忆候选时触发。用于写入 `knowledge/memory/`。
- skills/reflect：在用户要求复盘/追因时触发。用于诊断根因并路由可复用教训。

## 显式继承

当前显式继承 common 的角色：

- `openspec-development`
- `speckit-development`
- `product`
- `ecc-development`

`trellis-development` 故意不继承 common：Trellis 自带 `.trellis/workspace/` session journal 与 `trellis mem` 检索；若未来需要把 AIRules 候选审核式记忆叠加到 Trellis，应新增组合角色或显式调整 `trellis-development/constants/skills.ts`。

## 资产登记

common 的第一方 skills 必须登记在 `roles/common/constants/skills.ts`。新增、删除或重命名 common skill 时，同步修改该清单；`npm run rules:check` 会检查目录与清单一致性。
