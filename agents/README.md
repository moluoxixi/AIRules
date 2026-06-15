# AIRules Agents（开发链路子代理）

本目录是 AIRules 的第一方 agent 定义层。每个 `.md` 文件描述一个**薄壳子代理**：只封装「角色心智 + 触发条件 + 写入边界 + 加载哪个 skill」，**不写死具体知识、不指定模型、不写死工具列表**。

frontmatter 只保留各厂商通吃的 `name` 与 `description`：

- **不写 `model`**：各宿主可用模型不同，写死会假设用户拥有某个特定模型。模型由各宿主自行决定。
- **不写 `tools`**：各厂商工具体系与命名不一致（如 `Read`/`Grep`/`Glob` 是 Claude 的叫法，Cursor/OpenCode/Codex 不认；Cursor/OpenCode 的 subagent 根本没有 `tools` 字段）。写死会在不支持的宿主上变成无效 frontmatter 甚至解析报错。**工具/读写边界改用正文自然语言表达**（如「只读评审，不改任何代码」「只写测试文件」），由各宿主自行映射到其工具体系。

知识仍由对应 skill 承载（薄 agent + 厚 skill）。

## 同步链路

agent 文件随 AIRules 安装自动投影到各宿主：

```
仓库 agents/  →  ~/.moluoxixi/agents  →  <每个宿主>/agents（软链接）
```

无需额外配置；新增/修改 agent 文件后运行 `pnpm sync`（或 `airules sync --host all`）即可分发到所有已安装宿主（Claude / Cursor / Codex / Hermes 等）。

## 为什么按前端/后端、交互/单元拆分

agent 的本质是「心智模型 + 上下文来源 + 工具白名单」的封装。前端与后端的关注清单、上下文来源、编码方式不同；交互测试与单元测试的框架与断言对象不同。把不同心智塞进一个 agent 会让触发条件模糊、白名单无法收窄。因此按栈和测试类型拆开，每个 agent 触发清晰、边界明确。

## Agent 清单

| Agent | 开发环节 | 加载的核心 skill | 写入边界 |
|---|---|---|---|
| `frontend-planner` | 前端实现计划 + 性能评估 | `frontend-impl-plan` | 只写计划文档 |
| `backend-planner` | 后端实现计划 + 安全评估 | `backend-impl-plan` | 只写计划文档 |
| `frontend-coder` | 前端代码编写 | `frontend-impl-plan` + 项目规则 | 写前端源码与配套测试 |
| `backend-coder` | 后端代码编写 | `backend-impl-plan` + 项目规则 | 写后端源码与配套测试 |
| `interaction-test-author` | 前端交互测试编写 | `test-docs` + `playwright` | 只写测试文件 |
| `unit-test-author` | 单元测试编写 | `test-docs` + `test-driven-development` | 只写测试文件 |
| `frontend-reviewer` | 前端代码评审 | `code-reviewer` | 只读，不改代码 |
| `backend-reviewer` | 后端代码评审 | `code-reviewer` | 只读，不改代码 |

## 边界约定

- agent 是给宿主 AI 读取的「纯数据」产物，不是当前会话的系统规则。
- 测试**运行**（执行命令、收集输出）不建模为 agent，归 `verification-before-completion` 环节。
- 评审 agent 与编写代码的 agent 必须是不同实例，不得自评（见根 `AGENTS.md` 子代理委派节）。
- agent 引用的 skill 名以宿主投影后的实际目录名为准（如评审 skill 在本项目投影为 `code-reviewer`/`code-reviewer-gemini`）。
