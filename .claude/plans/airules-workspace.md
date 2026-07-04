# knowledge/ + openspec/ 工作区 — change(OpenSpec) + 会话沉淀 + skill 提炼

## 目标（用户确认）

给用户项目接入 `knowledge/ + openspec/` 工作区，三块能力：
1. **change 工作流**：装官方 OpenSpec CLI，用 stores 把工作目录落在 `openspec/`。
2. **会话沉淀**：自建 `session-capture` skill，写 `knowledge/sessions/`。
3. **skill 提炼**：自建 `skill-distill` skill，扫 sessions/changes → `knowledge/skills-candidates/` 待用户审核。

## 已确认决策

- change 用官方 OpenSpec CLI（不自建、不 fork）。
- 收进 `openspec/`（接受多一层 openspec/、命令文件落宿主目录、软门禁、全局依赖）。
- 沉淀与 handoff 分开两个独立 skill。
- skill-distill 省略 description，仅显式调用，永不自动触发。
- 提炼产物放 skills-candidates/，永不自动加载，待用户审核转正。

## 调研暴露的风险（必须实测兜底）

OpenSpec stores 是 **beta**，三点文档未明确：
1. `store setup --path` 是否接受相对路径 `knowledge/ + openspec`（稳妥用 `"$PWD/knowledge/ + openspec"` 绝对路径）。
2. store 路线下是否需要 `openspec init`（推断不需要，直接 `store setup`；项目根若残留 `openspec/` 会因"就近 root"抢占）。
3. config.yaml `store:` 指针在项目根无 `openspec/` 时是否生效（脚本里每条命令显式 `--store` 不依赖 fallback）。

额外副作用：store 注册表写在**机器级**（`~/.local/share/openspec` 或 `%LOCALAPPDATA%\openspec`），同 store id 跨项目冲突 → **store id 必须带项目区分**（如项目目录名）。

→ 实施时先在临时项目实测这三点，确认确切命令，再固化进脚本。

## 产物设计

### 1. OpenSpec setup（恢复 + 增强 constants/skills.ts）

取消注释 `openspecSetup`，加进 moluoxixi vendor 的 setup（与 codegraphSetup 并列）：
```
{ command: 'npm', args: ['install','--global','@fission-ai/openspec'], skipIfCommandAvailable: 'openspec' }
```
（仅全局装 CLI；store setup 是 per-project，放 init-project 脚本，不放 sync setup。）

### 2. init-project 集成

- 新增 `skills/init-project/scripts/init-openspec.mjs`：
  - 检测 `openspec` 命令是否存在（缺失报 MISSING，不阻断其余步骤）。
  - 用项目目录名派生 store id，跑 `openspec store setup <id> --path "$PWD/knowledge/ + openspec"`（实测后定确切语法）。
  - 幂等：已注册则跳过（捕获 "already registered" 不报错）。
- SKILL.md 流程图加一环：codegraph init 后 → init-openspec（建 `openspec/` store）。
- 交付检查表加一行：OpenSpec store → `openspec/changes/` 可用，命令缺失报 MISSING。

### 3. session-capture skill（自建，省略 description——仅显式调用）

- `skills/session-capture/SKILL.md`（无 description）：
  - 触发条件：用户显式说"沉淀会话/记录这次关键信息/存一下这次的约定"时按名调用。
  - 不适合场景：主代理普通对话不主动加载（故省略 description）；跨会话接力交接走 handoff；任务已交付无需沉淀。
  - 输出：`knowledge/sessions/<date>-<topic>.md`，结构化记录本次会话的关键决策/踩坑/约定/可复用模式。
  - 边界：**脱敏**（不写密钥/PII/token，按 key 名引用）；不写 vendor/node_modules/.git；与 handoff 区分（沉淀=永久积累，handoff=临时接力）。

### 4. skill-distill skill（自建，省略 description——仅显式调用）

- `skills/skill-distill/SKILL.md`（无 description）：
  - 触发条件：用户显式说"提炼 skill/把这些沉淀成 skill"时按名调用。
  - 不适合场景：主代理普通对话不主动加载（故省略 description）。
  - 流程：扫 `knowledge/sessions/` + `openspec/changes/`，识别可复用为 skill 的模式，生成 candidate 草稿到 `knowledge/skills-candidates/<name>/SKILL.md`。
  - 边界：**candidate 永不自动加载、永不直接进项目 skills 目录**；必须输出"待审清单"让用户逐个 review；用户批准后才由用户/另一步转正；提炼不得脑补、不得把示例当真实事实。

### 5. knowledge/ + openspec/ 目录骨架

init-project 建空骨架（实际内容由各 skill 运行时补）：
```
knowledge/ + openspec/
├── openspec/          # 由 openspec store setup 建（changes/ specs/）
├── sessions/          # session-capture 写
└── skills-candidates/ # skill-distill 写，待审
```
rules/ 这层暂不动（最小化 init-project 当前不建 旧 rules 路由）。

## 校验（遵循"只校验分发逻辑，不校验内容"）

- 不新增内容门禁脚本。
- init-openspec.mjs、session-capture/skill-distill 脚本若有纯函数逻辑，测试就近放 `skills/init-project/__test__/`、`skills/<skill>/__test__/`（遵循已立的就近测试规范）。
- 仅测脚本功能行为（store id 派生、幂等、目录创建、脱敏过滤），不测 skill 正文内容。

## 验证

- 临时项目实测 OpenSpec stores 三点风险 → 固化命令。
- `node skills/init-project/scripts/init-openspec.mjs <tmp>` 手测 store 建在 `openspec/`。
- session-capture / skill-distill 各跑一次，确认写对目录、脱敏生效、candidate 不进 skills/。
- `verify-skill-frontmatter` 已删——改用 `npx vitest` 跑就近测试 + typecheck + lint。
- init-project 纯净测试（如仍保留 purity 流程则跑；当前 purity 已删，改为手测）。

## 待确认 / 风险

- OpenSpec stores beta 三点需实测（见上）；若 `--path` 不吃相对路径或 init 顺序有坑，回退到"openspec/ 放项目根，与 knowledge/ + openspec/ 并存"（选项B）并知会用户。
- 两个自建 skill（session-capture / skill-distill）均省略 description，仅显式调用，不自动触发、不污染主上下文。
