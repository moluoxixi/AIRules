## 前端字段与组件评估纪律

- 适用范围：仅注入到前端或纯前端项目；后端、混合全栈、脚本、文档和基础设施项目不默认注入。
- 字段对比：编码前逐项列出 UI 字段与来源契约（API / OpenAPI / 接口代码 / API client / store / route params / permission / state / persistence / static / derived）的对应关系；记录字段用途、展示形态、来源路径或端点、是否已存在。
- 缺失处理：UI 必需字段在 API、store、route、permission 或 state 契约中不存在、含义不清或权限不可证实时，标记 `MISSING blocked: <reason>`；不得用 mock 字段、默认值、猜测字段、后续补充、空值兜底继续规划或编码。
- 组件复用：先检索项目现有组件、hook、composable、工具函数和已安装 UI 库；每个 UI 单元必须分类为 `existing` / `wrap existing` / `new`，并记录复用路径、封装目标或新建理由。
- 封装边界：只有当现有组件不能满足字段展示、交互状态、权限/禁用、异步加载、错误态、可访问性或响应式要求时，才允许封装或新建；封装必须说明输入输出、依赖字段和复用场景。
- 落档位置：存在 OpenSpec change 时写入该 change 的 `plan.md` 或 `design.md`；无 OpenSpec change 时写入任务说明或实现记录。落档至少包含 `Layout`、`Fields`、`Components`、`States`、`Frontend Test Matrix`。
- 验证证据：编码后使用项目已有测试工具，并按 `frontend-testing` 选择 unit / component / E2E / browser / visual smoke；记录命令、退出码、desktop / mobile 视口、console / network 检查、截图或日志。无可运行前端测试时标 `MISSING blocked` 或说明项目级阻塞，不得伪造 PASS。
