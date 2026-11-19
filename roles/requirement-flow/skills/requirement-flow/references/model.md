# 计划与证据

项目工具位于 `.agents/skills/requirement-flow/flow.py`。用 `task <需求ID> context [故事ID]` 读取当前版次、故事、契约、决定和场景验收情况。`plan` 接受 UTF-8 JSON，仅提交要改的栏目，按 ID 修改单条记录时传入该条完整对象。每次写入使用刚读到的 `revision`，发生冲突时重新读取相关记录。

| 栏目 | 要记录的内容 |
| --- | --- |
| `stories` | `title`、`actor`、`goal`、`before`、有序的关键处理 `flow`、来源 `basis` 和验收 `examples`。每个新增或改写的例子含本需求内唯一的 `id` 及具体的 `given`、`when`、`then`。 |
| `contracts` | `title`、`operation`、`state`（`open` 或 `confirmed`）、`status`、`source`、`fields`。每个字段写 `name`、`type`、`constraint`、`use`，对照必填、枚举、空值、提交与回显。 |
| `decisions` | `title`、`why`、`owner`、`stories`、`options`。每个选项有 `label` 和 `consequence`，收到实际决定后通过 `decision` 写回。 |
| `actions` | `title`、`kind`（调研、开发、验证）、`stories`、`read_stories`、`contracts`、`decisions`、`depends_on`、`done`。无对应关系时填空数组。`read_stories` 表示哪些故事改动会影响该动作产出。 |
| `lessons` | `observation`、`when`、`practice`、`boundary`、`evidence`、`review`。确认有复用价值后，将适用条件、边界和依据写入当前需求。 |

动作或依赖边可加 `when: {"decision":"D-range","is":"all"}` 指定生效条件。接口调研用 `closes_contracts` 声明负责确认的契约。调度默认依动作分配专项工作方法；需要时用动作的 `skill` 指定五个专项之一。`next` 返回建议动作的 `skill`，待复核的交付还可返回 `review_skill`。

## 缩小已确认的范围

常规 `plan` 保留已有场景。同一 ID 下修订预期后，重新验收该场景。若决定把“失败重试”移出本期范围，先将范围问题 `D-retry-scope` 关联到故事 `S-save`，由实际决定人选定 `defer`。再在同一份补丁中提交完整的 `stories.S-save`（移除 `C-retry`）、受影响动作的完整记录（同步调整 `covers`），以及以下顶层字段。

```json
{ "retire_scenarios": { "C-retry": { "decision": "D-retry-scope", "is": "defer" } } }
```

`is` 填实际选中的选项代码。移除或更换场景 ID 缺少匹配决定时，计划更新会被拒绝。可用 `context` 或 `next` 返回的 `retired_scenarios` 查阅原场景及其决定。若决定改为本期交付，场景会重新列为未覆盖，按原 ID 补回后需要重新验收。

## 从场景到证据

假设故事 `S-save` 有两个场景，`C-reopen` 的预期是“保存后重新打开，数量等于 3”，`C-retry` 的预期是“失败后重试只生成一条记录”。同一个验证动作可以覆盖两个场景，也可按环境拆成多个验证动作。以下是一个验证动作的完整记录，以该故事已存在为前提。

```json
{
  "actions": {
    "A-check": {
      "title": "验证保存回显与失败重试",
      "kind": "验证",
      "stories": ["S-save"],
      "read_stories": ["S-save"],
      "contracts": [],
      "decisions": [],
      "depends_on": [],
      "covers": ["C-reopen", "C-retry"],
      "accepts": ["真实环境", "自动化"],
      "done": "重新打开后数量正确，重试没有重复数据"
    }
  }
}
```

`covers` 引用该验证动作关联故事中的场景 ID。每次采集绑定一个动作、一个场景和当前输入。以下例子在项目根目录执行，假设确有对应测试和真实截图。将 `REV` 设为每条命令执行前最新的数值，例如从 `next` 或上一条采集的输出读取。

```bash
FLOW=.agents/skills/requirement-flow/flow.py
python3 "$FLOW" task stock-save verify-run A-check --scenario C-retry --rev "$REV" --actor qa --environment '本地集成测试' -- python3 -m unittest -v tests.test_save.SaveTest.test_retry
python3 "$FLOW" task stock-save verify-observe A-check --scenario C-reopen --rev "$REV" --actor qa --environment 'UAT 真机' --level 真实环境 --artifact artifacts/reopen.png --actual '重新进入详情，数量显示 3'
python3 "$FLOW" task stock-save finish A-check --rev "$REV" --actor qa --output '保存回显与失败重试均已通过'
```

- **自动化检查。** `verify-run` 在项目根目录直接运行 `--` 后的命令和参数，保留标准输出、错误输出和退出码。退出 0 但合并输出为空或全为空白时，保留运行记录，该次运行无法提供有效成功证据。打开测试结果输出后重新采集，例如 `unittest -v`。只打印 “OK” 也可能退出 0，仍须对照测试和断言核对业务含义。
- **实测观察。** `verify-observe` 默认类型为 `人工核对`，也支持 `真实环境`。填写实际观察、环境并提供项目内本次实测产生的非空普通文件。观察失败时加 `--failed`。程序可核对附件和回执完整性，业务结果由观察者据实填写。只有样例页面截图时，真实接口的行为仍待验证。
- **完成或返工。** `finish` 从每个覆盖场景的成功回执取证。单独填写 `--evidence '已验证'` 无法补上缺失场景。失败采集写入记录并返回非零；用 `fail` 指定确需返工的 `--reopen` 动作、环境、预期和失败依据。场景、所读输入或依赖产出改变时，重新采集相关场景。调研和开发的 `finish` 写 `--output`、`--evidence`，即可留下结论与位置。

## 可在项目内复用的经验

第一次提出经验时，从该需求的 `next.scenarios[].receipts` 选取实际回执。提案 JSON 至少包含下列字段。故事、场景、验证动作和回执四个 ID 都必须指向同一次核验。

```json
{
  "id": "L-page-search",
  "observation": "只过滤首屏会遗漏后续门店",
  "when": "门店选择器使用分页目录",
  "practice": "先把关键词传给目录再分页，用首屏之外的门店验收",
  "boundary": "目录接口具备关键词查询能力",
  "tags": ["门店选择器", "/directory/stores"],
  "sources": [{ "story": "S-directory", "scenario": "AC-directory", "action": "A-check", "receipt": "E3" }]
}
```

项目根目录使用下列命令，每次写入前从 `next` 读取最新的 `REV`。独立审查者核对原始证据后用自己的身份写明结论。

```bash
FLOW=.agents/skills/requirement-flow/flow.py
python3 "$FLOW" task store-picker lesson-propose lesson.json --rev "$REV" --actor implementer
python3 "$FLOW" task store-picker lesson-review L-page-search approve --version 1 --rev "$REV" --actor reviewer --why '已复核查询与断言，首屏过滤时会漏搜'
python3 "$FLOW" lessons
python3 "$FLOW" task inspection-route next --story S-route-stop
```

`lessons` 返回本项目有效的已批准经验，`--all` 一并列出各版本、待审、驳回、待复核、替代和退役记录。模型中的 `lesson_cards` 与审查事件保存原始提案和版本，`lessons[]` 保留旧版笔记。项目清单从进行中和归档需求一起读取。项目级退役决定保存在 `.requirements/knowledge/retired/`，可在来源归档后执行：

```bash
python3 "$FLOW" lesson-retire store-picker L-page-search --version 1 --actor reviewer --why '门店目录已取消分页'
```

修改同卡后重新提案；新版本批准前，原有有效版本仍可使用。跨需求以新经验取代旧结论时，提案增加 `supersedes`，写原卡的 `task`、`id` 和 `version`。来源失效或结论被取代后，下次读取会更新推荐。功能图沿经验可打开来源场景和原始附件，离线页保留生成时的状态。

## 留存与旧需求

`model.json` 中的 `work.events` 记录执行者、版次和采集事件。该需求目录的 `evidence/<回执ID>/` 保存回执和命令日志或附件副本。归档会移动整个需求目录。请一并保留 `evidence/`，在当前需求或归档上运行 `task <ID> --check` 可核对图页和记录。

0.1.0 的无 ID 场景在 `context` 中显示派生的 `legacy-…` ID；续做时可将其用于 `covers`。新增或改写场景要给显式 ID。旧的完成文字保留为历史，当前验收按新采集的场景证据判断。已有归档快照保持只读。
