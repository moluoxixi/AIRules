---
name: frontend-library-standard
description: 用于新写或重构前端工具包、UI 组件库和公共库时，按统一库标准重建 README、公开入口、src 结构、导入边界和副作用契约；允许完全重写旧库结构，不为兼容保留过渡出口。
---

# 前端库实现标准

## 使用场景

当任务目标是新写工具包、重构 UI 组件库、整理公共导出、收敛副作用边界，或判断一组公共能力是否应该升级为独立库时，使用本 Skill。

本 Skill 面向新实现和重构实现，不面向兼容式修补。旧 README、旧目录结构、旧导出层级、旧 deep import 路径一旦妨碍当前目标，就直接按标准重建；不要为了兼容旧调用方式保留双出口、镜像目录或过渡 barrel。

## 工作顺序

1. 先确认库职责、调用方契约、运行环境和项目已有公共基础设施。
2. 判断目标属于 `utility-library`、`ui-library` 或 `component-package`。
3. 明确哪些 API 应公开，哪些实现必须留在 `src/` 内部。
4. 直接按目标职责重建 README、根入口、`src/` 结构、类型出口和副作用边界，不保留无价值兼容层。
5. 完成后按风险执行项目已有 lint、typecheck、test、build 或浏览器验证；缺少脚本时标记 `MISSING`，失败标记 `FAIL`，未执行标记 `NOT RUN`。

## 实现原则

- 公共 API 稳定：根入口只暴露稳定、明确、可维护的公开能力。
- 实现内聚：内部实现留在 `src/`，不要把内部目录当成半公开 API。
- 副作用显式：涉及浏览器、时间、随机数、网络和存储时显式表达依赖和失败语义。
- 失败显性：依赖、环境和输入不满足契约时暴露失败，不写静默兜底、伪成功和假默认值。
- 类型从事实来：优先从常量、schema、外部库和真实返回值推导类型。
- 抽象要付账：不要为了“组件库应该更完整”机械增加 wrapper、barrel 或中间层。
- 注释解释意图：只说明公共契约、运行边界和非显然取舍。

## 分类标准

### utility-library

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- `src/` 下使用 `index.ts` / `index.js` 作为聚合入口。
- 工具函数保持纯净、可组合、可测试；涉及副作用时显式表达依赖。

### ui-library

- 使用根 `README.md`、`index.ts` / `index.js` 和 `src/`。
- `src/components/` 下至少包含一个复杂组件包。
- UI 组件库组件之间通过公共入口协作，不互相穿透内部 `src/`。

### component-package

- 当独立组件需要稳定包级 API、README 和内部目录边界时，也使用本标准。
- 复杂组件包结构与 `frontend-component-standard` 保持一致。

## 目录与导出

- 只有 `utility-library`、`ui-library` 和 `component-package` 允许通过根 `index.ts` / `index.js` 暴露包级公共 API。
- 根入口只暴露稳定公共 API；内部实现留在 `src/`。
- `styles/` 只使用一个 `index.css`、`index.scss` 或 `index.less` 作为样式入口。
- README 必须说明使用方式、公共 API、主要约束和典型示例。
- 禁止为了兼容旧导出路径保留双 barrel、镜像目录或重复实现。

## 导入与类型

- 路径别名优先：跨库引用时优先使用项目配置的路径别名。
- 禁止 deep import；外部不得穿透到具体实现文件、私有目录或 `src/` 内部。
- 类型出口优先使用 type-only re-export，例如 `export type * from './props'`。
- 不用 `any`、宽泛对象或可选字段掩盖契约不清。

## 完成前检查

- README、公开 API 和目录结构是否围绕当前职责重建，而不是继续迁就旧结构。
- 是否还保留了只为兼容旧导出存在的重复 barrel 或中间层。
- 副作用依赖和失败语义是否显式表达。
- 是否运行了与风险匹配的现有 lint、typecheck、test、build 或浏览器验证。

## 辅助资源

- 示例：`examples/`
- 校验清单：`validation/checklist.md`
- 结构校验脚本：`scripts/verify-rules.mjs`（覆盖库结构约束，不替代实现审查）
