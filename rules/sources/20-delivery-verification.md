---
description: 交付前质量检查与状态汇报契约——按风险分级执行，状态用统一枚举，不得伪装通过
globs:
  - "**/*"
---
## 交付验证

```mermaid
flowchart TD
  Done["修改完成 / 准备声明完成"] --> Scope["按任务场景与风险分级选择质量检查"]
  Scope --> Risk{"高风险? 删除 / 生产 / 安全 / 权限 / 跨模块 / 声明已完成 / 已修复 / 已通过"}
  Risk -->|是| Doubt["先自我质疑: 最可能漏掉或验证不到什么"]
  Doubt --> AddChecks["补齐验证项"]
  Risk -->|否| Existing["优先项目现有脚本和配置"]
  AddChecks --> Existing
  Existing --> Missing{"脚本 / 配置 / 依赖 / 测试入口缺失?"}
  Missing -->|是| MarkMissing["标 MISSING 或 NOT RUN + 原因"]
  Missing -->|否| Run["运行命令并读取输出"]
  Run --> Status["记录 PASS / FAIL / MISSING / NOT RUN / N/A"]
  MarkMissing --> Report["五项交付汇报"]
  Status --> Report
```

图例 / 硬约束：

- 方法论能力按适用判据触发；全量回归、coverage 和构建只在任务复杂度、风险匹配或用户要求时运行，改生产代码时默认配套有效测试。
- 覆盖率优先项目阈值；无阈值时 statements、branches、functions、lines 均不低于 80%，新增/修改逻辑尽量 90%+。
- 覆盖率不足只能补有效测试或说明原因；不得降阈值、排除关键文件、删断言或写无意义测试。
- 状态只能用 `PASS`、`FAIL`、`MISSING`、`NOT RUN`、`N/A`；不得伪装通过，不得把失败、缺失、不相关或未运行转写成通过。
- 交付汇报必须收口五项：变更分级（L0/L1/L2 及判定依据）、改动内容（涉及文件与范围）、验证（实际运行的命令与结果状态）、未执行项及原因、风险 / `MISSING` / 待确认项（没有则显式写"无"）。
