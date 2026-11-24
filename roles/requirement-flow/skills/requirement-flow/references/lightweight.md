# 轻量需求交付

`requirement-flow` 的轻量入口将故事卡、实现依据和逐场景验收写进同一份需求记录。AI 用 CLI 读写 `model.json`，人看该记录生成的 `handbook.html`；两者共用版次，不维护两份状态。默认用在范围明确的新交付需求；现有需求不自动转换。

## 保留什么，何时加编排

| 能力 | 使用边界 |
| --- | --- |
| 原话、故事、验收场景、实现依据、真实回执 | 始终保留。卡片按可单独交付、验收或延期的用户结果拆；同一结果的正常、失败和恢复集中在同一张卡。 |
| 澄清待办、手工建动作、领取、启动、验证 `finish` | 轻量路径不要求这些操作。运行时保留内部关联，沿用已有版次、工作区、回执签名及依赖检查。 |
| 业务决定与接口契约 | 取舍影响产品范围或接口事实尚未确认时，用原 `plan`/`decision` 记录。只阻塞受影响的动作；收窄既有承诺须保留范围决定。 |
| 并行与独立复核 | 真要分给不同执行者时，先核对共享文件和接口、输入产出与可独立验收范围，再按原动作机制分派。高影响或跨层变更可加独立复核动作：让审查者核对同一检出及实际回执，复核依赖被验收的动作。工具不自动派代理。相同输入连续失败沿用独立诊断。 |
| 专项 skill、归档、项目经验 | 各专项按问题调用，不是必经阶段。归档保留模型、图页和证据；知识采用不代替本次实测。待审经验仍适用原归档保护，不参与交付验收的通过计数。 |

## 默认三步

以下从已启用的项目根运行；`REV` 表示上一条写入回执或最新 `context`/`delivery-check` 的 `revision`，每次写入后更新，冲突时重读再提交。首次启用用分发目录的 `flow.py --project <项目> init`，已有安装用新版分发目录的 `upgrade`。

### 1. 登记可验收的故事

```sh
FLOW=.agents/skills/requirement-flow/flow.py
python3 "$FLOW" new stock-save --light --request '门店员保存数量后，重新打开仍显示保存值'
python3 "$FLOW" task stock-save cards /path/to/cards.json --rev "$REV" --actor dev --why '确认重开回显'
```

`cards.json` 示例（路径和命令替换成项目的真实入口）：

```json
{
  "stories": {
    "S-save": {
      "title": "保存后重开回显",
      "actor": "门店员",
      "goal": "再次打开记录时看到已保存的数量",
      "basis": "需求原话；原型库存详情页的保存入口",
      "before": "当前记录可编辑",
      "flow": ["提交数量", "关闭详情", "重新读取记录并展示数量"],
      "examples": [
        { "id": "AC-reopen", "given": "数量原为 2", "when": "改为 3、保存并重新打开", "then": "显示已保存的 3" }
      ]
    }
  },
  "checks": {
    "AC-reopen": {
      "level": "自动化",
      "environment": "本机测试库",
      "expected": "重开查询断言返回 3，不只断言保存提示",
      "argv": ["python3", "-m", "unittest", "tests.test_stock.StockTest.test_reopen", "-v"]
    }
  },
  "code_paths": { "AC-reopen": ["src/stock", "tests/test_stock.py"] }
}
```

故事至少写清 `title/actor/goal/basis/examples`；业务前置条件和处理步骤可补 `before/flow`。每个例子用稳定 ID 和具体的 `given/when/then`。修改故事传整条记录，同一场景保留 ID。仅改某一场景的验法或代码范围时，可以只提交 `checks` 或 `code_paths`；省略的项保留，某个场景显式填 `null` 则移除对应设置。

`checks` 是可选的**预写验法**，不等于结果。自动化用 `level: 自动化` 和 `argv` 参数数组；人工用 `level: 人工核对` 或 `真实环境`、`steps` 操作列表。两者都写 `environment` 与 `expected`。指定后，采证的方式、环境名称以及自动化参数须与计划一致。通过标准由执行者对照断言或观察核实，不是填写一段文字就通过。`checks` 会进入需求记录和图页，勿写私密参数、凭据或私有数据；登记计划不会执行其中的命令。已有编排需求也可在验证动作里以相同格式填写 `checks`，键须属于 `covers`。

`code_paths` 按场景限制验证绑定的项目内代码、测试、配置和必要输入。未填写使用原有项目默认范围；不要为了减少复验而漏掉共享实现。只有确有业务决定时才撤出场景：先用 `plan`/`decision` 记录选择，再在一份 `cards` 补丁同时修改故事、用 `retire_scenarios` 按场景 ID 填写 `{ "decision": "D-scope", "is": "later" }`。若也有手工维护的共享验证动作，在同一份原 `plan` 更新那些覆盖关系和轻量关联。撤下保留历史、原检查计划和代码范围，不算通过；决定反转后恢复原 ID，按原验法重新采证。

### 2. 按故事登记实现，按场景采证

```sh
python3 "$FLOW" task stock-save implement S-save --rev "$REV" --actor dev \
  --output '保存后重新查询记录，界面采用回读值' --evidence 'src/stock/save.py:42'
python3 "$FLOW" task stock-save verify-run AC-reopen --rev "$REV" --actor dev --environment '本机测试库' \
  -- python3 -m unittest tests.test_stock.StockTest.test_reopen -v
```

`implement` 写实际行为、处理路径和可复核依据，可用 `--implementation` 引用[结构化实现详情](model.md#实际实现与业务约定)。它可更新该故事的实现登记。只改实现说明不重置已有通过或重复失败记录；验收按实际代码和业务输入判断是否要重验。业务约定仍在故事里；实现记录不自行改写预期。

人工/真机场景用 `verify-observe <场景ID> --rev … --actor … --environment … --level 真实环境 --actual '实际结果' --artifact <本次实测路径>`；非真机人工用 `人工核对`，失败用 `--failed`。使用真实环境前核对实际部署版本、数据和访问入口，附件不得复用旧回执或包含敏感信息。工具验证回执和输入完整性，业务结果、部署版本及操作真实性由实际执行者核对。

轻量采证通过后在同一事务内把本场景的回执用于验收，无需再调用验证 `finish`。失败结果保留且不能通过交付检查。采证前后会额外对比文件身份和时间标记；所验文件在运行中被改写，即使内容恢复也应重测。工具并不隔离工作区，检查期间不要修改输入。输入或同场景记录冲突时先核对实测，再重采，不把被拒收的结果当凭据。旧编排动作仍用 `<动作ID> --scenario <场景ID>` 采证，并按原规则确认完整 `covers`。

### 3. 用当前证据判定是否交付

```sh
python3 "$FLOW" task stock-save delivery-check --actor dev
```

`implement` 和旧 `finish` 默认回传结构化 JSON：写入是否成功、版次、动作种类和 `delivery`。写入成功的退出码是 **0**，即使验收仍有缺口；只依赖旧版次文本的脚本可用 `finish --plain`。`delivery-check` 是整项需求的只读检查，**0 表示当前可交付；1 且有报告表示仍有缺口；命令或数据错误见 stderr**。使用 `ready_to_deliver` 判断，不只看最后一张卡或通过计数。它不执行测试，不发布、不部署，也不把一次绿灯存成永久的交付结论。改码、改范围或换了实际验收环境后重新核对；已采证且仍有效的场景不用重跑。

`delivery`/`delivery-check` 报告包括 `acceptance`（通过/本期场景）、已验证/未验证/撤出故事、待决定项、未结束动作以及专属 `check_suggestions`。建议按故事、场景和验证动作列出原因、下一步、已有回执或已登记验法。`reverify` 表示按当前输入补验，`collect_evidence` 表示首次采证，`confirm_verification` 表示原编排覆盖的全部凭据均已齐、仍需确认；共享动作有其它场景缺证时用 `await_shared_coverage`，先补那些场景。另有未覆盖、范围恢复、待前置条件、他人持有和失败诊断。报告给出当前状态，不把待复验一律归因于刚执行的写入。

用 `serve` 看需求中心，故事详情分开显示实现、验收进度和可展开的检查计划、来源、实际回执。`task <ID> --check` 仍检查两份记录一致性，不取代 `delivery-check`。有条件的缺口在当前授权内补齐；缺真实环境、权限或业务回答时，交接具体缺口，不宣称验收完成。结束后可用 `archive <ID>`；`--allow-incomplete` 是保留未完成进度，不是验收放行。归档内容只读，不作为当前候选的放行依据。

## 旧流程与复验例子

`new` 不带 `--light` 保持原编排入口，`--outcome research` 保持调研流程；新流程不改写既有模型、回执或归档。轻量验收继续使用原有[证据校验与输入绑定](model.md#验证所用的代码)。本轮实现的典型对比：只改保存卡所绑定的代码，保存由通过变为待复验，搜索的有效凭据仍保留；登记实现后回执直接指出待复验的保存场景。补验保存前整项检查返回不通过，补验成功后不必重跑搜索。
