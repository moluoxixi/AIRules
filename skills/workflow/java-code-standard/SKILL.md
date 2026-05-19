---
name: java-code-standard
description: 用于编写、修改或评审 Java 后端代码，适用于 Java 17+、Java 21/25 LTS、Spring Boot、Maven 和 Gradle 项目。
---

# Java 编码规范

## 用途

本 Skill 是 Java 后端代码的编码规范来源，适用于 Java 17+ 基线、Java 21/25 LTS、Spring Boot、Maven 和 Gradle 项目。

生成、重构或修改 Java 后端代码时，必须优先遵循领域模块化、显式契约、构造函数注入、事务边界清晰和持久化结构可迁移原则。

## 适用场景

- 新增或调整 Java / Spring Boot 的 Controller、Service、Repository、DTO、Entity、Mapper、Configuration、Exception、Scheduler 和模块边界。
- 评审 Java package 结构、API 契约、Bean Validation、事务边界、异常映射、依赖注入、配置绑定、数据库迁移和依赖流向。
- 判断工具类、转换器、领域类型、配置对象和基础设施代码应该留在当前领域，还是满足三次原则后逐级上浮。

## 必读规范

Java 目录创建、业务分层和编码约束不可拆开理解，必须完整读取 [java-backend-standard.md](references/java-backend-standard.md)。

## 验证辅助

本 Skill 自带 `scripts/verify-rules.mjs`，用于快速验证 Java 专属的三次原则和最近公共父级抽离位置。该脚本只属于本 Skill，不得用仓库根级共享脚本替代。

## 硬性原则

- 领域模块化：代码必须按业务领域组织 package，不得按 Controller、Service、Repository 做全局扁平分层。
- API 与领域隔离：Request、Response、Entity 和领域模型必须分离；禁止把 JPA Entity 直接作为外部 API 契约。
- 构造函数注入：Spring Bean 必须使用构造函数注入；禁止字段注入和无依据的 `@Autowired` 散落。
- 校验前置：外部输入必须使用 `jakarta.validation` 或等价机制显式校验，禁止把宽松对象传入业务层后再靠空判断兜底。
- 事务边界清晰：事务必须放在应用用例或 Service 编排边界，避免 Controller、Repository 或私有 helper 上随意扩散。
- 错误语义透明：业务失败必须以领域异常或应用异常暴露，由 `ControllerAdvice` 或统一异常处理映射 HTTP 响应。
- 持久化迁移闭环：涉及表结构、索引、约束、枚举值或数据修复时，必须补充 Flyway 或 Liquibase 迁移。
- 配置类型安全：外部配置必须通过 `@ConfigurationProperties` 或等价类型化配置承载，禁止在业务代码中散落读取字符串配置。
- 逐级上浮：满足三次原则后只能提取到最近公共父级；只有跨顶级业务域复用才允许进入全局 shared/common package。
- 注释解释契约：公共 Service、复杂事务、领域异常和外部 DTO 必须写清业务契约、边界条件和失败语义，禁止翻译代码。
