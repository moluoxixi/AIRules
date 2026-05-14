---
name: backend-code-standard
description: 用于编写、修改或评审后端代码，适用于 API、controller、route、DTO、service、repository、entity、数据库访问、事务、异常、日志、配置、NestJS、Java 和服务端模块边界。
---

# 后端代码规范

## 用途

本 Skill 提供后端代码的可复用规范，覆盖 API 边界、分层、命名、错误语义、事务、持久化、日志和配置。

优先遵循项目已有约定；项目没有明确约定时，可将本 Skill 作为默认后端参考。

## 适用场景

- 新增或调整后端 API、service、repository、DTO、entity、事务、日志、配置或异常处理。
- 评审 controller/service/repository 等层级是否混杂职责。
- 需要判断失败语义是否被默认值、空对象、缓存或吞异常掩盖。

## 读取参考

- 通用后端架构、命名、分层、DTO/entity 边界、异常、日志和配置：读 [common.md](references/common.md)。
- NestJS module、controller、provider、DTO、pipe、guard、interceptor 和 exception 模式：读 [nest.md](references/nest.md)。
- Java/Spring 风格 package、controller、service、repository、DTO、entity、事务和异常模式：读 [java.md](references/java.md)。

## 核心判断

- API、领域、持久化和基础设施边界应保持清晰。
- controller 负责传输层输入输出，不承载业务规则。
- repository 表达持久化访问和约束，不承载业务决策。
- DTO、entity、持久化模型和响应视图在约束不同时应保持分离。
- 保留失败语义，不把真实后端错误转换成空对象、默认成功、缓存结果或吞异常。
- 事务只包裹必须一起提交或回滚的操作，范围保持小而可见。
- 日志应提供诊断上下文，但不记录密钥、token、密码、私钥或完整认证头。

## 关联 Skill

- 后端测试和交付验证：`backend-testing-standard`。
- 通用任务流程和质量门选择：`software-development-workflow`。
- Bug、失败测试或非预期服务端行为：`systematic-debugging`。
