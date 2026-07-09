# speckit-development role

可选开发角色。该角色把 GitHub Spec Kit 作为规格驱动开发主线，通过 `lihan3238/speckit-superpowers-bridge` 把 Spec Kit `tasks.md` 交给官方 Superpowers 执行纪律，适用于个人、轻量项目或明确选择 Spec Kit 的团队。

## 上游来源

- GitHub Spec Kit：`https://github.com/github/spec-kit`，官方仓库，2026-07-07 复核约 118k stars，最新 release `v0.12.5`。
- Superpowers：`https://github.com/obra/superpowers`，官方仓库，2026-07-07 复核约 247k stars，最新 release `v6.1.1`。
- speckit-superpowers-bridge：`https://github.com/lihan3238/speckit-superpowers-bridge`，Spec Kit community catalog 已收录，当前 HEAD `ac67d847d6bba047ed5490340f8c51f71a8c6537`，提供 release ZIP 安装和 Codex / Claude Code 双宿主 skill surface。

## 采用边界

- Spec Kit 官方产物是 `specify` CLI、项目模板与 `/speckit.*` 命令；AIRules 通过 setup 安装 CLI，不伪造成 OpenSpec schema。纯前端项目的额外纪律通过项目内 `.specify/airules-schemas/frontend-superpowers-bridge/` 承载。
- `speckit-superpowers-bridge` 是该角色的桥接层：Spec Kit 继续拥有 constitution / spec / plan / tasks，bridge 只负责 handoff、guard 与执行入口。
- Superpowers 官方仓库仍按 namespace 投影，因为 bridge 的执行阶段依赖原生 Superpowers skills，不重新实现 TDD、debug、verification、review 或 branch finishing。
- AIRules 第一方提供完整 `init-project` skill，用于在目标项目中注入项目规则、建立 `CLAUDE.md` 链接、调用 Spec Kit 原生命令、安装 bridge、改写官方 clone / extension 里的插件安装文案、初始化 CodeGraph 并执行 readiness 检查；它不复制 OpenSpec schema 资产。

## 初始化方式

目标项目优先通过该角色的 `init-project` skill 完整安装；底层命令等价于：

```bash
specify init . --integration codex
specify extension add speckit-superpowers-bridge --from https://github.com/lihan3238/speckit-superpowers-bridge/releases/latest/download/speckit-superpowers-bridge.zip
codegraph init -i
```

`init-project` 会先处理 `AGENTS.md`/`CLAUDE.md` 项目规则；`airules-base.md` 默认注入，前端字段与组件纪律不再通过独立前端规则文件注入根规则。`spec-init.mjs` 检测到前端项目时，会安装 `.specify/airules-schemas/frontend-superpowers-bridge/` 并写 `.specify/airules-schema.yaml`，让 Spec Kit 项目在前端场景使用同名 schema 提示资产。其他宿主按 Spec Kit 官方 integration 选择，例如 `claude`、`copilot`、`gemini`；需要覆盖默认 Codex integration 时设置 `AIRULES_SPECKIT_INTEGRATION=<integration>`。该角色不安装 OpenSpec schema，项目规格目录、命令入口和 bridge extension 都交给 Spec Kit 原生初始化与 extension 机制生成。

## 工作流

- `/speckit.constitution`：建立项目原则与约束。
- `/speckit.specify`：写需求和用户故事，只描述 what / why。
- `/speckit.clarify`：补齐不明确需求。
- `/speckit.plan`：形成技术方案。
- `/speckit.tasks`：拆成实现任务。
- `/speckit.analyze`：实现前做跨产物一致性检查。
- `$speckit-superpowers-bridge` / `/speckit-superpowers-bridge`：在 `tasks.md` 生成后执行 bridge handoff，用原生 Superpowers skills 推进实现、验证、review 与分支收尾。

显式采用 Spec Kit 的项目不推荐直接跑 `/speckit.implement` 作为公司项目实现入口；实现阶段优先走 bridge，使 Spec Kit 保持规格主线和项目内落档事实源，Superpowers 负责工程执行纪律。
