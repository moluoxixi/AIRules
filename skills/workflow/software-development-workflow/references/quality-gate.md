# 质量门选择

本文件提供验证范围选择建议。项目硬性要求、用户指令和 CI 规则优先级更高。

## 验证分级

| 场景 | 默认验证 |
|---|---|
| 咨询、审查、方案讨论、只读排查 | 不运行命令；报告未修改代码 |
| 文档、AGENTS、Skill、README、策略规则 | `git diff --check`、相关策略测试、目标文件 lint |
| 小范围低风险代码修改 | touched files 静态检查、直接相关单测，必要时类型检查 |
| 功能新增、Bug 修复、运行时行为变更 | 相关静态检查、相关测试、必要类型检查，按风险补 coverage/build/browser |
| 多模块、高风险、发布前 | 静态检查、类型检查、测试、coverage、构建、必要手动或浏览器验证 |

避免把所有任务默认升级为 Superpowers、全量测试、coverage 或构建；验证范围应匹配风险和变更面。

## 可评估维度

按相关性选择以下维度：
- 静态质量，例如 lint 或 formatter 检查；
- 类型正确性，例如 TypeScript、vue-tsc、tsc 或等价机制；
- 覆盖改动行为的自动化测试；
- 项目有 coverage 工具且改动包含有意义逻辑时的覆盖率；
- 运行时交付可能受影响时的构建或打包；
- 自动化检查无法覆盖用户行为时的手动或浏览器验证。

与本次任务无关的维度可报告为 `N/A`，不要为了凑清单制造无意义检查。

## 命令发现

优先从以下位置发现命令：
- `package.json` scripts；
- pnpm、npm、turbo、nx、vite、vitest、playwright、eslint、tsconfig 等 workspace 配置；
- 仓库文档；
- 现有 CI 配置；
- 项目级 agent 指令。

示例仅作示意：`pnpm lint`、`npm test`、`pnpm exec tsc --noEmit`、`pnpm build`、`pnpm coverage`。

## Coverage 参考

优先使用项目阈值。若项目未定义阈值，按 80% statements、branches、functions、lines 报告。

新增或修改逻辑应尽量达到 90%+ 有意义覆盖。鉴权、支付、删除、迁移、安全边界和核心业务规则需要覆盖成功、失败、边界和异常路径。

## 状态建议

使用显式状态：
- `PASS`：命令已运行并满足相关阈值。
- `FAIL`：命令已运行但失败。
- `MISSING`：该维度相关，但项目缺少脚本、配置、依赖或测试入口。
- `NOT RUN`：该维度相关，但因时间、环境或用户指令未运行，必须说明原因。
- `N/A`：该维度与本次任务无关。

不要把 `FAIL`、`MISSING`、`NOT RUN` 或 `N/A` 转写成通过。
