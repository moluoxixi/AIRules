# 命令发现

## 发现顺序

从以下位置发现命令：
- 包管理器 lockfile 和 workspace 文件；
- `package.json` scripts；
- Vite、Nuxt、Next、Vue、React、Vitest、Playwright、ESLint、TypeScript 等框架配置；
- CI 文件；
- 仓库文档；
- 项目指令。

不要发明项目不存在的脚本，也不要因为某命令在其他项目常见就把它当成本项目必需项。

## 常见脚本类别

关注名称暗示以下用途的脚本：
- lint 或静态检查；
- typecheck 或只编译不输出的类型验证；
- test、unit、component、e2e、integration；
- coverage；
- build；
- preview 或 start；
- storybook、histoire、docs 或相关视觉测试。

示例命令仅作示意：`pnpm lint`、`npm run typecheck`、`pnpm test`、`pnpm coverage`、`pnpm build`、`pnpm exec playwright test`。

## 结果标签

- `PASS`：命令已运行且成功。
- `FAIL`：命令已运行但失败。
- `MISSING`：没有脚本、配置、依赖或测试目标。
- `NOT RUN`：由于时间、环境、依赖或用户指令跳过。
- `N/A`：该维度与本次任务无关。

报告时写明实际运行的精确命令和结果。
