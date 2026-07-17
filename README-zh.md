# Moluoxixi AIRules

AIRules 通过 `airules` CLI 分发 AI skills 与完整角色资产。

角色清单随发行包提供；第一方资产在运行时从远程仓库按完整 role path 同步，不从安装包中的本地角色目录投影。公共模式默认不选择角色；通过 `--role <name>` 显式选择需要安装的角色。

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

`moluoxixi` 角色需要显式选择：

```bash
airules sync --host all --role moluoxixi
```

- 同步会以可回滚替换方式安装完整角色到 `~/.moluoxixi/roles/moluoxixi`，并把 AIRules 管理的 canonical skills 与显式所选角色声明的 MCP 配置投影到对应宿主。Moluoxixi 角色全局只暴露一个 `init-project` skill，同时在角色内声明 CodeGraph setup/MCP；未选择角色时不会安装 CodeGraph，也不会修改 MCP 文件。
- 其余角色资产全部由 `init-project` 管理。它会在项目内安装 `start`、`check`、`channel` 等 15 个无前缀 skills、项目 runtime，以及 18 个宿主的原生 agents、commands、hooks、plugins、extensions 与 settings。宿主专属源分别维护在 `assets/hosts/<host>`；只有真正宿主无关的 skills、commands、hooks 才进入 `assets/shared`。Agent 身份和 commands 统一使用 `moluoxixi-*` 命名空间。
- `roles/moluoxixi` 包含 `mindfold-ai/Trellis` `v0.6.7` 提交 `e7c5ead4d0dfd717d11a40b6bc0c80d8af94c49a` 的精选角色资产。仓库自动化、package workspace、测试、demo、发布专用资产、备份与项目本地 `.trellis` 历史均有意省略。初始化器只使用迁移到角色内的资产，不安装或调用 Trellis npm CLI。
- 角色运行时从 AIRules 远程仓库的 `roles/moluoxixi` 完整路径同步；精选 Trellis 角色资产不随 AIRules npm 包重复发布。当前分支合入远端默认分支后，该同步入口才可用。
- `sync` 更新所选远程资产、投影 canonical skills、执行所选角色的 setup，并按宿主 MCP contract 投影所选角色的 MCP 声明。
- `verify` 检查 AIRules 管理的 skill 投影。项目内的 agents、commands、hooks、plugins、extensions 与 settings 归项目初始化器所有，公共层不会修改。
- `contract-diff` 确定性比对固定版本的 OpenAPI 3.x JSON/YAML 快照。退出码 `0` 表示无阻断差异，`2` 会保留有效的阻断差异报告；输入无效或语义不受支持时返回 `1`，并在输出路径安全时写入结构化 error audit。无法完整比对的 OpenAPI 线协议语义必须失败关闭。文件输出采用锚定目录的 create-only 直接写入协议：既有 target 只有在仍是基线记录的同一 inode 且内容完全相同时才可幂等复用；基线中不存在的 target 以排他方式创建，任何并发出现（即使内容相同）都会失败。该协议不承诺 rename 式原子可见性。语义提交前，新文件以 `!` 开头并刻意保持为无效 JSON；进程崩溃可能留下该不完整文件，并发读取者也可能观察到它。只有在无效标记的完整 payload 写入并同步、受保护输入和 target inode 复核、首字节替换为 `{` 并再次同步、且路径仍指向所创建 inode 后才报告成功。消费者必须对 JSON 解析或 schema 校验失败关闭；遗留的无效 partial 文件必须由证据 owner 显式清理后再重试。
- `contract-diff --capabilities` 以机器可读 JSON 暴露 CLI 版本、审计报告版本与退出码契约，使远程同步角色能在分析前拒绝不兼容的可执行文件。
- `--skip-vendors` 仅在缓存 checkout 的 origin、工作树和固定 revision 校验通过后跳过更新；未固定的完整远程 role path 必须刷新，不能跳过。
- `--no-verify` 跳过同步后的宿主校验。

## 维护

```bash
npm run typecheck
npm run build
npm run lint:check
npm test
```

远程 revision 由各角色 manifest 声明并在同步时校验，不再维护第二套仓库级 vendor lock 路径。

## 许可证

AIRules 公共代码采用 MIT 许可证。
