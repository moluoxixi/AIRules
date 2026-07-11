本项目的skills，agents，hooks，rules均采用远程同步方式
本项目对应skills中的moluoxixi资产，以role path全量同步

角色专属测试必须放在对应的 `roles/<role>/__test__/` 中；`scripts/lib/__test__/` 只允许存放不依赖具体角色资产的公共能力测试。
`common` 分支只承载公共分发、投影、校验与运行时能力，`roles/` 必须为空；角色资产及其测试只能在对应角色分支维护。
