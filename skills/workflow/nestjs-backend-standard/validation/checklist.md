# NestJS 校验清单

本文件只提供检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 检查清单

1. 跨模块协作是否通过 `imports`、`exports` 和构造函数注入完成？是否存在 `new Service()` 或字段注入？
2. 校验方案是否跟随项目既有约定？若无约定，是否使用 class DTO、`class-validator` 和 `ValidationPipe`？
3. Guard、Interceptor、Pipe、Filter 是否各自承担单一横切职责？是否混入了核心业务规则？
4. 配置是否通过 `@nestjs/config` 或等价类型化配置模块承载？是否存在 provider 内零散读取 `process.env`？
5. Service 异常是否保留领域语义？是否由 Exception Filter 或 Controller 层统一映射 HTTP 响应？
6. 模块内部结构是否与复杂度匹配？是否为了"像模板"强行加了空壳层级？
