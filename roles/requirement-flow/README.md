# Requirement Flow

帮助模型把需求做到可复核的交付，同时留下人能读懂的业务脉络。面向能够自主判断和执行的模型：小任务直接做，出现新的业务约束、共享影响或验证缺口时扩展工作；不预设轻量/重型等级，也没有必经阶段。

## 安装与使用

```bash
airules install requirement-flow --host codex
airules verify requirement-flow --host codex
```

分发一个可自动发现的 `requirement-flow` skill，不要求项目初始化或记忆索引。网页阅读器按需启动；日常直接描述需求，或显式使用 `$requirement-flow`：

```text
修复保存后重开丢失数量的问题。
继续这个分支的撤销申请功能，核对哪些已经验证，补足剩余工作。
让第一次接手的人看懂当前库存业务及这次改动的影响。
```

Beta 0.13.0 替换旧设计，不支持旧 `flow.py` 命令和 `.requirements` 格式的自动升级。旧项目材料仍是历史来源，按需阅读；切换已有试验项目时先确认项目级旧技能/入口的归属，避免它们遮蔽新版用户级技能。保留项目业务与证据文件，不自动改写其他工作流。当前源代码尚需发布到角色远程分发版本后，安装命令才会取得这一版。

## 日常工作

开始时定位用户结果、当前实现和有关业务规则。判断可简短到无需写出。明确的局部修改直接实现并运行相关检查；“重构”“升级依赖”同样看实际影响。随着调查发现权限、状态流转、契约、共享调用方或恢复路径等约束，及时补充相应分析和验法。授权内的可逆实现选择由模型决定；缺失的业务决定只阻塞依赖它的部分。

交付前再核对最终影响和证据。只声明真实验证过的范围，分别说明实现、验证和部署状态。命令成功、记录齐全或测试总数都不能自动证明用户目标成立。

## 可继续的项目材料

优先复用项目已有文档、issue 和 PR，不另建平行系统。没有现成约定且确有需要时，用以下普通文件；按需要增量维护，不为小任务批量建模板：

| 材料 | 回答的问题 | 默认位置 |
| --- | --- | --- |
| 业务说明 | 谁为达成什么目标操作哪些对象；状态、规则、例外、外部依赖及依据 | `docs/business/index.md`，必要时链接专题 |
| 变更与接手记录 | 现状与目标差异、决定、影响、实际实现、尚缺什么和下一步 | `docs/changes/<id>.md` 或已有 issue/PR |
| 验证依据 | 哪种代码、环境和数据下实际观察到了什么，哪些未测 | 链接在变更记录内；日志/附件随项目约定保存 |

业务说明独立于任务历史，按业务对象与能力导航；新接手的人无需翻完整聊天才能理解系统。重要结论标明政策确认、代码观察或实测依据及适用范围。拟议规则先留在变更记录；本地实现或测试通过只更新相应范围，确认目标范围生效后再改该范围的业务现状。

对应写法见[业务说明](skills/requirement-flow/references/business.md)、[工作记录](skills/requirement-flow/references/work.md)、[验证与证据](skills/requirement-flow/references/verification.md)。技能正文按问题引导读取，不需要每次全部加载。

## 业务网页阅读

0.14.0 增加一套通用只读页面，直接读取项目 Markdown。业务内容、图表和关联都写在原文中；修改后刷新即可，不生成第二份业务 HTML 或知识模型。

```bash
python3 ~/.agents/skills/requirement-flow/scripts/reader.py --project /path/to/project \
  --entry docs/business/index.md --tasks docs/changes --port 8765
```

从终端打印的本机地址打开。页面提供业务导航、查询、Mermaid 流程和状态图、规则表、原文及来源查看。用 `[现状]`、`[拟议变更]`、`[实测结果]` 标记对应章节；分类只读取原文，不认证政策生效或验收完成。业务页与任务记录的普通 Markdown 链接定义关联，页面将已有任务记录展示成任务卡，并计算反向跳转。

`--tasks` 可重复指定目录或单个 Markdown；省略时仅在存在时读取 `docs/changes/`。不必为了页面迁移已有业务规范，入口可以位于项目原有目录。服务只监听本机、只读，不写项目文件；Python 3.9+ 即可使用，浏览器资源随技能分发，无运行时外网或 Node 依赖。格式、边界和操作见[阅读器说明](skills/requirement-flow/references/reader.md)。

在本仓库中用现有样例核验：选择一个尚不存在的输出目录，准备好后启动阅读服务。

```bash
python3 roles/requirement-flow/__test__/prepare_reader_example.py --output /tmp/requirement-flow-reader-example
python3 roles/requirement-flow/skills/requirement-flow/scripts/reader.py \
  --project /tmp/requirement-flow-reader-example --entry docs/business/index.md \
  --tasks inventory/docs/copy-decision.md --tasks library/docs/changes --port 8765
```

样例是已有库存、预约和维修合成项目的副本，附加的业务说明也只有 Markdown。核验完成后关闭服务并清理自己创建的样例目录。第三方浏览器资产的可复现准备脚本位于 `reader-build/`，只有维护这些程序资产时需要 Node。

## 可选的证据工具

需要长期保存命令运行依据或复核代码内容时，可使用技能内的 `scripts/evidence.py`，需要 Python 3.9+，无第三方依赖：

```bash
python3 ~/.agents/skills/requirement-flow/scripts/evidence.py run \
  --project /path/to/project --output docs/changes/evidence/save-01.json \
  --input src/inventory --input tests/test_inventory.py \
  -- python3 -m unittest tests.test_inventory -v

python3 ~/.agents/skills/requirement-flow/scripts/evidence.py check \
  --project /path/to/project docs/changes/evidence/save-01.json
```

记录实际命令、时间、退出码、日志和显式输入内容。目录输入含文件增删、未提交内容和执行位变化。运行期间发现变化会标记，复核时改变的输入/日志会失效。工具只报告执行与输入状态，不提供“业务通过”或任务完成标记；执行者仍须核对断言、输入范围以及真实部署和数据条件。采证不应包含凭据或私有数据。详细边界与人工实测写法见[验证与证据](skills/requirement-flow/references/verification.md)。

## 取舍与验证

删除动作 DAG、领取/署名状态机、固定失败次数硬锁、五专项技能、旧动作图及其服务、签名密钥、旧版迁移和 Basic Memory 经验账本。保留业务与实现/证据分离、影响重估、范围决定可追溯以及真实输入变化检测；业务阅读由按需启动的只读页面提供。有需要时用工作记录中的可选显式步骤和分工约定，不维护第二套编排引擎。

审查依据及架构决定见[设计记录](DESIGN.md)。自动检查和独立场景演练的实际结果及局限见[验证记录](VERIFICATION.md)，它们不等于已经证明所有模型的长期使用效果。
