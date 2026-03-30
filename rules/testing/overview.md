# Testing Rules Overview

适用于 UI、接口和服务测试。

## 继承关系

测试规则采用分层继承架构：

- **Common Layer**: [`rules/common/testing-standards.md`](./common/testing-standards.md) - 跨语言通用测试原则
- **Tech-Stack Layer**: 各技术栈目录下的 `testing.md` - 具体工具和框架规范

## 技术栈测试规范

| 技术栈 | 测试规范文件 |
|--------|-------------|
| Java | [`rules/java/testing.md`](../java/testing.md) |
| NestJS | [`rules/nest/testing.md`](../nest/testing.md) |
| React | [`rules/react/testing.md`](../react/testing.md) |
| Vue | [`rules/vue/testing.md`](../vue/testing.md) |
| Rust | [`rules/rust/testing.md`](../rust/testing.md) |
| Frontend (通用) | [`rules/frontend/testing.md`](../frontend/testing.md) |
| Backend (通用) | [`rules/backend/testing.md`](../backend/testing.md) |

## 核心原则

- 先定义关键路径
- 关键流程优先覆盖
- UI 测试聚焦用户可见行为，不依赖脆弱选择器
- 构建、lint、测试、文档检查最好形成同一验证链
