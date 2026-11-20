# 计划与证据

项目工具位于 `.agents/skills/requirement-flow/flow.py`。用 `task <需求ID> context [故事ID]` 读取当前版次、故事、契约、决定和场景验收情况。`plan` 接受 UTF-8 JSON，仅提交要改的栏目，按 ID 修改单条记录时传入该条完整对象。每次写入使用刚读到的 `revision`，发生冲突时重新读取相关记录。

不同场景可以并行采集，工具按最新需求版次分别登记回执。如果采集期间该动作被交接、同一场景已有新记录，或关联代码、输入发生变化，先核对新状态再采集。

| 栏目 | 要记录的内容 |
| --- | --- |
| `stories` | `title`、`actor`、`goal`、`before`、有序的关键处理 `flow`、来源 `basis` 和验收 `examples`。每个新增或改写的例子含本需求内唯一的 `id` 及具体的 `given`、`when`、`then`。 |
| `contracts` | `title`、`operation`、`state`（`open` 或 `confirmed`）、`status`、`source`、`fields`。HTTP 契约可在 `endpoints` 中[按接口记录字段](#按接口记录字段)。 |
| `decisions` | `title`、`why`、`owner`、`stories`、`options`。每个选项有 `label` 和 `consequence`，收到实际决定后通过 `decision` 写回。 |
| `actions` | `title`、`kind`（调研、开发、验证）、`stories`、`read_stories`、`contracts`、`decisions`、`depends_on`、`done`。无对应关系时填空数组。`read_stories` 表示哪些故事改动会影响该动作产出。 |
| `lessons` | `observation`、`when`、`practice`、`boundary`、`evidence`、`review`。确认有复用价值后，将适用条件、边界和依据写入当前需求。 |

动作或依赖边可加 `when: {"decision":"D-range","is":"all"}` 指定生效条件。接口调研用 `closes_contracts` 声明负责确认的契约。调度默认依动作分配专项工作方法；需要时用动作的 `skill` 指定五个专项之一。`next` 返回建议动作的 `skill`，待复核的交付还可返回 `review_skill`。

一个决定仅供已跳过分支使用时，普通归档可以完成。重新选择该分支后，尚未回答的决定会回到待办。独立于动作的决定，以及当前动作使用的决定，继续等待业务确认。

用 `decision <决定ID> <原选项> --why '订正后的理由' --actor <订正人> --rev <版次>` 更正已选方案的说明。记录保留原选择人、旧理由、订正人和新理由，既有验收继续有效。修改选项会要求相关动作复核。通过 `plan` 修改整项需求的 `goal` 或 `scope` 会让所有仍适用的动作重新核对输入，验证动作需要采集新的通过凭据。

换班时用 `handoff <动作ID> --from <当前执行者> --actor <接手人> --why '交接原因' --rev <版次>` 转交进行中的动作。接手人的 `next` 可以继续该动作，原执行者不能再写入该动作的完成结果。独立诊断仍须由原失败执行者之外的人接手。

## 按接口记录字段

`operation` 写契约涉及的业务流程。`endpoints` 的每一条对应一个 HTTP 方法和路径组合。将下面这样的条目放入数组，用 `purpose` 说明点击后能了解哪个业务操作。`source` 指向本接口的定义、调用点或实测记录，多条引用分行书写。

```json
{
  "method": "POST",
  "path": "/stock/save",
  "purpose": "保存盘点数量",
  "request": [
    { "name": "quantity", "type": "integer", "constraint": "必填，允许 0", "use": "提交本次实盘数量" }
  ],
  "response": [
    { "name": "recordId", "type": "string", "constraint": "保存成功时返回", "use": "重新打开本次盘点记录" }
  ],
  "source": "src/api/stock.ts:18"
}
```

每个方向分别写 `name`、`type`、`constraint`、`use`。嵌套字段写完整路径，如 `items[].storeId`。空列表表示该方向尚未列出字段。已确认空请求、无响应正文或缺少字段依据时，用 `requestNote`、`responseNote` 写明具体情况。不同接口可复用同名字段，每条只收录本接口实际收发的字段。

契约级 `fields` 用于共享口径或尚未定位到具体接口的旧字段。新记录中没有这类字段时填 `[]`。旧记录可继续按原格式读取。用 `plan` 显式补录接口会修订契约，按 `next` 提示复核受影响的动作和场景。

## 缩小已确认的范围

常规 `plan` 保留已有场景。同一 ID 下修订预期后，重新验收该场景。若决定把“失败重试”移出本期范围，先将范围问题 `D-retry-scope` 关联到故事 `S-save`，由实际决定人选定 `defer`。再在同一份补丁中提交完整的 `stories.S-save`（移除 `C-retry`）、受影响动作的完整记录（同步调整 `covers`），以及以下顶层字段。

```json
{ "retire_scenarios": { "C-retry": { "decision": "D-retry-scope", "is": "defer" } } }
```

`is` 填实际选中的选项代码。移除或更换场景 ID 缺少匹配决定时，计划更新会被拒绝。可用 `context` 或 `next` 返回的 `retired_scenarios` 查阅原场景及其决定。若决定改为本期交付，场景会重新列为未覆盖，按原 ID 补回后需要重新验收。

整个功能延期时，可在同一补丁撤出它的全部场景，把 `examples` 和对应验证动作的 `covers` 清空。只有已有完整撤出记录、且范围决定仍有效的故事会列入 `withdrawn_stories`，仅服务这些故事的动作随之跳过；共享动作仍按其余功能和依赖推进。图页保留功能及决定依据，标为“本期已撤出”，不计作已验收。决定改回本期后，原场景恢复为待覆盖，补回原 ID 并重新验收。新建空场景故事不能用来绕过验收。

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
      "code_paths": ["src/stock", "tests/test_save.py", "package.json"],
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

- **自动化检查。** `verify-run` 从项目根目录执行 `--` 后的命令。默认只保存签名运行摘要，包含退出码、是否有输出及可识别的测试计数。非零退出、空白输出、运行器报告零执行或全跳过均不能通过。自定义命令须确有业务断言，执行者在 `finish` 前核对结果。确认参数和输出可公开后，可在 `--` 前加 `--share-output` 保存原命令和合并日志；检测到常见凭据标记时仍只保存摘要。
- **实测观察。** `verify-observe` 默认类型为 `人工核对`，也支持 `真实环境`。填写实际观察、环境并提供项目内本次实测产生的非空普通文件。观察失败时加 `--failed`。程序可核对附件和回执完整性，业务结果由观察者据实填写。只有样例页面截图时，真实接口的行为仍待验证。
- **完成或返工。** `finish` 从每个覆盖场景的成功回执取证。单独填写 `--evidence '已验证'` 无法补上缺失场景。失败采集写入记录并返回非零；用 `fail` 指定确需返工的 `--reopen` 动作、环境、预期和失败依据。场景、所读输入或依赖产出改变时，重新采集相关场景。调研和开发的 `finish` 写 `--output`、`--evidence`，即可留下结论与位置。

### 验证所用的代码

验证动作可用非空 `code_paths` 声明项目内的代码、测试及配置文件或目录。`next`、`claim` 的动作包返回 `verification_project_root`（采集绑定的项目根）和 `code_paths`（`null` 表示默认范围）。范围须覆盖实际执行所依赖的实现；命令和人工观察应核对这些输入，远端环境另记录实际部署版本。路径相对当前需求所属项目，目录会包含其内容；忽略的源码也可显式纳入。外部或循环链接无法建立可靠输入，会要求调整范围。命令若转到另一检出或访问远端部署，运行器不能自动证明那里的版本就是已绑定文件。

不指定范围时，Git 项目默认核对已跟踪文件和未忽略的新文件，并递归核对已检出的子模块、根目录直接子目录中的独立 Git 仓库（含被根仓忽略的业务子仓）；隐藏目录和依赖目录不参与子仓发现。无 Git 项目核对项目文件，排除常见依赖、缓存和需求记录。内容摘要包括路径、文件内容和可执行位，既识别未提交修改，也识别子仓库实际内容。仅提交需求记录、归档或在相同代码的 worktree 间同步不会使其失效。

截图、日志和报告也可能落入默认范围，后续新增附件会使先前场景待复验。采集前先设置上例这样的 `code_paths`，把 `artifacts/` 等运行产物留在范围外；Git 项目同时将原始产物目录加入 `.gitignore`，避免污染工作区。已跟踪产物不受 `.gitignore` 排除；无 Git 项目也须用 `code_paths` 明确范围。程序会把观察附件复制到需求的 `evidence/`，该副本随需求留存且不参与代码摘要。

采集前后输入变化时，运行记录仍保留，但不能提供成功证据。后续代码输入变化会使场景变为待复验；重新运行验证并 `finish` 后才恢复通过。0.9.0 以前缺少代码绑定的回执升级后同样待复验，升级不会把当前代码追认为旧测试所用版本。完整的历史回执及已采用经验的原始依据仍可查看，损坏或被篡改的附件继续拒绝读取。

同一场景、模型输入、代码、命令和环境连续失败时，`verification_followups` 转交独立审查。日志中的时间戳或耗时不会清零计数；实际输入改变或中间取得成功回执后重新计数。日志 SHA-256 仍用于核验完整性。

`claim` 将待诊断的失败串登记为普通 `kind: 调研`、`skill: flow-review` 动作，原验证依赖该诊断。其 `review_for` 绑定原验证、场景快照、失败事件与执行者，不能通过 `plan` 改写来源或删去仍适用的诊断依赖。动作包的 `failed_evidence` 提供原始失败依据。原失败执行者可继续其他就绪动作，实际独立的执行者领取诊断后，用现有 `finish` 写入结论和复现依据；身份由宿主保证。诊断完成后重新验证，后续再次连续失败会产生新的诊断。只有经已确认的范围决定撤下相关场景，诊断才随之退出本期。

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
python3 "$FLOW" task inspection-route lesson-adopt store-picker L-page-search --version 1 --story S-route-stop --why '路线选店也使用分页目录，回归增加首屏之外的匹配门店。' --actor developer --rev "$REV"
```

`lessons` 返回本项目有效的已批准经验，`--all` 一并列出各版本、待审、驳回、待复核、替代和退役记录。模型中的 `lesson_cards` 与审查事件保存原始提案和版本，`lessons[]` 保留旧版笔记。项目清单从进行中和归档需求一起读取。项目级退役决定保存在 `.requirements/knowledge/retired/`，可在来源归档后执行：

```bash
python3 "$FLOW" lesson-retire store-picker L-page-search --version 1 --actor reviewer --why '门店目录已取消分页'
```

采用命令使用目标需求的当前版次。历史采用保留当时的理由、执行者和来源版本，可从目标故事打开来源场景与回执。

修改同卡后重新提案；新版本批准前，原有有效版本仍可使用。跨需求以新经验取代旧结论时，提案增加 `supersedes`，写原卡的 `task`、`id` 和 `version`。来源失效或结论被取代后，下次读取会更新推荐。功能图沿经验可打开来源场景和原始附件，离线页保留生成时的状态。

## 留存与旧需求

`model.json` 中的 `work.events` 记录执行者、版次和采集事件。界面和经验使用采集事件号（如 `E3`）。磁盘使用独立生成的 32 位十六进制目录名。按采集结果的 `artifact.path` 从需求目录定位附件，同目录的 `receipt.json` 是签名回执。归档会移动整个需求目录。请一并保留 `evidence/`，在当前需求或归档上运行 `task <ID> --check` 可核对图页和记录。

项目内的历史文档搬家时，可在 `.requirements/source-paths.json` 登记目录映射。例如 `{"version":1,"directories":{"old-notes/":"docs/history/"}}`。两个目录都写成以 `/` 结尾的项目相对路径。图页和动作上下文会把单独占一行的文件引用指向实际存在的新文件，保留行号和列号。历史引用保存在 `model.json`。给已有故事或契约提交 `plan` 时，从原始模型取完整记录并只改本次调整的字段，以保留无关场景的证据绑定。

0.1.0 的无 ID 场景在 `context` 中显示派生的 `legacy-…` ID；续做时可将其用于 `covers`。新增或改写场景要给显式 ID。旧的完成文字保留为历史，当前验收按新采集的场景证据判断。已有归档快照保持只读。
