# 需求编排

`requirement-flow` 是 AIRules 的独立 Codex 角色。一项需求有一张可筛选的功能图，沿任一故事可以查到用户操作、接口与字段、关键处理、待决定事项和验收结果。人读页面和 AI 记录共用同一份需求数据。

## 安装与升级

在包含本角色的 AIRules 检出中，可直接为项目初始化。需要 Python 3.9 或更高版本。

```bash
python3 roles/requirement-flow/skills/requirement-flow/flow.py --project /path/to/project init
```

包含本角色的 AIRules 版本发布后，也可先运行 `airules install requirement-flow --host codex` 和 `airules verify requirement-flow --host codex`，再执行 `python3 ~/.agents/skills/requirement-flow/flow.py --project /path/to/project init`。用户级安装让 Codex 发现六个 skills；每个项目各执行一次 `init`，才会有项目自己的六个 skill、一段 `AGENTS.md` 入口和 `.requirements/installation.json` 安装清单。

升级已有项目时，从更新后的 AIRules 分发目录运行 `python3 roles/requirement-flow/skills/requirement-flow/flow.py --project /path/to/project upgrade`。使用用户级安装时，先更新该安装，再从其 skill 目录运行同一条 `upgrade`。关闭该项目正在运行的需求图服务，升级后可沿用原端口重启。已有项目重复执行新版 `init` 也会走升级流程。

升级校验受管文件，并将新技能与进行中需求的离线页面一起更新。安装清单记录角色版本；命令列出实际刷新的需求 ID。原始模型、回执、项目规则和归档快照均保留。旧契约中的接口地址可以直接展开，共用字段保留在契约层。按来源补齐接口用途与各自的请求、响应后，可在接口行查看。通过 `plan` 修改契约会触发相关场景复核。

现有 Moluoxixi 项目需显式加 `--migrate`，旧 Codex 入口备份在 `.requirements/migrations/moluoxixi/`，原任务、独立 skill、其他 hooks 和项目规则保留。

使用本机 Git worktree 的项目可以在主工作区安装并提交，再按项目原有流程同步分支。需求的 `model.json`、`handbook.html` 和 `evidence/` 中的回执与附件一起保存。同一仓库的工作区通过 Git 公共目录里的本机密钥复核回执。备份仓库或迁移机器时应单独保管这些密钥，新克隆需要恢复密钥才能复核原始回执。

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

图页默认以 100% 展示功能卡和各自的验收进度。点「筛选功能」可搜索或多选，收起浮层后仍保留筛选范围。选择功能或切换「实现链路」，可以沿连线查看接口、处理、业务决定和验证记录。右上角的锁控制滚轮与双指缩放，初始锁定；锁定时仍可平移、手动加减。点击百分比恢复原大小，点击「适应画布」查看当前图的全貌。

在接口节点中，每行显示请求方法和业务用途。点击接口进入第二层抽屉，切换“请求字段”和“响应字段”查看该调用的字段、约束和来源。关闭后回到原接口列表。

“涉及文件与依据”可以预览引用行附近的源码，或用 WebStorm、VS Code 打开文件。复制到 Codex 或 Claude 对话的引用包含已定位工作树的完整路径和原始行号。离线页面或缺少文件时，复制的是项目相对引用。代码和需求图在不同 worktree 时，可在启动图服务时指定代码所在的同仓库检出：

```bash
python3 .agents/skills/requirement-flow/flow.py task plan-search serve --source-root /path/to/project-worktree
```

## 验收与归档

### 子代理与返工

总入口分派相互独立的工作，把功能、动作、场景和回执 ID 交给各执行者。经验提案由另一位实际审查者复核，可交给独立子代理或团队成员。项目使用本地执行者署名；宿主负责身份及可用权限。只有一位执行者时可继续其他就绪动作，候选经验保留待审。

验证失败会保存实际结果。`next` 和 `context` 的 `verification_followups` 给出受影响的动作、场景及失败回执；同一输入重复出现相同失败会建议独立诊断。修复后使用新回执重新验收相关场景。总入口通过项目命令取得这些状态，无需安装会话 hook。

### 项目经验

一个需求里发现可复用做法时，提案引用原故事、场景、验证动作和有效回执，并写明适用范围。通过独立审查的版本进入本项目经验库。下次读取 `next`、`claim` 或 `context` 时，AI 按功能标签、接口操作及字段取得相关经验和命中原因。每个新需求仍须用自己的证据交付。图上点开功能的“相关项目经验”，可查看适用条件、审查理由，沿原场景打开来源与日志，来源归档后也可访问。

`flow.py lessons` 查看本项目可复用的版本，`--all` 可追溯历次提案和审查。改版、替代和退役都有版本记录。旧版 `lessons[]` 作为历史笔记保留。安装器升级角色时保留项目经验与回执。提案字段与命令见[记录格式](skills/requirement-flow/references/model.md)。

### 场景证据

为每个验收例子分配稳定 ID，用验证动作的 `covers` 指向它负责的场景。每个场景分别通过 `verify-run` 保存实际测试命令、输出与退出码，或通过 `verify-observe` 保存真实观察、环境和项目内的附件。测试须输出可核对的结果，执行者还要确认断言覆盖业务预期。所有相关场景有当前有效的通过凭据后才能结束验证动作。比如，“保存成功”的提示可以证明界面反馈，要证明数据已保存，还需重新进入页面核对回显。[命令与示例](skills/requirement-flow/references/model.md)

交付型需求按场景检查完整性。确需撤出已承诺场景时，先记录本故事的业务决定，再在同一份计划补丁中登记撤出的场景和决定依据。原场景仍可查阅。只委托调研时，创建需求可加 `--outcome research`，按实际结论和依据收尾。调研中明确登记的验收场景也须逐条验证。结束后用 `archive <需求ID>` 将模型、图页和已采集的 `evidence/` 一起移入 `.requirements/archive/<需求ID>/`。若明确要冻结未完成工作，可用 `--allow-incomplete` 保留原状态。旧版自由文本记录可继续查阅；续做的旧交付需求须补上场景覆盖与实际证据。
