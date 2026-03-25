# Rules

本目录保存第一方规则，不依赖第三方仓库中的相对引用结构。

## 设计原则

- `common/` 放所有技术栈都适用的通用约束
- 语言或框架目录只放该技术栈特有规则
- 第三方 skills 通过 `~/.moluoxixi/skills/` 暴露，不直接塞进这里

## 当前规则层

- `common/`
- `frontend/`
- `backend/`
- `react/`
- `vue/`
- `nest/`
- `rust/`
- `java/`
- `testing/`
