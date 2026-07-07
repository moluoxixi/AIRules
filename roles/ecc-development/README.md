# ecc-development role

`ecc-development` 是独立的 ECC 原生开发角色。它不继承 `development` 角色里的 Superpowers、gstack、BMAD 或 AIRules 第一方开发编排；AIRules 负责选择该 role、叠加 `roles/common/` 的会话沉淀/记忆/反思能力，并在 ECC 没有 native target 的宿主上提供 fallback 投影。

角色清单见：

- `roles/ecc-development/constants/skills.ts`

## 接入方式

- 主编排来源：[`affaan-m/ECC`](https://github.com/affaan-m/ECC)
- 原生宿主：同步时调用官方 installer，命令形态为 `npx -y --package ecc-universal ecc install --profile <profile> --target <target>`；Codex / Claude / Cursor 使用 `--profile core`，OpenCode 使用 ECC 官方 `opencode` profile。
- fallback skills：AIRules 只投影 ECC core / onboarding / retrieval 相关 skills，不再展开 ECC 仓库完整 `skills/` namespace；仅用于 Qoder 等 ECC 尚未原生支持的宿主，或 `--skip-vendors` 场景下的本地兜底。
- 公共层：选择 `ecc-development` 时仍会先叠加 `roles/common/`。

## 宿主支持

- Codex：走 ECC 官方 target `codex`，profile 使用 `core`。
- Claude：走 ECC 官方 target `claude`，profile 使用 `core`。
- Cursor：走 ECC 官方 target `cursor`，profile 使用 `core`。
- OpenCode：走 ECC 官方 target `opencode`，profile 使用 `opencode`，避免把 hooks-runtime 强行带入 OpenCode 默认配置。
- Qoder：ECC 上游未把 Qoder 列为 native target；AIRules 使用既有 `qoder` host adapter 投影 fallback skills，并继续叠加 common hook。
- 其它宿主：若 ECC 上游已有 native target，应优先补官方 installer 映射；没有 native target 时才沿用 AIRules host adapter。没有专门适配的 ECC agents/commands/hooks 不在本 role 中强行转换。

## Core-only 与按需扩展

`ecc-development` 默认只安装 ECC core 能力。不要在 role 同步阶段默认安装 `developer`、`full`、`framework-language`、`database`、`orchestration` 或语言/框架 skills。

语言与框架能力必须在目标项目内先扫描再安装：

1. 先读取项目知识库与已有规则，确认真实技术栈和约束。
2. 使用 ECC `/project-init` 或 `ecc consult` 产出 dry-run 计划。
3. 只有用户确认后，才执行 `ecc install --profile core --target <target> --with lang:*` 或 `ecc install --profile core --target <target> --with framework:*` 这类按需扩展命令。

示例：

```bash
npx -y --package ecc-universal ecc install --profile core --target codex
npx -y --package ecc-universal ecc consult "typescript vue project onboarding" --target codex
npx -y --package ecc-universal ecc install --profile core --target codex --with lang:typescript --with framework:vue
```

OpenCode 继续使用 `--profile opencode --target opencode`，如需额外语言/框架能力，同样先 dry-run 或 consult，再按 `--with lang:*` / `--with framework:*` 显式扩展。

## 知识库检索规则

选择 `ecc-development` 时会投影 `roles/ecc-development/rules/AGENTS.md`。该规则要求 agent 在执行 ECC onboarding、语言识别或实现任务前，先检索项目内知识库与规格事实源，再决定是否需要 ECC 语言/框架扩展。

## OpenSpec 跟踪

ECC 的 OpenSpec 生命周期扩展仍作为上游工作项跟踪，不在本 role 中伪装成已稳定落地能力：

- Issue: [`affaan-m/ECC#2283`](https://github.com/affaan-m/ECC/issues/2283)
- PR: [`affaan-m/ECC#2318`](https://github.com/affaan-m/ECC/pull/2318)

2026-07-06 复核状态：issue open；PR open、未合并、非 draft、mergeable state 为 `clean`。PR 合并前，`ecc-development` 只接入 ECC 稳定 skills/CLI 表面；OpenSpec ecosystem 不作为默认公司流程强依赖。
