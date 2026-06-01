---
name: project-knowledge-refresh-workflow
---

# 项目知识刷新工作流

## 用途

本 Skill 处理任务完成后的项目知识沉淀。它不记录任务状态，不定义宿主触发机制；调用方必须在收到明确指令后方可执行，并自行判断是创建知识库基线还是按 commit 增量刷新。

若本 Skill 没有被用户显式触发，不得擅自后台执行，并在任何任务交付报告中把知识刷新状态标为 `NOT RUN`。

若项目尚未存在 `docs/AI项目知识/`、`总索引.md` 或 `.state/knowledge-state.json`，不得报告 `MISSING` 后停止；必须进入 `bootstrap mode`，从仓库可证明事实创建 AI 自有的路由层和状态文件。`需求文档/`、`接口文档/`、`组件库/`、`测试规范/` 和 `项目规范/` 是只读导入目录，可由 Git 子模块提供；本 Skill 不得创建、改写、补全这些目录或其中的 `索引.md`。

## 推荐目录结构

本 Skill 维护以下两级索引结构：

```text
docs/AI项目知识/
  .state/
    knowledge-state.json
  项目概览.md
  总索引.md
  需求文档/
    索引.md
  接口文档/
    索引.md
  组件库/
    索引.md
  测试规范/
    索引.md
  项目规范/
    索引.md
  部署与运维/
    索引.md
  待确认/
    YYYY-MM-DD-commit-知识变更候选.md
    初始化知识缺口.md
```

`knowledge-state.json` 记录已沉淀到知识库的 commit 边界：

```json
{
  "last_refresh_commit": "abc123",
  "last_refresh_at": "2026-05-29T00:00:00+08:00",
  "generator_version": "project-knowledge-v4-doc-index"
}
```

## 触发规则

以下场景必须执行知识刷新检查，且需要用户显式下达指令：

- 开发任务完成且必要验证已结束，且用户下达刷新指令。
- 用户明确要求“调用刷新技能”“生成项目知识”“更新知识库”“刷新项目知识”“同步文档”。

知识刷新检查必须真实执行或显式报告 `NOT RUN` / `MISSING`，不得伪造成已完成。

## 模式选择

1. **bootstrap mode**：`docs/AI项目知识/`、`总索引.md` 或 `.state/knowledge-state.json` 缺失时执行。该模式只创建 AI 自有的路由层、状态文件、部署运维入口和缺口报告；只读导入目录缺失时报告 `MISSING`，不得代建。
2. **incremental mode**：知识库结构完整时执行。该模式只处理 `.state/knowledge-state.json` 中 `last_refresh_commit..HEAD` 的 committed changes。

未提交工作树属于 WIP。incremental mode 遇到 dirty working tree 时必须输出 `NOT RUN`，原因写明 `dirty working tree present`，并停止任何覆盖写入。bootstrap mode 只可创建 AI 自有基线目录和文件，但必须把 dirty working tree 风险写入报告；若无法区分已提交事实与 WIP，状态为 `NOT RUN`。

## bootstrap mode

推荐流程：

1. 读取 Git `HEAD`，作为初始 `last_refresh_commit`。
2. 从 README、manifest、lockfile、构建配置、路由配置、业务入口目录、测试配置、接口客户端、OpenAPI/Swagger 指针、组件导入、CI、Docker 和部署配置提取仓库事实。
3. 创建或更新 `项目概览.md`、`总索引.md`、`部署与运维/索引.md`、`待确认/` 和 `.state/knowledge-state.json`。
4. 检查 `需求文档/索引.md`、`接口文档/索引.md`、`组件库/索引.md`、`测试规范/索引.md` 和 `项目规范/索引.md` 是否存在；缺失项只进入报告的 `MISSING` 列表。
5. 将无法从仓库事实证明的部署运维经验、SLA、发布策略和故障 SOP 写入 `待确认/初始化知识缺口.md`。
6. 输出 PASS/FAIL/MISSING/NOT RUN 状态。

可自动写入 AI 自有文件的内容必须带来源路径或 commit 证据。无法证明的内容不得进入正式索引。

## incremental mode

推荐流程：

1. 读取 `docs/AI项目知识/.state/knowledge-state.json`。
2. 取得 `last_refresh_commit..HEAD` 的 commit、变更文件和相关 diff。
3. 若存在 dirty working tree，状态输出 `NOT RUN`，原因写明 `dirty working tree present`，立即停止覆盖写入。
4. 根据 committed changes 更新 `项目概览.md`、`总索引.md`、`部署与运维/索引.md` 和 `.state/knowledge-state.json`。
5. 对部署运维知识生成 `待确认/` 候选，除非用户明确允许直接改写对应原子文件；只读导入目录需要变更时只在报告中列出，不生成本地候选文件。
6. 刷新成功后更新 `knowledge-state.json`。
7. 输出 PASS/FAIL/MISSING/NOT RUN/N/A 状态。

## 自动改写与候选阻断边界

允许 Agent 在接到显式刷新指令后写入更新的目录与文件：

- `.state/knowledge-state.json`
- `项目概览.md`
- `总索引.md`
- `部署与运维/索引.md` 中由 CI、Docker、部署配置、环境变量样例或项目规则直接证明的运维入口
- `待确认/` 中仅指向部署运维或 AI 自有路由层的候选文件

禁止 Agent 创建、修改或补全的只读导入目录与文件：

- `需求文档/`
- `接口文档/`
- `组件库/`
- `测试规范/`
- `项目规范/`

拦截并转入候选池 `待确认/` 的内容：

- 无法由仓库事实直接证明的发布策略、回滚策略、SLA、告警阈值和故障处理 SOP。
- 需要用户确认后才能进入 `部署与运维/` 的长篇解释性知识。

PRD 正文、接口参考正文、组件库手册正文、测试规范和项目规范不得生成本地正文候选。只读导入目录需要变更时，刷新报告只能列出建议项和目标目录，不得写入 `待确认/`。部署运维候选文件必须包含来源 commit、路径、变更摘要、建议落点和置信度。`待确认/` 中的候选文件不得被 `总索引.md` 或领域 `索引.md` 路由；只有确认沉淀后的原子知识文件才能进入正式索引。

## AI 自有事实边界

可直接维护：

- AI 自有路由层：`项目概览.md`、`总索引.md` 和 `.state/knowledge-state.json`。
- 部署运维入口：CI、Docker、部署配置、环境变量样例和运维脚本指针。

必须进入 `待确认/`：

- 发布策略、回滚策略、告警阈值和故障处理 SOP。

不得创建、改写或补全文档正文：

- PRD、用户故事、验收标准和完整业务规则正文。
- 接口字段语义、错误码含义、兼容性承诺和完整接口参考正文。
- 组件库设计规范、交互准则、禁用或推荐用法和完整组件手册正文。
- 测试规范、质量门、项目规范、业务术语、目录边界和架构决策正文。

## 索引与正文边界

- **只读导入索引**：`需求文档/索引.md`、`接口文档/索引.md`、`组件库/索引.md`、`测试规范/索引.md` 和 `项目规范/索引.md` 只能读取和检查存在性。缺失、过期或需要补充时报告 `MISSING` 或变更建议，不得写入。
- **AI 自有索引**：`总索引.md` 只能路由到已存在的领域索引；不得因为某个只读导入目录缺失而创建替代目录或伪造入口。

## 交付报告状态

知识刷新报告必须且仅使用以下状态结尾：

- `PASS`：bootstrap 或 incremental 已执行，AI 自有路由层、部署运维入口和状态文件已更新，只读导入目录已检查。
- `FAIL`：刷新执行失败，暴露底层错误栈。
- `MISSING`：缺少 Git 信息、必要读取入口、必要文档入口或项目规则禁止写入 `docs/AI项目知识/`。
- `NOT RUN`：遇到 dirty working tree、未显式手动触发，或用户主动拦截。
- `N/A`：本次任务的 commit 评估未产生实质性的系统架构或项目知识变动。
