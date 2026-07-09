# trellis-development role

`trellis-development` 是可选开发角色，用 Trellis 承接项目内 AI 工程工作流：任务状态、PRD / design / implement / check 产物、长期 `.trellis/spec/` 知识库、`.trellis/workspace/` 会话记忆与多宿主适配。

## 采用边界

- Trellis 是项目内 workflow runtime，不是单纯 skills 集合；只投影 AIRules 第一方 `init-project` skill 不等于复制 Trellis runtime。
- AIRules 只通过 setup 安装 `@mindfoldhq/trellis` CLI，并由目标项目中的 `init-project` skill 调用 `trellis init` 生成项目内 `.trellis/` 与宿主适配文件。
- 不把 Trellis AGPL 模板、hooks、agents 或 skills 复制进 AIRules `roles/`；需要更新 Trellis 行为时通过 Trellis CLI / upstream 处理。
- 本角色默认不继承 `common`。Trellis 自带 workspace journal 与 mem 检索；若项目需要 AIRules 的候选审核式记忆、handoff、frontend-testing 等 common 能力，应选择显式继承 common 的其它角色或后续新增组合角色。

## 工作流

- 初始化：运行 `trellis init -u <developer> --<platform>`，在目标项目生成 `.trellis/`、宿主 skills / agents / hooks / workflows。
- Plan：`trellis-brainstorm` 澄清需求并写 `.trellis/tasks/<task>/prd.md`；复杂任务补 `design.md` 与 `implement.md`。
- Execute：支持子代理的宿主调度 `trellis-implement` / `trellis-research`；Codex inline 等宿主由主会话读取任务产物后实现。
- Verify：`trellis-check` 按 PRD、spec、lint、typecheck、tests 检查并可自修复。
- Finish：`trellis-update-spec` 把长期规则写回 `.trellis/spec/`，`trellis-finish-work` 归档任务并记录 session journal。

## 宿主与项目边界

- Trellis 多宿主适配由 `trellis init --claude --cursor --codex --opencode ...` 生成，AIRules 不伪造宿主 hooks / agents 目录。
- `init-project` 只操作目标项目目录，不主动写用户 home 下的宿主全局配置或资产目录。
- `.trellis/spec/` 是项目规范事实源；`.trellis/workspace/` 是会话记忆；`.trellis/tasks/` 是任务事实源。
