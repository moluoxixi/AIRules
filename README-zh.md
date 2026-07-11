# Moluoxixi AIRules

AIRules 通过 `airules` CLI 分发 AI skills 与宿主配置。

第一方 skills、agents、hooks、rules 均从远程仓库按完整 role path 同步，本仓库不内置角色资产。默认角色为空；选择角色时必须显式传入 `--role <name>`。

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

- `sync` 更新所选远程资产并投影到支持的宿主。
- `add` 将包含 `SKILL.md` 的目录复制到 `~/.moluoxixi/local/skills/` 后执行同步。
- `verify` 检查受管宿主投影。
- `--skip-vendors` 在 `sync` 时跳过远程 vendor 更新。
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
      "hosts": ["claude", "codex", "cursor"],
      "event_by_host": { "cursor": "stop" }
    }
  ]
}
```

同步会把清单转换成各宿主的 JSON/TOML 结构，收敛删除不再声明的 AIRules 受管条目，保留用户 hook，并在 `verify` 时校验脚本哈希与精确命令结构。

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
