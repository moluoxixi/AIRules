---
name: init-project
description: 用于 trellis-development 角色在目标项目内初始化 Trellis workflow runtime、项目知识库、任务系统与宿主适配入口。
---

# Trellis Init Project

在目标项目内初始化 Trellis。Trellis 拥有 `.trellis/` workflow runtime；AIRules 本 skill 只负责安全调用 Trellis CLI，不复制 Trellis 上游模板进 AIRules，也不写宿主全局目录。

## 触发条件

- 用户明确选择 `trellis-development` 角色。
- 目标项目需要 Trellis 的任务状态机、`.trellis/spec/` 知识库、`.trellis/tasks/` 任务目录、`.trellis/workspace/` 会话记忆与多宿主适配。

## 前置检查

1. 在目标项目根运行；若不确定项目根，先用当前仓库结构确认，不猜。
2. 确认 `trellis` 命令存在；不存在则提示先运行 AIRules `trellis-development` role sync，或安装 `@mindfoldhq/trellis`。
3. 检查项目内是否已有 `.trellis/`；存在时先读取 `.trellis/config.yaml` 与 `.trellis/workflow.md`，不要覆盖用户已有 Trellis 配置。
4. 选择目标宿主 flag。只使用项目内宿主适配：`--codex`、`--claude`、`--cursor`、`--opencode`、`--gemini`、`--qoder` 等 Trellis CLI 支持的参数。

## 执行

推荐命令形态：

```bash
trellis init -u <developer-name> --codex
```

多宿主项目按实际使用面增加 flag：

```bash
trellis init -u <developer-name> --codex --cursor --claude
```

`<developer-name>` 必须来自用户明确输入、现有 `.trellis/.developer`、git user name，或项目已有约定；无法确认时询问用户。不要用占位名伪装初始化成功。

## 完成检查

- `.trellis/workflow.md` 存在。
- `.trellis/config.yaml` 存在。
- `.trellis/spec/` 存在或 Trellis CLI 明确生成了 spec bootstrap 提示。
- `.trellis/tasks/` 可由 `trellis` task 命令创建任务。
- 目标宿主目录中存在 Trellis 生成的 skills / agents / hooks / workflows 入口。

## 禁止事项

- 不写用户 home 下的宿主全局配置或资产目录；只允许写当前目标项目内由 Trellis CLI 生成的适配入口。
- 不复制 Trellis 上游 AGPL 模板、hooks、agents 或 skills 到 AIRules `roles/`。
- 不把 Trellis workspace journal 直接提升为 AIRules 正式 `knowledge/memory/`；若要沉淀到 AIRules 记忆体系，必须走候选与审核流程。
