# Node.js 后端校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/backend-code-standard/scripts/verify-rules.mjs
node skills/workflow/backend-code-standard/scripts/verify-rules.mjs hoist --target src/modules/orders/utils --uses src/modules/orders/create/service.ts src/modules/orders/update/service.ts src/modules/orders/cancel/service.ts
```

## 检查清单

1. 代码是否按业务领域垂直切片组织，而不是全局平铺 Controller、Service、Repository？
2. Controller 或路由层是否只做协议适配、输入校验、调用 Service 和响应格式化？
3. 外部输入是否在路由边界完成运行时校验？
4. NestJS 跨模块依赖是否通过 `imports`、`exports` 和构造函数注入完成？
5. 跨领域 import 是否止步于目标模块 `index.ts`？
6. Repository、Entity、底层数据结构是否未被其他领域穿透引用？
7. 抽离是否满足三次原则，并落在最近公共父级？
8. 异常是否保留真实失败语义，并由 HTTP 层或 Filter 统一映射？
9. 生产边界是否覆盖安全头、CORS、速率限制、请求体大小、超时和日志脱敏？
10. 数据模型变化是否补充迁移脚本？
