# Java 后端测试规范

## 单元测试

优先使用项目既有框架，例如 JUnit 和 Mockito。单元测试可覆盖 service rules、mappers、validators 和 failure branches。

不要 mock 被测类本身。

## Spring 风格集成测试

当行为依赖框架装配、持久化、事务、安全过滤器或序列化时，使用项目既有集成测试方式。

常见类别：
- controller/API tests；
- 带真实事务行为的 service tests；
- repository tests；
- 项目使用时的 Testcontainers 或 embedded database tests。

## 安全与校验

当变更影响受保护 API 或请求契约时，可覆盖 authentication、authorization、validation annotations、exception handlers 和 forbidden paths。

## 构建验证

Java 项目的 compile 和 test 任务通常属于质量门。仅在项目实际使用 Maven 或 Gradle 时，才使用对应项目命令。
