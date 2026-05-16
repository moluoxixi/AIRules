---
name: backend-code-standard
description: 用于编写、修改或评审 Node.js 后端代码，适用于 Fastify、Express、Koa、Nitro、NestJS，并强制执行垂直切片、领域模块化、严格 DI、严格 Barrel、路径别名、逐级上浮和 API 契约注释。
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

## 必读规范

后端目录创建、业务分层和编码约束不可拆开理解，必须按项目框架读取对应规范。

- Fastify / Express / Koa / Nitro：读取 [vertical-slice-backend-standard.md](references/vertical-slice-backend-standard.md)。
- NestJS：读取 [nest-backend-standard.md](references/nest-backend-standard.md)。

## 验证辅助

本 Skill 自带 `scripts/verify-rules.mjs`，用于快速验证后端专属的三次原则和最近公共父级抽离位置。该脚本只属于本 Skill，不得用仓库根级共享脚本替代。

## 硬性原则

- 垂直切片：代码必须按业务领域组织，不得按 Controller、Service、Repository 做全局扁平分层。
- 传输层隔离：Controller 只处理请求解析、载荷校验、Service 调用和响应格式化，业务规则必须沉淀在 Service。
- NestJS DI 隔离：跨模块协作必须通过 `imports`、`exports` 和构造函数注入完成，禁止 `new Service()` 或直接导入私有 Service。
- 数据契约拆分：`dtos/` 负责 Request/Response 和运行时校验，`types/` 负责内部领域模型与数据库模型。
- NestJS DTO：Controller 请求入参必须使用 `class` DTO 和 `class-validator`，禁止使用 `any` 或松散 `interface` 接收请求数据。
- 统一导出：任意功能集目录必须提供 `index.ts` 作为唯一对外 API 入口。
- 路径别名优先：跨模块引用或多层向上查找时，必须优先使用项目配置的路径别名。
- Deep Imports 零容忍：跨领域只能依赖目标模块入口，不得穿透引用内部 Repository 或底层数据结构。
- 逐级上浮：满足三次原则后只能提取到最近公共父级，只有跨顶级业务域复用才允许进入 `src/common/` 或 `src/utils/`。
- 注释解释业务契约：Service 公共方法和外部 DTO 必须写清参数、返回值、业务异常、业务规则和边界条件。
- 标准异常：NestJS Service 层遇到业务阻断时必须抛出 Nest 内置 `HttpException` 或其子类，Controller 不手动吞掉标准异常。
- 数据一致性闭环：当修改涉及底层数据模型或领域实体时，必须同时考虑并生成/执行数据库迁移脚本（Migrations），不可只改代码不改表结构定义。
