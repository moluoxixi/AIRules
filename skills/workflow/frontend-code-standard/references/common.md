# 前端通用代码规范

## 命名

| 对象 | 规则 | 示例 |
|---|---|---|
| 变量 | camelCase | `loading`, `tableData`, `queryParams` |
| 函数 | camelCase，尽量动词开头 | `handleSearch`, `createDefaultParams` |
| 类型 / interface | PascalCase | `UserRecord`, `OrderQueryParams` |
| 常量 | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| 组件目录 | PascalCase | `FormDrawer/` |
| 非组件目录 | camelCase | `userManagement/`, `orderList/` |
| hook / composable | `use` + PascalCase | `useUserList`, `useOrderDetail` |
| ref 变量 | camelCase + `Ref` | `formDrawerRef` |

## 注释

注释用于帮助读者快速识别职责、边界、约束、副作用和失败语义，而不是替代码做逐行复述。

建议注释：
- module、page、component、composable/hook、store、复杂配置对象；
- 导出 API 和跨文件复用函数；
- 业务规则、校验器、权限检查、数据转换、事件处理函数和异步流程；
- 来源、限制或业务含义不明显的常量。

极小的局部回调、清晰的测试内联 helper、或上下文已完整表达用途的短私有函数，可以省略注释。

避免：
- 复述函数名；
- 写类似“set loading to true”的机械注释；
- 写只为满足规则但不提供信息的空泛注释。

## 错误与 fallback

不要用空默认值、伪成功、缓存值或静默 fallback 掩盖 API、校验或渲染失败。UI 需要空状态时，应显式表达空状态，并保留真实失败的可见性。

API 函数通常应保留失败语义；只有调用方明确需要领域化失败结果时，才转换成显式失败结果。

如果捕获错误是为了用户反馈、清理资源或补充上下文，应重新抛出或返回显式失败结果，不要把失败路径转成成功路径。

## API 对齐

前端模型应对齐后端契约：
- 以当前 API 类型、schema、文档或既有模块契约为准；
- 不添加 API 不返回的字段；
- 除非项目明确要求兼容，不同时支持多套历史字段名或响应形状；
- 除非 API 契约确实可变且有文档说明，不添加 `resolveXxxResponse`、`normalizeXxxPage` 等响应适配层；
- 接口变化后及时移除过时兼容；
- 表单模型和持久化实体约束不同时，应保持分离。

## 状态与导出面

- 可变状态保持单一事实来源。
- 不保留重复 ref、store 或派生状态，除非它们有独立且清楚的职责。
- 只暴露消费者实际使用的状态和 action。
- 重构时移除过时 wrapper、alias 和未使用的导出 action。

## 复用阈值

只有复用真实存在时再抽工具：
- 只在一个文件使用：保持局部；
- 两三个文件使用：如果能澄清边界，可考虑抽取；
- 四个及以上文件使用：抽到共享模块。
