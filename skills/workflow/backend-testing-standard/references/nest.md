# NestJS 测试规范

## 单元测试

项目已有 Nest 测试方式时优先沿用。Service 测试只在被测边界 mock repository 和外部 adapter。

不要 mock 被测 service 方法本身。

## Controller/API 测试

Controller 测试可验证路由层行为、validation pipes、相关 guards、status codes 和 response shapes。

依赖完整 Nest application context 的行为，优先使用项目既有集成或 E2E 风格测试。

## Providers

覆盖 providers 时，fake 应保留测试所需的失败行为。永远成功的 mock 无法验证错误路径。

## 校验与异常

当变更影响请求契约或错误响应时，可覆盖 DTO validation failures 和 exception filters。
