本项目的skills，agents，hooks，rules均采用远程同步方式
本项目对应远程的moluoxixi host，以role path全量同步

在 Trellis 同步、升级或适配语境中，“上游”默认指 `mindfold-ai/Trellis`；AIRules 仓库远端明确称为 `origin`。

角色专属测试必须放在对应的 `roles/<role>/__test__/` 中；`scripts/lib/__test__/` 只允许存放不依赖具体角色资产的公共能力测试。
`common` 分支只承载公共分发、投影、校验与运行时能力，`common` 分支的`roles/` 必须为空。

## Trellis 同步的许可证策略

项目维护者声明其为 Trellis 作者。同步、升级或适配 Trellis 时，默认只评估技术行为、功能差异、兼容性和测试，不处理许可证合规问题。

除非用户明确要求：

* 不审计、比较、补齐或校验 `LICENSE`、`NOTICE`、`COPYRIGHT` 等法律文件；
* 不为法律文件建立哈希、来源、账本或其它证明材料，也不因这些材料缺失而阻塞同步；
* 不新增、删除或修改法律文件，已有文件保持原状即可。
