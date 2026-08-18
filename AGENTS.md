本项目的skills，agents，hooks，rules均采用远程同步方式
本项目对应远程的moluoxixi host，以role path全量同步

## Moluoxixi 上游维护边界

Trellis 同步必须遵守 `roles/moluoxixi/skills/init-project/references/upstream-maintenance.md`：

* `roles/moluoxixi/.sync/trellis` 是指定 upstream commit 的只读、干净源码镜像，禁止在其中修改或提交。
* `roles/moluoxixi/.sync/rebuild` 是从该 commit 创建的唯一适配 worktree；所有本地改造、包名调整、模板改造和同步测试都在这里完成并用本地 commit 记录。
* `.sync` 不使用额外的 `work/` 容器；`trellis`、`rebuild`、`history` 和 `reports` 直接作为同级边界，避免路径歧义。
* `roles/moluoxixi/packages/core` 与 `roles/moluoxixi/packages/cli` 只能作为 rebuild 验证通过后的导出目标，禁止在同步决策过程中直接编辑。
* `.sync/reports` 与 `.sync/history` 保存精确的扫描、导出和验证记录；报告不得放进 rebuild，避免被误当成包源。
* 不再创建或依赖 `roles/moluoxixi/overlays`，也不得把 `.sync`、历史记录或报告复制进安装项目和 npm 包。

在 Trellis 同步、升级或适配语境中，“上游”默认指 `mindfold-ai/Trellis`；AIRules 仓库远端明确称为 `origin`。

角色专属测试必须放在对应的 `roles/<role>/__test__/` 中；`scripts/lib/__test__/` 只允许存放不依赖具体角色资产的公共能力测试。
`common` 分支只承载公共分发、投影、校验与运行时能力，`common` 分支的`roles/` 必须为空。

## Trellis 同步的许可证策略

项目维护者声明其为 Trellis 作者。同步、升级或适配 Trellis 时，默认只评估技术行为、功能差异、兼容性和测试，不处理许可证合规问题。

除非用户明确要求：

* 不审计、比较、补齐或校验 `LICENSE`、`NOTICE`、`COPYRIGHT` 等法律文件；
* 不为法律文件建立哈希、来源、账本或其它证明材料，也不因这些材料缺失而阻塞同步；
* 不新增、删除或修改法律文件，已有文件保持原状即可。
