# 偏差原因分析

## 确认后的标准

- 对外组件库契约统一写入 `docs/out-components/`，对外 API 契约统一写入 `docs/out-api/`。
- `docs/components/` 不再是当前项目自身组件库输出目录，也不得作为 `docs/out-components/` 的镜像或索引包装。
- 当当前项目消费外部组件库、Design System、UI SDK 或 workspace 组件包时，`docs/components/` 是消费方组件文档目录；否则已有 `docs/components/` 只能作为旧文档来源处理。
- 已存在的 `docs/components/` 必须判断 ownership：属于当前组件库源码的转换为 `docs/out-components/`；属于外部组件依赖的转换或保留为 `docs/components/`；无法确认时归档到 `docs/other/imported/components/` 并标记 `MISSING conversion`。
- `components-docs` 和 `api-docs` 负责生成对外复用产物；`scaffold-docs.mjs` 只创建内部知识库骨架，不生成对外产物正文。

## 事实证据

- 用户反馈：组件库项目实际生成了项目根目录 `out-components/`，同时 `docs/components/` 只作为 `out-components` 的索引包装，产生了不必要目录。
- `skills/init-project/scripts/scaffold-docs.mjs` 原逻辑包含 `includeComponents`，会在组件库项目或已有 `docs/components/` 时创建或保留 `docs/components/`。
- `scaffold-docs.mjs` 原 `standardNames` 把 `components` 当作标准目录，导致已有 `docs/components/` 不会被归档为旧来源。
- `skills/components-docs/SKILL.md` 原规则同时描述 `out-components/` 与 `docs/components/`，会误导 AI 维护双目录。
- `skills/init-project/references/frontend/out-components.md` 与 `skills/init-project/references/backend/out-api.md` 原规则把对外产物写在项目根目录 `out-components/`、`out-api/`。
- `docs/map.md` 原入口包含 `components/index.md`，强化了 `docs/components/` 是标准目录的错误信号。

## 根因分类

- 主因：`SKILL_GAP`
- 次因：`RULE_GAP`

## 为什么不是其它分类

- 不是 `AI_EXECUTION_ERROR`：旧 skill 和初始化脚本明确写出了根目录 `out-components/`、`out-api/` 以及 `docs/components/` 双目录维护，AI 按旧规则执行会得到错误结构。
- 不是 `REQUIREMENT_AMBIGUITY`：用户已经明确指出 `docs/components` 不能作为当前项目自身组件库输出的索引包装，并确认对外产物应归入 `docs/out-components/` 与 `docs/out-api/`。
- 不是 `CONTEXT_LOSS`：本次偏差来自规则源和脚本模板本身，而不是遗漏已有上下文。
- 不是 `TOOL_OR_ENVIRONMENT`：没有证据表明工具、权限、平台或缓存导致目录写错。

## 修复动作

- 修改 `skills/init-project/scripts/scaffold-docs.mjs`：删除 `docs/components/` 作为当前组件库输出目录的生成逻辑；新增 `component-consumer` 时才创建消费方 `docs/components/`；在 map 模板中声明 `docs/out-components/` 与 `docs/out-api/` 为提供方对外复用产物。
- 修改 `skills/init-project/scripts/detect-stack.mjs`：新增 `component-consumer` stack，通过外部组件库依赖或 workspace UI 包名识别前端组件消费方，并注入 `frontend/components.md`。
- 修改 `tests/init-project-scripts.test.ts`：覆盖组件库项目不创建旧输出型 `docs/components/`、已有 `docs/components/` 在非消费方项目归档到 `docs/other/imported/components/`、组件消费方项目创建并保留 `docs/components/`。
- 修改 `skills/components-docs/SKILL.md`：区分 provider mode 与 consumer mode，当前项目提供的组件库输出到 `docs/out-components/`，当前项目消费的外部组件库输出到 `docs/components/`。
- 修改 `skills/api-docs/SKILL.md`：区分 provider mode 与 consumer mode，当前项目提供的 API 输出到 `docs/out-api/`，当前项目消费的外部 API/上游服务输出到 `docs/api/`。
- 修改 `skills/init-project/SKILL.md` 与 `references/frontend/out-components.md`、`references/frontend/components.md`、`references/backend/out-api.md`、`references/common/docs.md`：统一 ownership 口径，说明旧接口/组件文档必须判断归属后转换。
- 修改 `docs/map.md` 并删除 `docs/components/index.md`：当前项目不再暴露旧组件文档入口。

## 验证结果

- `npx vitest run tests/init-project-scripts.test.ts`：PASS，30 passed，1 skipped。
- `npx vitest run tests/skill-validation.test.ts tests/components-docs-scripts.test.ts`：PASS，10 passed。
- `npm run lint:check`：PASS。
- `npm run typecheck`：PASS。
- `git diff --check`：PASS，仅输出 Windows 换行提示，无 whitespace failure。

## 预防动作

- 后续规则中只允许把提供方对外复用产物写为 `docs/out-components/` 与 `docs/out-api/`，不得重新引入项目根目录 `out-*`。
- `docs/components/` 只允许作为消费方外部组件库文档目录；不得作为 `docs/out-components/` 的镜像、索引或当前项目业务组件文档目录。
- 对外产物的正文必须由 `components-docs`、`api-docs` 基于源码和已有文档推导，初始化脚本只负责骨架和归档，不生成正文。
