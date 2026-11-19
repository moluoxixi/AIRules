# 计划与证据

`plan` 读取 UTF-8 JSON。顶层使用要改的栏目，`stories`、`contracts`、`decisions`、`actions` 是以稳定 ID 为键的对象。一次补丁可以同时新增故事、契约和动作。修改现有 ID 时传该条完整记录。提交时会检查引用、分支和循环依赖。所有写入带上刚读取的 `revision`。

| 栏目 | 记录内容 |
| --- | --- |
| stories | `title`、`actor`、`goal`、`before`、`flow`（关键处理的有序字符串数组）、`basis`（原话或来源位置）、`examples`（由 `given`、`when`、`then` 构成的验收场景）。 |
| contracts | `title`、`operation`（例如方法和已核实的路径）、`state`（`open` 或 `confirmed`）、`status`（人读说明）、`source`、`fields`。每个字段有 `name`、`type`、`constraint`、`use`。在约束里说明必填、枚举、空值以及读写含义，在用途里说明前端如何提交、处理和回显。 |
| decisions | `title`（待回答的问题）、`why`、`owner`、`stories`、`options`。每个选项 ID 对应 `label` 和 `consequence`。收到人的决定后运行 `decision`。 |
| actions | `title`、`kind`（调研、开发、验证）、`stories`（展示在哪些功能下）、`read_stories`（哪些故事的修改会使产出需要复核）、`contracts`、`decisions`、`depends_on`（如 `[{"id":"A-intake"}]`）、`done`（完成条件）。无对应输入时填空数组。 |
| lessons | `observation`、`when`、`practice`、`boundary`、`evidence`、`review`。记录可再次使用的做法、适用边界和何时复核。 |

动作可用 `when: {"decision":"D-range","is":"all"}` 描述启用条件，依赖边也接受同一条件。接口调研可用 `closes_contracts` 指明它负责核实的契约。验证可用 `accepts` 声明足以通过的证据方式，如 `["真实环境"]`。真实需求支持自动化、真实环境和人工核对证据。

**怎样检查闭环。** 逐个故事从用户操作追踪到请求、响应、状态变化和用户可见结果，至少覆盖适用的失败与恢复场景。遇到无法解释的字段或状态，把来源和影响写入对应契约或决定。需求改变后读 `next`，检查相关产出是否需要复核。

**怎样回写。** 在 `--output` 中写实际结果，在 `--evidence` 中写项目内相对路径、测试标识或可访问的证据位置。验证另记环境、证据方式和预期。失败时指定确需返工的前置动作。项目的权限、联调和真实环境验收条件仍由项目规则决定。
