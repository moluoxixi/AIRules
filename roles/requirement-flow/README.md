# 需求编排

`requirement-flow` 是 AIRules 的独立 Codex 角色。一项需求对应一张图；图上的故事、接口字段、业务决定、实现动作及验证证据来自同一份记录。执行者依据这些关系领取调研、开发或验证动作。

## 从本地 AIRules 开始试用

在本地 AIRules 检出的根目录执行，最后的参数填目标项目的目录。需要 Python 3.9 或以上。

```bash
python3 roles/requirement-flow/skills/requirement-flow/flow.py --project /path/to/project init
```

初始化把可独立运行的 skill 安装到目标项目，并把新需求的入口写入该项目的 `AGENTS.md`。再用 Codex 打开项目，像平常一样提出需求或指明要接手的需求。所有业务分支、权限、联调以及发布约定继续以项目规则为准。

试用多个项目时，对每个项目各执行一次初始化。以后从新的 AIRules 检出或已更新的用户级 skill 重新初始化，即可升级共用程序。安装器保留项目自己的记录；遇到使用者改过的受管文件会报告冲突。

## 在项目中使用

下列命令从已经初始化的项目根目录执行。需求 ID 由团队选定，同一个项目内唯一。

```bash
FLOW=.agents/skills/requirement-flow/flow.py
python3 "$FLOW" list
python3 "$FLOW" new <需求ID> --request '需求原话'
python3 "$FLOW" task <需求ID> next --actor <执行者>
python3 "$FLOW" task <需求ID> serve
```

`serve` 输出专属于这项需求的本机 URL。页面支持按功能筛选、查看当前进度与依赖、登记业务决定。离线查阅可直接打开 `.requirements/active/<需求ID>/handbook.html`。AI 可读取同目录的 `model.json`，也可运行 `task <需求ID> context <故事ID>` 获取该功能的上下文。所有改动通过带版次检查的命令或本机页面写回。

调研委托用 `new <需求ID> --outcome research --request '原话'` 建立，记录结论及依据后即可交付。开发交付按各故事的验收动作检查。业务决定改变时，受影响的实现与证据需要复核。失败验证可重开相关工作。结束后 `archive <需求ID>` 将整项记录移入 `.requirements/archive/`，仍可离线查阅或用 `context` 检索。

## 从旧 Codex 入口迁移

已启用 Moluoxixi 的项目可以在初始化时明确加 `--migrate`。安装器将已识别的旧 Codex 入口备份到 `.requirements/migrations/moluoxixi/`，保留其他 hooks、项目规则、独立 skills 和旧任务材料。`migration.json` 记录移动与备份的相对路径。遇到无法确认归属的配置时，按提示核对后再运行。

## 通过 AIRules 分发

包含本角色的 AIRules 版本发布后，运行 `airules install requirement-flow --host codex` 和 `airules verify requirement-flow --host codex`。然后从 `~/.agents/skills/requirement-flow/flow.py` 初始化各项目。AIRules 的用户级角色切换会更新受管 skill 投影；从本地检出直接试用只针对指定的项目。
