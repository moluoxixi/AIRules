# Nest Rules Overview

适用于 NestJS 项目。

## 架构原则

- module / controller / service / dto 分层明确
- provider 依赖收敛，不跨层直接耦合
- 参数校验、配置加载、异常过滤优先标准化

## 相关规则

- [comments.md](./comments.md) - TSDoc 注释规范
- [testing.md](./testing.md) - Jest + supertest 测试规范
- [verification.md](./verification.md) - ESLint + tsc --noEmit + Prettier 校验
