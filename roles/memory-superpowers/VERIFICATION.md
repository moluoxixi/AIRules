# 验证记录（2026-11-02）

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
