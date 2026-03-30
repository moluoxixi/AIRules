# Rules

本目录保存第一方规则，不依赖第三方仓库中的相对引用结构。

## 分层继承架构

规则采用三层继承体系：

```
common/                    # 通用原则层（跨语言）
├── coding-standards.md    # 通用编码规范
├── comments.md            # 通用注释原则
├── testing-standards.md   # 通用测试原则
└── verification.md        # 通用校验原则

tech-stack/                # 技术栈实现层（具体工具）
├── java/
│   ├── overview.md        # 架构原则
│   ├── comments.md        # JavaDoc 规范
│   ├── testing.md         # JUnit 5 + Mockito
│   └── verification.md    # Checkstyle + SpotBugs
├── nest/
│   ├── overview.md
│   ├── comments.md        # TSDoc 规范
│   ├── testing.md         # Jest + TestingModule
│   └── verification.md    # ESLint + tsc
├── react/
│   ├── overview.md
│   ├── comments.md        # JSDoc/TSDoc 组件注释
│   ├── testing.md         # Vitest + Testing Library
│   └── verification.md    # ESLint + typescript-eslint
├── vue/
│   ├── overview.md
│   ├── comments.md        # SFC 注释规范
│   ├── testing.md         # Vitest + Vue Test Utils
│   └── verification.md    # ESLint + vue-tsc
├── rust/
│   ├── overview.md
│   ├── comments.md        # rustdoc 规范
│   ├── testing.md         # #[test] + proptest
│   └── verification.md    # Clippy + rustfmt
├── frontend/              # 前端跨框架通用
│   ├── overview.md
│   ├── comments.md
│   ├── testing.md
│   └── verification.md
└── backend/               # 后端跨框架通用
    ├── overview.md
    ├── comments.md
    ├── testing.md
    └── verification.md
```

## 文件命名约定

每个技术栈目录包含4个标准文件：

| 文件 | 内容 |
|------|------|
| `overview.md` | 纯架构原则（分层、职责、边界） |
| `comments.md` | 注释规范（语言/框架特有） |
| `testing.md` | 测试规范（工具、命名、结构） |
| `verification.md` | 校验规范（lint、type check、build） |

## 继承原则

1. **Common Layer**: 定义跨语言通用原则，不涉及具体工具
2. **Tech-Stack Layer**: 继承 common 原则，指定具体工具和命令
3. **引用方式**: 技术栈文件应引用 common 层原则，而非重复定义

## 推荐分工

- `rules/` 负责稳定、可复用、跨任务的约束，例如注释规范、代码组织原则、验证门禁
- `skills/` 负责任务流程、检查清单和技术栈实现策略
- 若某项要求需要长期适用于多个 skill，优先写进 `rules/`，再由对应 skill 引用
