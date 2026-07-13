# Moluoxixi AIRules

AIRules 通过 `airules` CLI 分发 AI skills 与宿主配置。

角色清单随发行包提供；第一方 skills、agents、hooks、rules 在运行时从远程仓库按完整 role path 同步，不从安装包中的本地角色目录投影。默认角色为 `moluoxixi`，也可通过 `--role <name>` 显式选择其他角色。

## 安装

```bash
npm install
npm run build
npm link
```

## CLI

```bash
airules sync --host all
airules sync --host all --role <name>
airules verify --host all
airules --version
airules contract-diff --capabilities
airules contract-diff --expected <openapi.json|yaml> --actual <openapi.json|yaml> --output <audit.json>
```

另提供两个可显式选择的安装角色：

```bash
airules sync --host all --role trellis-development
airules sync --host all --role superpowers-openspec-development
```

- `trellis-development` 分发固定版本的 Trellis 安装 skill；项目初始化必须显式确认许可证、平台、开发者身份和 monorepo 选择。
- `superpowers-openspec-development` 分发固定提交的 Superpowers skills，提供固定版本 OpenSpec 的本地工具缓存与安全账本初始化入口，并组合 6 个有界、语言无关的 OpenSpec 规格 Agent，其中包含位于设计与实现计划之间的确定性接口联调分析。

- `sync` 更新所选远程资产并投影到支持的宿主。
- `verify` 检查受管宿主投影。
- `contract-diff` 确定性比对固定版本的 OpenAPI 3.x JSON/YAML 快照。退出码 `0` 表示无阻断差异，`2` 会保留有效的阻断差异报告；输入无效或语义不受支持时返回 `1`，并在输出路径安全时写入结构化 error audit。无法完整比对的 OpenAPI 线协议语义必须失败关闭。文件输出采用锚定目录的 create-only 直接写入协议：既有 target 只有在仍是基线记录的同一 inode 且内容完全相同时才可幂等复用；基线中不存在的 target 以排他方式创建，任何并发出现（即使内容相同）都会失败。该协议不承诺 rename 式原子可见性。语义提交前，新文件以 `!` 开头并刻意保持为无效 JSON；进程崩溃可能留下该不完整文件，并发读取者也可能观察到它。只有在无效标记的完整 payload 写入并同步、受保护输入和 target inode 复核、首字节替换为 `{` 并再次同步、且路径仍指向所创建 inode 后才报告成功。消费者必须对 JSON 解析或 schema 校验失败关闭；遗留的无效 partial 文件必须由证据 owner 显式清理后再重试。
- `contract-diff --capabilities` 以机器可读 JSON 暴露 CLI 版本、审计报告版本与退出码契约，使远程同步角色能在分析前拒绝不兼容的可执行文件。
- `--skip-vendors` 仅在缓存 checkout 的 origin、工作树和固定 revision 校验通过后跳过更新；未固定的完整远程 role path 必须刷新，不能跳过。
- `--no-verify` 跳过同步后的宿主校验。

## 角色 Hook 清单

角色只通过 `roles/<role>/hooks/hooks.json` 声明需要分发的 hook；目录中存在脚本但没有清单时不会启用。脚本必须是同目录下的普通 `.mjs` 文件，事件名可按宿主覆盖：

```json
{
  "version": 1,
  "hooks": [
    {
      "event": "Stop",
      "script": "workflow-dispatcher.mjs",
      "support_files": ["workflow-hook-lib.mjs"],
      "hosts": ["claude", "codex", "cursor"],
      "event_by_host": { "cursor": "stop" }
    }
  ]
}
```

`support_files` 用于声明主脚本导入的同目录 `.mjs` 辅助模块；同步会复制并校验这些文件，但不会把它们注册成事件命令。同步会把清单转换成各宿主的 JSON/TOML 结构，收敛删除不再声明的 AIRules 受管条目，保留用户 hook，并在 `verify` 时校验脚本哈希与精确命令结构。

## 维护

```bash
npm run typecheck
npm run build
npm run lint:check
npm test
```

保留 `scripts/sync-vendors.ts` 与 `vendor-lock.json` 用于 vendor 锁维护。测试前不再自动执行 vendor 同步。

## 许可证

MIT
