---
name: backend-testing-standard
description: 用于测试、验证或评审后端变更，适用于 API、service、repository、DTO 校验、数据库访问、事务、鉴权、集成测试、契约测试、NestJS、Java、覆盖率和服务端交付质量。
---

# 后端测试规范

## 用途

本 Skill 提供后端验证范围的可复用规范，帮助按变更风险选择静态/编译检查、单元测试、API 测试、数据库/事务测试、契约测试和覆盖率。

项目、用户或 CI 规则更严格时，优先遵循更严格的规则。

## 适用场景

- 后端 API、service、repository、DTO、持久化、事务、权限或外部契约发生变化。
- 需要判断单元、集成、契约、数据库或覆盖率检查是否相关。
- 需要报告后端验证缺口和残余风险。

## 读取参考

- 后端测试维度和命令发现：读 [test-dimensions.md](references/test-dimensions.md)。
- API 和契约验证：读 [api-contract.md](references/api-contract.md)。
- 数据库、事务和持久化测试：读 [database-and-transaction.md](references/database-and-transaction.md)。
- NestJS 测试模式：读 [nest.md](references/nest.md)。
- Java/Spring 风格测试模式：读 [java.md](references/java.md)。

## 核心判断

按相关性评估：
- 静态质量；
- 类型或编译正确性；
- 纯规则和 service 的单元测试；
- controller/API 行为；
- 校验和错误映射；
- 鉴权和权限边界；
- 持久化变更对应的 repository/database 行为；
- 写操作变更对应的事务成功与回滚；
- 对外 API 的集成或契约行为；
- 项目有工具且变更包含有意义逻辑时的覆盖率。

如果某维度相关但项目没有工具或入口，可报告 `MISSING`；如果相关但无法运行，可报告 `NOT RUN` 并说明原因；如果与本次任务无关，可报告 `N/A`。

## 反模式

不要为了让报告变绿而 mock 掉被测单元、删除断言、降低阈值、隐藏数据库失败、把异常转换成成功路径，或跳过失败的集成行为。
