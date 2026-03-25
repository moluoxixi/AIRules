# Frontend JSDoc Rules

适用于前端 JavaScript / TypeScript 代码。默认参考 JSDoc 官方文档与 TypeScript Handbook 的 JSDoc 支持能力，并兼容 `eslint-plugin-jsdoc` 的主流约束思路。

## 基本要求

- 前端代码的文档注释统一使用 JSDoc 风格
- 导出的函数、组件、hooks、composables、class、复杂 util 默认应写 JSDoc
- 非导出但包含隐含副作用、缓存策略、兼容性分支或复杂数据约束的实现，也应补 JSDoc 或短块注释

## JavaScript 文件

在 `.js` / `.jsx` 中，JSDoc 同时承担“接口语义”和“类型补充”职责。

- 对公开函数、组件和工厂函数，优先写完整 `@param`、`@returns`
- 当结构体较复杂时，可使用 `@typedef`、`@property`
- 当回调、联合值或可空值不直观时，应通过 JSDoc 明确
- 如果运行时会抛错、触发副作用或依赖外部约束，应在描述中写清楚

## TypeScript 文件

在 `.ts` / `.tsx` 中，JSDoc 主要承担“语义、约束、边界”职责，不重复 TypeScript 已清楚表达的静态类型。

- 不要机械重复显而易见的参数类型和返回类型
- 重点写业务语义、前置条件、副作用、异常、并发约束、缓存语义和兼容性原因
- 仅当泛型语义、判别联合、不透明结构或跨层协议难以从类型直接读懂时，再补充标签说明
- 若 TypeScript 类型已经足够清楚，可保留简短摘要而不是冗长标签

## 组件与框架约定

- React 组件注释说明职责、重要 props 语义、副作用和渲染边界
- Vue composable 注释说明输入、返回约定、响应式行为和副作用
- hooks / composables 要特别说明调用时机限制与依赖假设

## 推荐标签

- `@param`
- `@returns`
- `@typedef`
- `@property`
- `@throws`
- `@example`
  仅在调用方式不直观时使用

## 避免事项

- 在 TypeScript 中把类型再抄一遍，形成双重维护
- 为每个私有小函数机械补全模板化 JSDoc
- 用 JSDoc 替代更好的命名、拆分和类型设计
