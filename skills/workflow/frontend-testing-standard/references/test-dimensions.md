# 前端测试维度

## 静态质量

检查 lint、格式化、导入规则、未使用代码、依赖边界和项目特定静态规则。

## 类型正确性

使用项目的类型机制，例如 TypeScript、vue-tsc、框架 typecheck 或 workspace type 任务。

## 单元逻辑

可覆盖：
- 纯工具函数；
- 数据转换；
- 校验器；
- 权限规则；
- 无 DOM 依赖的 hooks/composables；
- stores 和 reducers；
- 错误转换和失败传播。

## 组件行为

可覆盖：
- props 和 emitted events / callbacks；
- slots 或 children；
- loading、empty、error、success 状态；
- 表单校验和提交；
- disabled 和权限受限状态；
- 异步更新和竞态敏感行为。

测试可见行为，而不是实现细节。

## 页面集成

可覆盖：
- 路由加载和参数处理；
- API 触发时机；
- 成功、失败和空 API 响应；
- 导航之间的状态保留或重置；
- modal、drawer、table、tab、menu 和 pagination 流程。

## 交付行为

当项目支持时，检查生产构建或等价打包路径可用，并确认构建后的应用能在预期宿主中渲染。
