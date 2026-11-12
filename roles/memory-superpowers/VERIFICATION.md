# 验证记录（2026-11-02）

## BMAD 需求评审扩展（2026-11-04）

- 固定 BMAD 6.12.4 / `bab9082c3e884e0d72c759bcd1a6d90bcc01be84`。`bmad.py install` 已在 AIRules 本机项目实际运行，官方 PRD 技能、四个共享脚本及隔离配置可用；项目级 `review-requirements` 入口已连接。运行缓存不进入 Git。
- `uv run roles/memory-superpowers/__test__/bmad_integration.py --keep`：通过真实上游下载/安装、中文和空格 PRD 路径、重复安装、索引去重、配置入口、原件与已有 `_bmad`/宿主配置保留、官方配置与日志脚本、跨项目缓存复用、越界/输出冲突/状态目录原件拒绝、修改过的 runtime 和脏缓存拒绝。新增模板绝对路径、rubric 覆盖、`.gitignore` 原件及硬链接保护后再次运行通过。
- `pnpm exec vitest run roles/memory-superpowers/__test__/role.test.ts`：2 项通过。新增测试使用当前角色文件实际 staging 并投影到隔离的 Codex、Claude、Cursor 宿主目录，连续两次通过公共技能及宿主校验，确认脚本、rubric、技能与 UI 元数据均随角色分发。该测试不创建 Git fixture 提交，不等同于远程默认分支的完整 CLI 下载测试。
- 新技能结构校验、改动 TypeScript 文件 ESLint、`pnpm run typecheck`、`pnpm run build`、`git diff --check` 通过。未运行会创建本地 Git fixture 提交的全量测试，遵守本次“不在本地提交或推送”的要求。
- 独立代码审查修正了返回字段与技能指针不一致，以及重复评审可能混入旧 reviewer 文件的问题。只综合本轮重新生成的报告文件，不增加另一套索引。
- 一次合成订单样例的实际 AI 评审演练完成：读取 PRD、OpenAPI、交互规范，由主代理 IAB 实际点击原型的编辑、保存、拒绝和空结果筛选，评审代理据此生成 rubric 与 Markdown/HTML 双报告。识别待审核可编辑冲突、拒绝原因/状态缺失、含税金额契约冲突等 9 项问题；已实现的空态未被误报。报告以 `partial` 表示尚有产品决策，明确未测后端、hover、持久化和并发。主代理复读并打开 HTML 核对，五份输入的前后哈希一致。这是单一样例演练，不是准确率基准或所有宿主的行为保证。

以上自动化验证安装、分发、输入绑定与保护，不证明模型能发现所有需求问题。仅 Validate 的依赖链经过验证，未宣称支持完整 BMAD Create/Update。宿主文件投影测试不等于在三个宿主中分别完成真实聊天验收；此次环境为 macOS，Windows/Linux 未实测。

## 自动化

- `pnpm exec vitest run roles/memory-superpowers/__test__/role.test.ts`：1 项通过，真实 manifest 可由 AIRules 发现，独立继承和平台范围正确。
- `uv run --with mcp roles/memory-superpowers/__test__/integration.py /tmp/airules-memory-test2`：通过。真实 Basic Memory stdio MCP 完成 initialize/list_tools，发现 bm_search/bm_read/bm_write 等 12 工具；重复 init 保留用户规则和 TOML 注释；sources.jsonl 重复写入去重。
- Python 编译检查通过。首次运行发现 CLI 入口、index 参数与默认 main 项目路径冲突，均按官方实际运行结果修正后重跑通过。

## 实际 CLI 集成

- 使用现有 `dist/scripts/cli.js install`，临时 home/user-home，Codex 宿主目录，隔离的 Git role 源 fixture（源码来自本次新增角色，固定 fixture commit）：连续两次安装并通过公共 skills 与宿主校验。使用 `--skip-vendors` 复用该固定源，未测试尚未发布到 origin 的远程角色下载；发布后应补跑真实远程安装。fixture 只是绕过未发布源，不修改生产 manifest 的远程来源。
- `/tmp/airules-memory-test2` 初始化：官方 Basic Memory 1.0.0 创建独立项目 `airules-f37450b7f498f7e9`，只注册 docs/memory；通过 tool write 写入 lessons/regression.md、tool read 读回、tool search idempotency 检索命中（score 1.202）。重复 init 完成 index，未重复入口或 MCP 条目。
- 复制 Markdown 到 `/tmp/airules-memory-clone`：独立初始化为 `airules-5b454bbc0502ffef`，搜索相同词命中共享笔记，配置/数据库各自在副本的忽略目录。
- 第二副本使用已有文档路径和外链配置，初始化不搬迁文档、不改写 YAML。Claude JSON 配置生成；Cursor 再初始化验证保留 `user-server` 和 `custom` 字段并加入独立项目 MCP。

## 人工规则检查与限制

- 已检查 A/B/C/D/E 分流、流程升级、原文读取、恢复/评审复用索引及完成证据要求。规则是 prompt 策略，尚未在 Codex/Claude/Cursor 新宿主会话内分别运行小修改、Bug、高影响任务，不能称其模型行为已实测。
- MCP 用协议客户端验证，尚未在三个宿主 UI 内执行信任授权、重启和真实聊天调用。项目级 MCP/技能支持依赖宿主版本和策略；宿主无项目配置能力时本版本不提供全局替代，以免跨项目误写。
- 支持范围为实验性的 Codex、Claude Code、Cursor；没有宣称所有 AIRules 平台都支持。运行验证为 macOS + uv Python 3.12，Windows/Linux 未实测。
- 现有官方全局技能按同名或上游命名空间复用；不能自动识别所有第三方插件自定义目录，已有插件用户应先取消重复的插件启动注入。本 role 自身不安装插件或 hooks。
- 初次安装需网络及依赖下载，语义能力可能触发官方模型下载；失败时报告错误，Markdown 可直接读取。中途失败可能留有本地状态或已生成链接，可修复后重跑；不是事务回滚安装器。
