# 后端测试维度

## 命令发现

从以下位置发现命令：
- `package.json`、`pom.xml`、`build.gradle`、`gradle.properties`、workspace 文件等 package/build 文件；
- NestJS、Jest、Vitest、Spring Boot、JUnit、Testcontainers 等框架配置；
- CI 文件；
- 仓库文档；
- 项目指令。

示例仅作示意：`pnpm test`、`npm run test:e2e`、`mvn test`、`mvn verify`、`gradle test`、`gradle check`。

## 静态与编译检查

可运行项目提供的 lint、format、typecheck、compile 或 build 检查。Java 项目通常需要 compile/test 任务；TypeScript 后端通常需要 lint 和类型检查。

## 单元测试

可覆盖：
- 纯业务规则；
- service 决策分支；
- DTO validation helpers；
- 错误转换；
- idempotency keys 和 retry 决策；
- 权限规则函数；
- 数据映射和序列化。

## Service 与 API 测试

可覆盖：
- 成功响应；
- 无效输入；
- 资源缺失；
- forbidden 或 unauthorized 请求；
- 冲突和重复场景；
- 下游失败传播；
- 预期 status code 和 response body。

## Coverage

优先使用项目阈值。若没有项目阈值，可在工具支持时按 80% statements、branches、functions/methods 和 lines 报告。

变更的业务逻辑可尽量达到 90%+ 有意义覆盖。
