# Rust Rules Overview

适用于 Rust 服务、CLI 与工具项目。

## 架构原则

- 错误类型显式建模
- I/O 与纯逻辑分离
- 并发与异步行为要可测试
- 模块边界保持小而清晰

## 相关规则

- [comments.md](./comments.md) - rustdoc (`///`, `//!`) 注释规范
- [testing.md](./testing.md) - `#[test]` + proptest 测试规范
- [verification.md](./verification.md) - Clippy + rustfmt + cargo audit 校验
