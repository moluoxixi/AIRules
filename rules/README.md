# Rules

本目录保存第一方规则，不依赖第三方仓库中的相对引用结构。

## 设计原则

- `common/` 放所有技术栈都适用的通用约束
- 语言或框架目录只放该技术栈特有规则
- 第三方 skills 通过 `~/.moluoxixi/skills/` 暴露，不直接塞进这里

## 当前规则层

- `common/`
- `common/comments.md`
- `frontend/`
- `frontend/jsdoc.md`
- `frontend/workflow.md`
- `backend/`
- `react/`
- `vue/`
- `nest/`
- `rust/`
- `java/`
- `testing/`

## 推荐分工

- `rules/` 负责稳定、可复用、跨任务的约束，例如注释规范、代码组织原则、验证门禁
- `skills/` 负责任务流程、检查清单和技术栈实现策略
- 若某项要求需要长期适用于多个 skill，优先写进 `rules/`，再由对应 skill 引用
