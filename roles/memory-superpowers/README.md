# memory-superpowers（实验版）

独立角色，只依赖 Basic Memory 和 Superpowers，不继承 general/development 的 Hindsight 等工具。

## 安装

```sh
airules install memory-superpowers --host codex
airules verify memory-superpowers --host codex
uv run "$HOME/.agents/skills/memory-superpowers/scripts/project.py" init --project /absolute/project --host codex
```

若安装器投影采用命名空间，请从安装输出定位 `memory-superpowers/SKILL.md`，以其所在目录替换上述 skill 路径。Claude Code 和 Cursor 分别使用 `--host claude`、`--host cursor`。安装 AIRules role 仅分发初始化技能；**每个目标项目必须执行 init**。依赖 uv、Git、Python 3.12（uv 可管理）及首次联网下载。uv 缓存复用固定版本 Python 依赖；官方技能按固定 commit 检出，不修改源码，不额外安装插件或 hooks。

当前只声明仓库宿主范围中的 Codex、Claude Code、Cursor。Codex 使用项目 `.codex/config.toml` 和 `.agents/skills`；Claude 使用 `.mcp.json`、`.claude/skills`、CLAUDE.md；Cursor 使用 `.cursor/mcp.json` 和 `.cursor/skills`。启动宿主后按宿主要求信任项目并启用 MCP。其它平台尚未验证，不声明支持。现有规则文件只追加一次入口，现有 MCP 使用增量合并；同名异配置报错保留原值。hooks 不变。新建的项目 MCP 文件加入忽略；若已有 MCP 文件受 Git 管理，生成的绝对路径条目应留在本地，不要随其他配置一起提交。初始化失败后修复原因重跑，不宣称原子回滚。

## 配置

复用已有 Moluoxixi YAML 项目配置 `.moluoxixi/config.yaml`。AIRules 公共安装器目前没有通用项目配置 API；独立项目使用同样的 YAML 约定 `.airules/config.yaml`，不引入配置依赖服务。可用 `--config /absolute/existing.yaml` 指向已有配置，**后续 init/bm 使用相同选项**。初始化不改写用户配置：

```yaml
memory_superpowers:
  memory_path: docs/memory
  documents:
    standards: [CONTRIBUTING.md, docs/frontend]
    product: [existing/prd.md]
    api: [https://example.com/openapi.yaml]
    design: [design/checkout.md]
```

未配置类别可省略；路径相对仓库，文档入口可多目录、单文件或 URL。保留原位置，AI 按任务读取原文；适用规范必须读取，不能赌语义搜索命中。Memory 路径必须位于项目内。已注册后改变路径会报错，需先迁移 Basic Memory 项目注册，避免静默指向错误目录。

## 使用

项目规则入口读取本地 policy：按需求确定性、行为影响、兼容性和验证难度分流。只读/文案略过完整流水线；明确局部修改直接实现并验证；Bug 使用 systematic-debugging 和有意义的复现/回归；新功能按缺口使用 brainstorming/计划/执行；高影响变更补全设计/评审/验证。影响扩大时说明并升级。显式指定技能或完整流程优先。项目政策明确覆盖上游默认全流程触发，保留原始官方技能。所有任务保留验收条件，完成声明依赖真实检查结果；强制合并条件继续由已有 CI 实施。

正式文档是规范/需求/接口/设计的权威；sources.jsonl 是本任务实际采用依据的 file + reason 索引；Memory 保存可复用经验和权威引用，不维护第二套正式文档。陌生术语、相似故障、相关模块修改、重要决策时检索并核对代码和原文。写前检索、优先更新、标明依据和适用范围；没有新经验就无需笔记。

```sh
uv run <skill>/scripts/project.py source --project /project existing/task-dir docs/product/order.md '订单状态依据'
uv run <skill>/scripts/project.py bm --project /project tool search '订单' --local
uv run <skill>/scripts/project.py bm --project /project tool write --identifier lessons/order.md --content '# 经验及验证依据' --local
```

source 命令按 file 去重更新。没有任务系统时使用 `.airules/tasks/<任务标识>`；索引随恢复、实施、评审和获授权的子代理传递，读取职责相关原文。轻微修改不强制计划/设计。结束前对照原文验收并处理冲突/变化/不可访问资料。

## 团队与维护

将 docs/memory Markdown 和正式资料、任务索引按项目流程提交；写笔记不自动 commit/push。`.airules/memory-superpowers/` 是忽略的机器状态（配置、数据库、索引、上游检出），每个 clone/worktree 依据真实绝对路径产生独立项目名。团队 clone/pull 后安装 role 并执行 init（再次执行会 index），从共享 Markdown 建立/更新自己的索引。MCP 固定项目，不使用全局默认项目。不可用时直接读 Markdown 并报告检索降级。

卸载 AIRules role 不触碰项目资料。手工移除该 role 的项目 MCP 条目、AGENTS/CLAUDE 标记块、生成的技能链接及忽略的本地状态即可取消项目接入；保留 Memory、正式文档和 sources。不要删除复用的全局技能。

上游核对于 2026-11-02：Basic Memory 运行包 1.0.0；官方 skills commit `01b43f9753f1d8422645e7426e7d55ef3efba179`；Superpowers 7.0.1 commit `2ce8aa15d05bd57213e6f746f953aafb7ded7a8b`。官方支持共享 SKILL.md 接入，本角色采用该方式，避免重复插件注入。来源：[Basic Memory](https://github.com/basicmachines-co/basic-memory)、[Superpowers](https://github.com/obra/superpowers)。升级时更新 project.py 中依赖和 commit，重新跑角色测试与临时项目集成测试，再提高 role_version；不会自动追踪 latest。

验证边界详见 [验证记录](VERIFICATION.md)。规则分流是 AI 指令，不能将文件存在视为模型实际行为保证。
