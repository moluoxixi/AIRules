# 需求编排

`requirement-flow` 是 AIRules 的独立 Codex 角色。一项需求有一张可筛选的功能图，沿任一故事可以查到用户操作、接口与字段、关键处理、待决定事项和验收结果。人读页面和 AI 记录共用同一份需求数据。

## 安装与升级

在包含本角色的 AIRules 检出中，可直接为项目初始化。需要 Python 3.9 或更高版本。

```bash
python3 roles/requirement-flow/skills/requirement-flow/flow.py --project /path/to/project init
```

包含本角色的 AIRules 版本发布后，也可先运行 `airules install requirement-flow --host codex` 和 `airules verify requirement-flow --host codex`，再执行 `python3 ~/.agents/skills/requirement-flow/flow.py --project /path/to/project init`。用户级安装让 Codex 发现六个 skills；每个项目各执行一次 `init`，才会有项目自己的六个 skill、一段 `AGENTS.md` 入口和 `.requirements/installation.json` 安装清单。

升级已有项目时，从更新后的 AIRules 分发目录运行 `python3 roles/requirement-flow/skills/requirement-flow/flow.py --project /path/to/project upgrade`。使用用户级安装时，先更新该安装，再从其 skill 目录运行同一条 `upgrade`。关闭该项目正在运行的需求图服务，升级后可沿用原端口重启。已有项目重复执行新版 `init` 也会走升级流程。

升级校验受管文件，并将新技能与进行中需求的离线页面一起更新。安装清单记录角色版本；命令列出实际刷新的需求 ID。原始模型、回执、项目规则和归档快照均保留。将已有单需求端口改作项目首页时，用 `serve --port <原端口> --default-task <原需求ID>` 启动，旧收藏和已打开的图页仍能找到原需求。旧契约中的接口地址可以直接展开，共用字段保留在契约层。按来源补齐接口用途与各自的请求、响应后，可在接口行查看。通过 `plan` 修改契约会触发相关场景复核。

现有 Moluoxixi 项目需显式加 `--migrate`，旧 Codex 入口备份在 `.requirements/migrations/moluoxixi/`，原任务、独立 skill、其他 hooks 和项目规则保留。

使用本机 Git worktree 的项目可以在主工作区安装并提交，再按项目原有流程同步分支。需求的 `model.json`、`handbook.html` 和 `evidence/` 中的回执与附件一起保存。同一仓库的工作区共用本机签名密钥。迁移或克隆时，从可信备份恢复 Git 公共目录（`git rev-parse --git-common-dir`）下的 `airules-requirement-flow-keys/`；非 Git 项目恢复该需求 `evidence/.receipt-key`。已有回执的需求缺少原密钥时，旧回执无法复核，新采集也无法登记。若原密钥无法找回，保留历史需求，另建需求引用原 ID，并重新验收。密钥应与分发文件分开保管。

自动化回执默认只分发运行摘要。需要随需求保存可公开的命令和原始日志时，在 `verify-run` 的 `--` 之前加 `--share-output`。人工附件按原文件保存，采集前检查其可分发范围。升级会保留历史回执和归档快照，已分发的旧日志须单独处理。

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
python3 "$FLOW" serve
```

`serve` 输出项目需求中心的本机 URL。可以搜索需求、切换进行中和归档，在卡片上查看已有证据支持的进度。点击卡片进入需求图，点左上角「需求中心」回到刚才浏览的位置。需要专门打开一张图时，使用 `task plan-search serve`。离线可打开 `.requirements/active/plan-search/handbook.html`；AI 可读同目录 `model.json`，或用 `task plan-search context <故事ID>` 只读取一个功能。

有验收场景的卡片按「有有效通过证据的场景数 / 当前场景数」计算。仅调研且没有场景的需求按调研项计量。迁移的历史记录缺少可复核的验收证据时显示「历史记录待复验」。进入归档卡片可只读查阅原始记录。

图页默认以 100% 展示功能卡和各自的验收进度。点「筛选功能」可搜索或多选，收起浮层后仍保留筛选范围。选择功能或切换「实现链路」，可以沿连线查看接口、处理、业务决定和验证记录。右上角的锁控制滚轮与双指缩放，初始锁定；锁定时仍可平移、手动加减。点击百分比恢复原大小，点击「适应画布」查看当前图的全貌。

需求中心的卡片显示标题、状态和进度。将鼠标移到卡片上或用键盘聚焦，可查看完整说明和验收详情；手机点卡进入需求图。在线图页与原始证据页的头部提供「首页」，可直接回到当前项目的需求中心。

从功能详情点进关联节点，再选具体接口，可以继续查看请求字段、响应字段和接口依据。点「预览」会在独立抽屉打开原文，高亮引用行。点左上角返回、按 Esc 或使用浏览器后退，可以逐层回到刚才的阅读位置。复制浏览器地址可在同一本机图服务直达当前详情。

“涉及文件与依据”提供 WebStorm、VS Code 和复制引用入口。复制到 Codex 或 Claude 对话的引用包含已定位工作树的完整路径和原始行号。离线页面或缺少文件时，复制的是项目相对引用。代码和需求图在不同 worktree 时，可在启动图服务时指定代码所在的同仓库检出。

```bash
python3 .agents/skills/requirement-flow/flow.py serve --source-root /path/to/project-worktree
```

## 验收与归档

### 子代理与返工

总入口分派相互独立的工作，把功能、动作、场景和回执 ID 交给各执行者。经验提案由另一位实际审查者复核，可交给独立子代理或团队成员。项目使用本地执行者署名；宿主负责身份及可用权限。只有一位执行者时可继续其他就绪动作，候选经验保留待审。

验证失败会保存实际结果。`next` 和 `context` 的 `verification_followups` 给出受影响的动作、场景及失败回执。同一场景、输入、命令和环境连续失败时，`claim` 安排独立诊断动作；其他已就绪动作仍可领取。诊断者通过现有 `claim`、`finish` 留下结论和依据，再修复、重测相关场景。执行者使用稳定署名，宿主负责保证实际身份和审查独立性。

### 项目经验

将经验提案绑定到原故事、验收场景和回执。另一位审查者通过后，需求模型保存批准记录，并在 `.requirements/knowledge/lessons/` 生成可读的 Markdown。把需求、证据和经验随同项目提交。每个 worktree 接收这些文件后，可以启用自己的 Basic Memory 本地全文索引。首次启用需安装 uv，并能取得 Python 3.12 和固定版本 `basic-memory==1.0.0`。CLI 的 `new`、`next`、`context` 和 `claim` 查询本机索引，支持中文。共享图页按标签、接口和字段匹配经验，采用记录仍按原版本展示。

```bash
FLOW=.agents/skills/requirement-flow/flow.py
python3 "$FLOW" memory enable
python3 "$FLOW" memory status
```

`new` 根据需求原话查经验，`next`、`context` 和 `claim` 按当前故事或动作查。AI 核对推荐理由、适用范围和原始证据，再用 `lesson-adopt` 记录这次采用的理由及具体版本。每个需求用自己的场景证据验收。图上从采用记录可回到原需求、场景和附件。退役后新需求停止收到该版本，历史采用仍能查到当时的理由。

索引和配置保存在各工作区本机。同步项目文件后可执行 `memory sync` 重建索引；只有经过当前模型和原始回执复核的版本能进入推荐。索引故障时，批准记录和 Markdown 保留，提示待同步，可用 `memory sync` 重试。自动索引命令共用 5 秒预算，超时则按项目标签、接口和字段查询。`lessons --all` 可以追溯历史审查、替代和退役。提案字段、采用及退役命令见[记录格式](skills/requirement-flow/references/model.md#可在项目内复用的经验)。

### 场景证据

从 0.9.0 起，验证回执绑定实际代码内容，包括未提交修改及子模块。可在验证动作的 `code_paths` 中限定实现、测试和配置范围；未指定时使用当前项目的默认范围。代码改变后，场景显示待复验。旧回执缺少这份绑定，升级后保留为历史依据，不自动代表当前代码已通过；已采用经验仍能追到完整的原始回执。范围与升级规则见[验证所用的代码](skills/requirement-flow/references/model.md#验证所用的代码)。

为每个验收例子分配稳定 ID，用验证动作的 `covers` 指向它负责的场景。每个场景分别通过 `verify-run` 保存实际测试命令、输出与退出码，或通过 `verify-observe` 保存真实观察、环境和项目内的附件。测试须输出可核对的结果，执行者还要确认断言覆盖业务预期。所有相关场景有当前有效的通过凭据后才能结束验证动作。比如，“保存成功”的提示可以证明界面反馈，要证明数据已保存，还需重新进入页面核对回显。[命令与示例](skills/requirement-flow/references/model.md)

交付型需求按场景检查完整性。确需撤出已承诺场景时，先记录本故事的业务决定，再在同一份计划补丁中登记撤出的场景和决定依据。原场景仍可查阅。只委托调研时，创建需求可加 `--outcome research`，按实际结论和依据收尾。调研中明确登记的验收场景也须逐条验证。结束后用 `archive <需求ID>` 将模型、图页和已采集的 `evidence/` 一起移入 `.requirements/archive/<需求ID>/`。若明确要冻结未完成工作，可用 `--allow-incomplete` 保留原状态。旧版自由文本记录可继续查阅；续做的旧交付需求须补上场景覆盖与实际证据。
