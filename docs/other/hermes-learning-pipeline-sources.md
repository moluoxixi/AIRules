# Hermes Learning Pipeline Sources

## 来源快照

- Hermes Memory: https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/
- Hermes Curator: https://hermes-agent.nousresearch.com/docs/user-guide/features/curator
- Hermes Skills overview: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills
- Hermes SOUL.md guide: https://hermes-agent.nousresearch.com/docs/guides/use-soul-with-hermes
- Hermes repository: https://github.com/NousResearch/hermes-agent

## AIRules 借鉴边界

- 曾借鉴 Memory 的小型长期记忆、候选沉淀和安全过滤思想；当前 AIRules 不再默认分发学习捕获 skill，只保留 `docs/AI项目知识/待确认/` 作为用户确认后的待审文档约定。
- 曾借鉴 Curator 的 dry-run、backup、rollback、pin 和只管理 agent-created skills 思想；当前 AIRules 不再默认分发 skill 策展 skill，只保留 `docs/skill-evolution/inbox/` 作为用户确认后的待审候选约定。
- 不复制 Hermes runtime、AIAgent、provider routing、terminal backend、cron daemon 或 tool gateway。
- 不直接修改 `vendor/`，不把第三方上游 skill 当作可写资产。
- 正式知识库和 first-party core skills 的修改必须经过用户确认、测试和验证。

## Hermes 宿主投影边界

- AIRules 的 Hermes 宿主按本地客户端实际目录投影到 `~/AppData/Local/hermes/`，基线文件写入 `~/AppData/Local/hermes/SOUL.md`。
- AIRules 的 Hermes skills 按本地客户端实际目录投影到 `~/AppData/Local/hermes/skills/<skill-name>`。
- AIRules 不再将学习捕获或 skill 策展流程作为默认安装 skill 分发到任何宿主。
- 若未来存在宿主级不安装技能需求，必须通过 `constants/hosts.ts` 的通用配置字段表达，安装与验证脚本只读取配置，不写宿主名特判。
