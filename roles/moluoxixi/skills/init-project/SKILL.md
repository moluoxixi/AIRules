---
name: init-project
description: Initialize or extend a project with the Moluoxixi workflow and AIRules-owned project extensions. Use after installing the Moluoxixi AIRules role, when adding Moluoxixi to a repository, configuring AI coding platforms, or replacing a direct moluoxixi init invocation.
---

# 初始化 Moluoxixi 项目

使用角色自带的包装器完成初始化。包装器先运行已随 AIRules 角色安装的
Moluoxixi CLI，再独立注入 AIRules 扩展；不要直接编辑或复制角色的
`packages/`。

## 操作步骤

1. 确定项目根目录，并确认解析后的目录不是符号链接。
2. 根据用户要求选择宿主；请求不明确时先询问。仅在需要核对宿主 ID 或
   输出路径时读取 [platforms.md](references/platforms.md)。
3. 执行：

   ```bash
   node "<skill-root>/scripts/run-role-cli.mjs" --project "<项目根目录>" --platform "<宿主ID>" --yes
   ```

   多个宿主使用逗号分隔，或重复传入 `--platform`。仅当用户明确要求全部
   宿主时使用 `--platform all`。
4. 仅在用户明确授权覆盖受管文件时添加 `--force`。需要开发者标识时添加
   `--developer <名称>`；其余 Moluoxixi 参数原样传递。
5. 确认 `.moluoxixi/workflow.md`、目标宿主目录以及
   `.moluoxixi/knowledge/index.md` 已生成。报告扩展摘要中的 created、updated、
   preserved 和 conflicts；退出码 `2` 表示安全内容已安装，但冲突文件被保留。
6. 读取包装器输出的 `freshInitialization`、`bootstrapTaskCreated` 和
   `bootstrapLocalization`，按下方“初始化规范治理”分支处理后再报告结果。

## 初始化规范治理

只有 `freshInitialization` 与 `bootstrapTaskCreated` 均为 `true`，且
`bootstrapLocalization.status` 为 `updated` 时，才允许自动整理。其它情况只审计
并报告 spec/task，不改写、不归档、不删除。

对可证明的首次 bootstrap：

1. 检查 Moluoxixi 生成路径之外的仓库内容，并检查生成的 spec。用户选择或修改过
   的 spec 只进入审计分支。
2. 存在真实代码或既有约定文档时，加载并遵循 `moluoxixi-spec-bootstrap`，依据仓库
   事实重塑 `.moluoxixi/spec/`。满足该 Skill 的完成条件后运行：

   ```bash
   python ./.moluoxixi/scripts/task.py archive --no-commit 00-bootstrap-guidelines
   ```

3. 仓库没有真实代码或约定依据时，重新读取生成的 task 与 spec。仅当 task 仍与本次
   本地化内容一致、spec 仍只有通用占位内容时，精确删除 `.moluoxixi/spec/` 和
   `.moluoxixi/tasks/00-bootstrap-guidelines/`。报告删除路径，并提示项目形成约定后
   运行 `moluoxixi-spec-bootstrap`。
4. 任一生成区域在 init 后发生修改，或证据存在歧义时，保留全部内容并报告差异。
   其它 task 以及上述两个精确目标之外的路径不属于清理范围。

## 知识库扩展

初始化会自动创建：

```text
.moluoxixi/knowledge/
  index.md
  relations.json
  sources/
  library/
```

用户只需把文档放进 `sources/`。Hook 只计算内容 diff 并注入索引与 pending
清单；AI 通过 `moluoxixi-knowledge` Skill 整理 `library/` 和 `index.md`，遇到
实质歧义再询问。没有可靠 Hook 的宿主使用项目 `AGENTS.md` 中的同等 fallback。

初始化还会在受管 `AGENTS.md` 块中注入临时简体中文约定：新任务标题、
`task.json` 面向人的字段以及 `prd.md`、`design.md`、`implement.md` 默认使用
简体中文；中文标题显式配套 ASCII slug。该约定位于独立的
`AIRULES:MOLUOXIXI-ZH-COMPAT` 标记内，上游提供正式汉化后只删除这个内层块。

## 边界

- `roles/moluoxixi/packages` 是外部基线，不承载 AIRules 扩展。源资产边界见
  [asset-layout.md](references/asset-layout.md)。
- 扩展只使用 `.moluoxixi/airules-init-manifest.json`，不修改上游
  `.moluoxixi/.template-hashes.json`。
- `sources/`、`library/`、`index.md`、`relations.json` 是项目数据；重复初始化和
  `--force` 都保留。
- 已存在或已修改的 spec/bootstrap task 只审计；自动治理只处理包装器可证明的
  本次首次初始化生成物。
- 扩展安装失败时回滚扩展自己的全部写入；已完成的基线 CLI 初始化保持原状。
- 命令不存在或执行失败时，报告错误并停止；不安装临时包作为回退。
