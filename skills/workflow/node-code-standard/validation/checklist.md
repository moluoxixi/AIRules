# Node 后端校验清单

本文件只提供校验脚本用法和检查清单，不定义新规则；规则以 `SKILL.md` 为准。

## 脚本用法

```bash
node skills/workflow/node-code-standard/scripts/verify-rules.mjs
node skills/workflow/node-code-standard/scripts/verify-rules.mjs hoist --target src/modules/orders/shared --uses src/modules/orders/create/create-order.service.ts src/modules/orders/update/update-order.service.ts src/modules/orders/cancel/cancel-order.service.ts
```

## 检查清单

1. 是否先确认了业务能力、外部契约、模块边界、事务要求、持久化模型、并发要求和当前项目使用的 Node 基础设施？
   - 未阅读时标记 `NOT RUN`，不得伪装成已完成审查。
2. 当前目标分类是否明确为 `entrypoint`、`transport-module`、`application-module`、`domain-module`、`infrastructure-adapter`、`shared-support` 或 `mixed-module`？
   - 若分类不清，标记 `FAIL`，并说明职责为什么混杂。
3. transport 是否只处理路由、参数提取、输入校验和响应映射？
   - 若 transport 直接操作 repository、拼装事务或暴露持久化细节，标记 `FAIL`。
4. 边界输入与配置是否通过成熟 schema 方案或框架内建机制表达运行时契约？
   - 若只存在 TypeScript 类型、没有运行时校验，标记 `FAIL`，指出缺失位置和建议补点。
5. 依赖是否统一通过构造参数、工厂参数或模块装配显式注入，没有全局可变状态、隐式单例或横向读取容器？
   - 若不符合，标记 `FAIL`，指出具体模块和建议替换方式。
6. application service 是否承担用例编排与事务边界，而不是把这些职责分散在 transport、middleware、hook 或 repository 中？
   - 若不符合，标记 `FAIL`，指出错误边界和应迁移的位置。
7. domain 是否承载核心业务规则和仓储契约，而不是依赖 HTTP 框架、ORM、SDK 或消息中间件细节？
   - 若不符合，标记 `FAIL`，指出具体耦合点。
8. repository / gateway 是否只负责持久化和外部依赖访问，没有夹带 HTTP 拼装、鉴权决策、缓存编排或跨聚合流程？
   - 若不符合，标记 `FAIL`，指出越界逻辑和回收层次。
9. 数据库结构变更是否通过项目现有迁移机制表达？
   - 若缺失迁移脚本，标记 `FAIL` 或 `MISSING`，并说明原因。
10. 公共抽离是否满足至少三个独立使用点，并且落在最近公共父级的直接共享目录？
    - 可配合 `verify-rules.mjs hoist` 校验；脚本 `PASS` 只代表抽离位置通过，不代表实现整体通过。
11. 是否运行了与风险匹配的现有 lint、typecheck、test、build、启动验证或集成测试？
    - 缺少脚本或依赖时标记 `MISSING`，未执行标记 `NOT RUN`，失败标记 `FAIL`。

## 评审输出最低要求

- 先写目标分类和本次检查范围。
- 给出总结论：`PASS`、`FAIL`、`MISSING`、`NOT RUN` 或 `N/A`。
- 每个问题都要包含：规则点、证据（文件路径和位置）、问题说明、可执行的改动建议。
- 不得把脚本 `PASS`、未检查项或缺失脚本写成整体 `PASS`。
