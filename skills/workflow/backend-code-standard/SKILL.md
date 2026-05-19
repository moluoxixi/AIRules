---
name: backend-code-standard
description: 用于编写、修改或评审 Node.js 后端代码，适用于 Fastify、Express、Koa、Nitro 和 NestJS。
---

# 后端编码规范

## 用途

本 Skill 是 Node.js 后端代码的编码规范来源，适用于 Fastify、Express、Koa、Nitro 和 NestJS。

生成、重构或修改后端代码时，必须优先遵循垂直切片架构、领域驱动组织原则和框架自身的模块边界：每个业务模块都视为自治的微服务域，传输层与核心业务逻辑必须严格隔离。

## 适用场景

- 新增或调整 Fastify、Express、Koa、Nitro 的路由、Controller、Service、Repository、DTO、领域类型和模块边界。
- 新增或调整 NestJS 的 Controller、Service、Module、DTO、Entity、Provider、Guard、Interceptor、Pipe 和模块 DI 边界。
- 评审后端目录结构、数据契约、运行时校验、统一导出、import 路径和依赖流向。
- 判断工具函数、中间件、类型和数据访问逻辑应该留在当前领域，还是满足三次原则后逐级上浮。

## 规则源与辅助材料

本文件是 Node.js 后端编码规范的唯一规则源。需要辅助材料时按需读取：

- Fastify / Express / Koa / Nitro 示例：[node-backend-structure.md](examples/node-backend-structure.md)
- NestJS 示例：[nestjs-module-structure.md](examples/nestjs-module-structure.md)
- 校验脚本用法与检查清单：[checklist.md](validation/checklist.md)

## 验证辅助

本 Skill 自带 `scripts/verify-rules.mjs`，用于快速验证后端专属的三次原则和最近公共父级抽离位置。该脚本只属于本 Skill，不得用仓库根级共享脚本替代。

## 硬性原则

- 垂直切片：代码必须按业务领域组织，不得按 Controller、Service、Repository 做全局扁平分层。
- 传输层隔离：Controller 只处理请求解析、载荷校验、Service 调用和响应格式化，业务规则必须沉淀在 Service。
- NestJS DI 隔离：跨模块协作必须通过 `imports`、`exports` 和构造函数注入完成，禁止 `new Service()` 或直接导入私有 Service。
- 数据契约拆分：`dtos/` 负责 Request/Response 和运行时校验，`types/` 负责内部领域模型与数据库模型。
- NestJS DTO：Controller 请求入参必须使用 `class` DTO 和 `class-validator`，禁止使用 `any` 或松散 `interface` 接收请求数据。
- 运行时校验：Fastify/Nitro/H3 优先使用框架支持的 schema 或 validator；Express/Koa 必须在路由边界显式校验输入；NestJS 必须使用 class DTO、`class-validator` 和 ValidationPipe。
- 协议错误边界：HTTP 层负责把领域错误映射为框架错误响应；Service 保留领域语义，禁止吞异常、伪造成功或在核心业务里硬绑定 HTTP 状态。
- 公共入口：业务模块或需要稳定公共 API 的功能集目录必须提供 `index.ts` 作为对外入口；模块私有子目录不强制创建 barrel。
- 路径别名优先：跨模块引用或多层向上查找时，必须优先使用项目配置的路径别名。
- Deep Imports 零容忍：跨领域只能依赖目标模块入口，不得穿透引用内部 Repository 或底层数据结构。
- 逐级上浮：满足三次原则后只能提取到最近公共父级，只有跨顶级业务域复用才允许进入 `src/common/` 或 `src/utils/`。
- 注释解释业务契约：Service 公共方法和外部 DTO 必须写清参数、返回值、业务异常、业务规则和边界条件。
- 生产边界：必须显式处理安全头、CORS、速率限制、请求体大小、超时、日志脱敏和异步错误传播；优先使用框架推荐插件或中间件。
- 数据一致性闭环：当修改涉及底层数据模型或领域实体时，必须判断是否影响持久化结构；涉及表结构、索引、约束或枚举值变化时必须补充并执行数据库迁移脚本（Migrations）。
