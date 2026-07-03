---
name: using-git-worktrees
---

# 使用 Git Worktree

需要把工作隔离出当前工作区时（如执行实现计划前），用 git worktree 建独立工作目录，并验证 baseline 测试通过。本 skill 由编排或用户按名调用，不在普通对话自动触发。

核心原则：先检测是否已隔离；已隔离就别再建；建之前确认目录被忽略；动手前确认 baseline 干净。

## 触发条件

- 开始需要与当前工作区隔离的特性工作。
- 执行实现计划前需要独立工作区。
- **并行写代码场景**：同一会话并行派多个写代码的子代理时，每个实例各占一个 worktree——这是并行写入的默认隔离手段，防止静态判定"互不写同一文件"失准时在合并阶段才暴露冲突（见 `dispatching-parallel-agents`）。纯只读并行不需要。
- 宿主已提供原生 worktree/隔离工作区机制时，优先用宿主机制，不要硬上 `git worktree add` 制造宿主看不见的影子状态。

## 不适合场景

- 已处于隔离工作区（见第 0 步检测）：跳过创建，不要嵌套。
- 处于 git submodule 中：按普通仓库处理。
- 用户明确表示就地工作：尊重其偏好，跳到第 2 步。

## 第 0 步：检测是否已隔离

建任何东西之前，先确认你是否已在隔离工作区：

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

submodule 守卫：`GIT_DIR != GIT_COMMON` 在 submodule 内也成立。下结论前先排除 submodule：

```bash
# 返回路径说明在 submodule 中，按普通仓库处理
git rev-parse --show-superproject-working-tree 2>/dev/null
```

- `GIT_DIR != GIT_COMMON` 且非 submodule：已在 linked worktree，跳到第 2 步，不要再建。报告分支状态（在某分支上 / detached HEAD 需在收尾时建分支）。
- `GIT_DIR == GIT_COMMON` 或在 submodule：普通检出。用户未在指令中表明偏好时，先征求同意再建 worktree；已声明偏好则照办；拒绝则就地工作并跳到第 2 步。

## 第 1 步：创建隔离工作区

按顺序尝试两种机制。

### 1a. 宿主原生机制（优先）

若宿主提供创建隔离工作区/worktree 的原生能力，用它并跳到第 2 步。原生机制自动处理目录、分支与清理；在已有原生能力时硬用 `git worktree add` 会产生宿主管理不了的影子状态。

### 1b. Git worktree 兜底

仅在无原生机制时使用。

目录选择优先级（用户显式偏好永远高于观察到的文件系统状态）：

1. 指令里已声明的 worktree 目录偏好，直接用。
2. 已存在的项目内 worktree 目录：`.worktrees`（优先）或 `worktrees`；都在则 `.worktrees` 胜。
3. 无其它指引：默认项目根的 `.worktrees/`。

安全核查（仅项目内目录）：建之前必须确认目录被忽略：

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

未被忽略：先加进 .gitignore 并提交该改动，再继续。原因：防止把 worktree 内容误提交进仓库。

创建：

```bash
path="$LOCATION/$BRANCH_NAME"
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

沙箱兜底：若 `git worktree add` 因权限/沙箱失败，告知用户沙箱阻止了创建、改为就地工作，然后就地跑 setup 与 baseline 测试。

## 第 2 步：项目 setup

自动探测并运行对应安装：`package.json`→`npm install`；`Cargo.toml`→`cargo build`；`requirements.txt`→`pip install -r`；`pyproject.toml`→`poetry install`；`go.mod`→`go mod download`。无对应清单则跳过。

## 第 3 步：验证 baseline 干净

跑项目对应测试命令（`npm test` / `cargo test` / `pytest` / `go test ./...`）确认工作区起点干净。

- 测试失败：报告失败，询问继续还是先排查（不要带着失败硬闯，否则分不清新 bug 和既有问题）。
- 测试通过：报告就绪。

状态只用 `PASS` / `FAIL` / `MISSING` / `NOT RUN` / `N/A`，不得把未跑或失败写成通过。

## 输出边界

- 本 skill 只负责"准备隔离工作区 + 验证 baseline"，不负责实现与收尾（收尾见 `finishing-a-development-branch`）。
- 已检测到隔离、或宿主提供原生机制时，不得再 `git worktree add`。
- 项目内 worktree 目录必须先确认被忽略再创建；破坏性或会污染 git 状态的操作先确认。
