---
name: finishing-a-development-branch
---

# 收尾开发分支

实现完成且测试通过后，给出 merge/PR/保留/丢弃选项并执行收尾清理。本 skill 由编排或用户按名调用，不在普通对话自动触发。

核心原则：验证测试 → 检测环境 → 给出选项 → 执行所选 → 清理。

## 触发条件

- 实现完成、全部测试通过，需要决定如何整合这份工作。
- 通常承接 `executing-plans` / `subagent-driven-development` 的末尾。

## 不适合场景

- 测试尚未通过：先修，不进入收尾。
- 还在实现中、未到整合决策点。

## 流程

### 第 1 步：验证测试

给选项前先跑项目测试套件（`npm test` / `cargo test` / `pytest` / `go test ./...`）。
测试失败：报告失败明细，明确"测试通过前不能 merge/PR"，停在这步，不进入第 2 步。
测试通过：继续。状态只用 `PASS` / `FAIL` / `MISSING` / `NOT RUN` / `N/A`。

### 第 2 步：检测环境

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

| 状态 | 菜单 | 清理 |
|------|------|------|
| `GIT_DIR == GIT_COMMON`（普通仓库） | 标准 4 选项 | 无 worktree 可清 |
| `GIT_DIR != GIT_COMMON`，具名分支 | 标准 4 选项 | 按归属清理（第 6 步） |
| `GIT_DIR != GIT_COMMON`，detached HEAD | 精简 3 选项（无本地 merge） | 不清理（宿主托管） |

### 第 3 步：确定基线分支

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

不确定就问："这个分支是从 main 切出的吗？"

### 第 4 步：给出选项

普通仓库与具名分支 worktree——给出恰好这 4 项：

```
实现完成，你想怎么处理？
1. 本地合并回 <base-branch>
2. 推送并创建 Pull Request
3. 保持分支不动（我之后自己处理）
4. 丢弃这份工作
```

detached HEAD——给出恰好这 3 项（无本地 merge）：推送为新分支建 PR / 保持不动 / 丢弃。
选项保持简洁，不加额外解释。

### 第 5 步：执行所选

选项 1 本地合并：先 `cd` 到主仓库根（避免在被删 worktree 内执行）；`git checkout <base>` → `git pull` → `git merge <feature>`；在合并结果上跑测试；确认成功后再清理 worktree（第 6 步），最后 `git branch -d <feature>`。

选项 2 推送建 PR：`git push -u origin <feature>`，用宿主对应的工具创建 PR（GitHub `gh` / GitLab `glab` 等，按实际托管平台，不写死单一平台）。不清理 worktree——用户要靠它迭代 PR 反馈。默认推到新分支，不直接推 main/master；不强制推送（force-push 需用户明确要求）。

选项 3 保持不动：报告"保留分支 <name>，worktree 在 <path>"。不清理。

选项 4 丢弃（破坏性，先确认）：列出将永久删除的分支、提交、worktree，要求用户键入 `discard` 确认；确认后 `cd` 主仓库根 → 清理 worktree（第 6 步）→ `git branch -D <feature>`。未得到确切确认不执行。

### 第 6 步：清理工作区

仅选项 1、4 触发；选项 2、3 始终保留 worktree。

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE_PATH=$(git rev-parse --show-toplevel)
```

- `GIT_DIR == GIT_COMMON`：普通仓库，无需清理。
- worktree 路径在 `.worktrees/` 或 `worktrees/` 下：这是本流程建的，归我们清理——`cd` 主仓库根后 `git worktree remove "$WORKTREE_PATH"` 再 `git worktree prune`。
- 其它：宿主托管的工作区，不要删；有宿主退出工具就用，否则原样保留。

## 输出边界

- 本 skill 只负责"测试验证 + 整合决策 + 清理"，不负责实现。
- 测试未通过不得进入选项；破坏性操作（丢弃、force-push、删分支）必须先得到用户明确确认。
- 不写死特定 git 托管平台流程；PR 用宿主对应 CLI。
- 收尾交付收口五项：变更分级、改动内容、验证、未执行项及原因、风险/MISSING/待确认项（没有则显式写"无"）。

## 配套 skill

- `using-git-worktrees`：本流程清理的 worktree 通常由它创建。
- `executing-plans` / `subagent-driven-development`：本 skill 承接它们的末尾收尾。
