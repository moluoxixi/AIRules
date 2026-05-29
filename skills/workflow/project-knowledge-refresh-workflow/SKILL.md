---
name: project-knowledge-refresh-workflow
---

# 项目知识刷新工作流

## 用途

本 Skill 处理任务完成后的项目知识沉淀。它不记录任务状态，不定义宿主触发机制；调用方必须在收到明确指令后方可执行，并自行判断是创建知识库基线还是按 commit 增量刷新。

若本 Skill 没有被用户显式触发，不得擅自后台执行，并在任何任务交付报告中把知识刷新状态标为 `NOT RUN`。

若项目尚未存在 `docs/AI项目知识/`、`总索引.md` 或 `.state/knowledge-state.json`，不得报告 `MISSING` 后停止；必须进入 `bootstrap mode`，从仓库可证明事实创建基线知识库。无法证明的需求、接口语义、组件规范和运维经验只能写入 `待确认/`。

## 推荐目录结构

本 Skill 维护以下两级索引结构：

```text
docs/AI项目知识/
  .state/
    knowledge-state.json
  项目概览.md
  总索引.md
  需求与设计/
    索引.md
    需求/
    业务规则/
    架构与边界/
    数据模型/
    决策记录/
  接口与依赖/
    索引.md
    API/
    外部系统/
    数据契约/
  组件与交互/
    索引.md
    组件库/
    页面交互/
    设计约束/
  架构映射/
    索引.md
    业务模块映射.md
    技术栈.md
    命令清单.md
    测试映射.md
    API映射清单.md
    组件使用映射.md
  部署与运维/
    索引.md
    环境与部署.md
    配置与密钥.md
    已知问题排查.md
  待确认/
    YYYY-MM-DD-commit-知识变更候选.md
    初始化知识缺口.md
```

`knowledge-state.json` 记录已沉淀到知识库的 commit 边界：

```json
{
  "last_refresh_commit": "abc123",
  "last_refresh_at": "2026-05-29T00:00:00+08:00",
  "generator_version": "project-knowledge-v2-neutral"
}
```

## 触发规则

以下场景必须执行知识刷新检查，且需要用户显式下达指令：

- 开发任务完成且必要验证已结束，且用户下达刷新指令。
- 用户明确要求“调用刷新技能”“生成项目知识”“更新知识库”“刷新项目知识”“同步文档”。

知识刷新检查必须真实执行或显式报告 `NOT RUN` / `MISSING`，不得伪造成已完成。

## 模式选择

1. **bootstrap mode**：`docs/AI项目知识/`、`总索引.md` 或 `.state/knowledge-state.json` 缺失时执行。该模式创建目录、索引、映射和缺口候选。
2. **incremental mode**：知识库结构完整时执行。该模式只处理 `.state/knowledge-state.json` 中 `last_refresh_commit..HEAD` 的 committed changes。

未提交工作树属于 WIP。incremental mode 遇到 dirty working tree 时必须输出 `NOT RUN`，原因写明 `dirty working tree present`，并停止任何覆盖写入。bootstrap mode 可创建基线目录，但必须把 dirty working tree 风险写入报告；若无法区分已提交事实与 WIP，状态为 `NOT RUN`。

## bootstrap mode

推荐流程：

1. 读取 Git `HEAD`，作为初始 `last_refresh_commit`。
2. 从 README、manifest、lockfile、构建配置、路由配置、业务入口目录、测试配置、接口客户端、OpenAPI/Swagger、CI、Docker 和部署配置提取仓库事实。
3. 创建目录、`项目概览.md`、`总索引.md`、领域 `索引.md` 和 `架构映射/` 文件。
4. 将无法从仓库事实证明的需求、接口字段语义、组件库规范、业务决策、SLA、发布策略和故障 SOP 写入 `待确认/初始化知识缺口.md`。
5. 写入 `.state/knowledge-state.json`。
6. 输出 PASS/FAIL/MISSING/NOT RUN 状态。

可自动写入正式知识库的内容必须带来源路径或 commit 证据。无法证明的内容不得进入正式索引。

## incremental mode

推荐流程：

1. 读取 `docs/AI项目知识/.state/knowledge-state.json`。
2. 取得 `last_refresh_commit..HEAD` 的 commit、变更文件和相关 diff。
3. 若存在 dirty working tree，状态输出 `NOT RUN`，原因写明 `dirty working tree present`，立即停止覆盖写入。
4. 根据 committed changes 更新 `总索引.md`、领域 `索引.md` 和 `架构映射/` 清单。
5. 对需求、设计、接口语义、组件规范和运维知识生成 `待确认/` 候选，除非用户明确允许直接改写对应原子文件。
6. 刷新成功后更新 `knowledge-state.json`。
7. 输出 PASS/FAIL/MISSING/NOT RUN/N/A 状态。

## 自动改写与候选阻断边界

允许 Agent 在接到显式刷新指令后写入更新的目录与文件：

- `总索引.md`
- 各领域下的 `索引.md`
- `架构映射/业务模块映射.md`
- `架构映射/技术栈.md`
- `架构映射/命令清单.md`
- `架构映射/测试映射.md`
- `架构映射/API映射清单.md`
- `架构映射/组件使用映射.md`

拦截并转入候选池 `待确认/` 的目录：

- `需求与设计/` 内部文件
- `接口与依赖/` 内部文件
- `组件与交互/` 内部文件
- `部署与运维/` 内部文件

长篇、具有业务解释性的抽象知识必须生成候选文件。候选文件必须包含来源 commit、路径、变更摘要、建议落点和置信度。`待确认/` 中的候选文件不得被 `总索引.md` 或领域 `索引.md` 路由；只有确认沉淀后的原子知识文件才能进入正式索引。新增、拆分或删除原子知识文件时，必须同步更新对应的领域 `索引.md`。

## 自动事实与用户知识边界

可自动生成并直接维护：

- 技术栈、包管理器、命令、测试入口、构建配置、CI、部署配置和环境变量样例。
- 业务入口根目录、路由、页面目录、用户可达入口和相关测试映射。
- API 调用位置、接口客户端路径、OpenAPI/Swagger 指针和数据契约文件位置。
- 组件库依赖、组件导入位置、页面组件使用关系。

必须进入 `待确认/`：

- 产品需求、用户故事、验收标准和业务规则解释。
- 接口字段语义、错误码含义、兼容性承诺、外部系统 SLA。
- 组件库设计规范、交互准则、禁用或推荐用法。
- 架构决策原因、历史取舍、发布策略、回滚策略、告警阈值和故障处理 SOP。

## 映射文件与原子知识边界

- **API 映射清单 vs 接口原子文件**：`架构映射/API映射清单.md` 仅作为查阅入口，只允许记录路由路径和目标文件指针。具体的接口字段、请求/响应数据结构、外部依赖详情，必须存入 `接口与依赖/` 目录下具体的原子文件中，严禁污染映射清单。
- **组件使用映射 vs 组件规范文件**：`架构映射/组件使用映射.md` 只记录组件导入、页面使用位置和测试指针。组件设计规范、交互约束和禁用用法必须进入 `组件与交互/` 原子文件或 `待确认/`。
- **业务模块约束**：刷新 `架构映射/业务模块映射.md` 时，模块的主体路径必须受控于 `项目概览.md` 中声明的业务入口根目录。

## 交付报告状态

知识刷新报告必须且仅使用以下状态结尾：

- `PASS`：bootstrap 或 incremental 已执行，映射与索引已更新，抽象知识变更已存入 `待确认/`，状态文件已更新。
- `FAIL`：刷新执行失败，暴露底层错误栈。
- `MISSING`：缺少 Git 信息、必要读取入口或项目规则禁止写入 `docs/AI项目知识/`。
- `NOT RUN`：遇到 dirty working tree、未显式手动触发，或用户主动拦截。
- `N/A`：本次任务的 commit 评估未产生实质性的系统架构或项目知识变动。
