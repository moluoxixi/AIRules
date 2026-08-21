本项目的skills，agents，hooks，rules均采用远程同步方式
本项目对应远程的moluoxixi host，以role path全量同步

## Moluoxixi 外部基线维护边界

同步固定外部基线时：

* `roles/moluoxixi/.sync` 内的源码镜像是指定 commit 的只读、干净输入，禁止在其中修改或提交。
* `roles/moluoxixi/.sync/rebuild` 是从该 commit 创建的唯一适配 worktree；所有本地改造、包名调整、模板改造和同步测试都在这里完成并用本地 commit 记录。
* `.sync` 不使用额外的 `work/`、`history/` 或 `reports/` 容器；源码镜像、`rebuild`、`scripts` 和清单直接作为同级边界。
* `roles/moluoxixi/packages` 只能作为 rebuild 验证通过后的导出目标；导出时先清空整个目录，再完整复制 `.sync/rebuild/packages`，禁止在同步决策过程中直接编辑。
* 不再创建或依赖 `roles/moluoxixi/overlays`，也不得把 `.sync` 复制进安装项目和 npm 包。

外部基线的来源、固定 commit 和本地维护分支只记录在 ignored `.sync` 中；AIRules 仓库远端明确称为 `origin`。

角色专属测试必须放在对应的 `roles/<role>/__test__/` 中；`scripts/lib/__test__/` 只允许存放不依赖具体角色资产的公共能力测试。
`common` 分支只承载公共分发、投影、校验与运行时能力，`common` 分支的`roles/` 必须为空。

## 外部基线同步的许可证策略

项目维护者声明其为外部基线作者。同步、升级或适配该基线时，默认只评估技术行为、功能差异、兼容性和测试，不处理许可证合规问题。

除非用户明确要求：

* 不审计、比较、补齐或校验 `LICENSE`、`NOTICE`、`COPYRIGHT` 等法律文件；
* 不为法律文件建立哈希、来源、账本或其它证明材料，也不因这些材料缺失而阻塞同步；
* 不新增、删除或修改法律文件，已有文件保持原状即可。
