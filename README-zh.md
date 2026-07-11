# Moluoxixi AIRules

AIRules 通过 `airules` CLI 分发 AI skills 与宿主配置。

角色清单随发行包提供；第一方 skills、agents、hooks、rules 在运行时从远程仓库按完整 role path 同步，不从安装包中的本地角色目录投影。默认角色为空；选择角色时必须显式传入 `--role <name>`。

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
airules add ./my-skill --host all
airules verify --host all
```

提供两个并列、无默认选择的安装角色：

```bash
```


- `sync` 更新所选远程资产并投影到支持的宿主。
- `add` 将包含 `SKILL.md` 的目录复制到 `~/.moluoxixi/local/skills/` 后执行同步；本地 skill 可以追加能力，但不能同名覆盖完整远程 role 或固定 revision vendor 的受保护 skill。
- `verify` 检查受管宿主投影。
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
