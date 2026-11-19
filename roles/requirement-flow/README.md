# 需求编排

`requirement-flow` 是 AIRules 的独立 Codex 角色。一项需求有一张可筛选的功能图，沿任一故事可以查到用户操作、接口与字段、关键处理、待决定事项和验收结果。人读页面和 AI 记录共用同一份需求数据。

## 安装与升级

在包含本角色的 AIRules 检出中，可直接为项目初始化。需要 Python 3.9 或更高版本。

```bash
python3 roles/requirement-flow/skills/requirement-flow/flow.py --project /path/to/project init
```

包含本角色的 AIRules 版本发布后，也可先运行 `airules install requirement-flow --host codex` 和 `airules verify requirement-flow --host codex`，再执行 `python3 ~/.agents/skills/requirement-flow/flow.py --project /path/to/project init`。用户级安装让 Codex 发现六个 skills；每个项目各执行一次 `init`，才会有项目自己的六个 skill、一段 `AGENTS.md` 入口和 `.requirements/installation.json` 安装清单。

从新版本的 AIRules 或已更新的用户级 skill 再次 `init` 即可升级，也支持已使用 0.1.0 的项目。进行中与已归档的数据均保留。遇到团队改过的受管文件或已有同名 skill，安装器会指出冲突路径。现有 Moluoxixi 项目需显式加 `--migrate`，旧 Codex 入口备份在 `.requirements/migrations/moluoxixi/`，原任务、独立 skill、其他 hooks 和项目规则保留。

## 一个入口与五个专项

项目的默认入口是 `requirement-flow`。它读当前需求图和授权范围，组合五种工作方法。动作可以跳过、重复或并行。例如，已确认字段的小修复可直接开发，接口待确认只影响使用该接口的故事。

| 专项 skill | 使用时机和交付物 |
| --- | --- |
| `flow-requirements` | 需求边界或状态不清时，把原话拆成故事、具名场景和待决定问题。 |
| `flow-contracts` | 核对操作到请求、响应和回显的字段链，记录来源和契约缺口。 |
| `flow-implement` | 依据已确认范围开发，回写实际代码位置、关键处理和异常分支。 |
| `flow-verify` | 按场景运行断言，或登记真实观察及附件，指出失败与未覆盖项。 |
| `flow-review` | 独立复核需求、实现与证据是否一致，给出有依据的发现。 |

## 查看和推进需求

在已启用的项目中，可以直接告诉 Codex 要做什么。以下命令从项目根目录运行，`plan-search` 是示例需求 ID。

```bash
FLOW=.agents/skills/requirement-flow/flow.py
python3 "$FLOW" list
python3 "$FLOW" new plan-search --request '门店人员可以按名称查找方案'
python3 "$FLOW" task plan-search next --actor developer
python3 "$FLOW" task plan-search serve
```

`serve` 输出本机 URL，支持筛选、查看处理与证据、登记业务决定。离线可打开 `.requirements/active/plan-search/handbook.html`；AI 可读同目录 `model.json`，或用 `task plan-search context <故事ID>` 只读取一个功能。

## 验收与归档

为每个验收例子分配稳定 ID，用验证动作的 `covers` 指向它负责的场景。每个场景分别通过 `verify-run` 保存实际测试命令、输出与退出码，或通过 `verify-observe` 保存真实观察、环境和项目内的附件。测试须输出可核对的结果，执行者还要确认断言覆盖业务预期。所有相关场景有当前有效的通过凭据后才能结束验证动作。比如，“保存成功”的提示可以证明界面反馈，要证明数据已保存，还需重新进入页面核对回显。[命令与示例](skills/requirement-flow/references/model.md)

交付型需求按场景检查完整性。确需撤出已承诺场景时，先记录本故事的业务决定，再在同一份计划补丁中登记撤出的场景和决定依据。原场景仍可查阅。只委托调研时，创建需求可加 `--outcome research`，按实际结论和依据收尾。调研中明确登记的验收场景也须逐条验证。结束后用 `archive <需求ID>` 将模型、图页和已采集的 `evidence/` 一起移入 `.requirements/archive/<需求ID>/`。若明确要冻结未完成工作，可用 `--allow-incomplete` 保留原状态。旧版自由文本记录可继续查阅；续做的旧交付需求须补上场景覆盖与实际证据。
