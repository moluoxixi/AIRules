# 优化项目迁移脚本的保留策略与 README 清理

## 目标

让 `scripts/migrate-project.mjs` 在迁移项目时保留目标目录中昂贵且无需重建的本地依赖，并在不重写 README 的前提下移除 Trellis 角色说明，避免迁移脚本丢失后续新增的项目文档内容。

## 背景

- 当前源目录任意层级的 `node_modules` 已由 `isSourceOnly()` 排除，不会复制到目标。
- 当前 `cleanTarget()` 会删除目标根 `.git` 之外的全部内容，因此目标已有的 `node_modules` 也会被删除。
- 当前 `regenerateReadmes()` 根据固定模板重写 `README.md`、`README-en.md` 和 `SKILLS_ORGANIZATION.md`，并删除 `README-zh.md`。这会丢失源 README 后续增加但模板未知的内容。
- 当前 README 的角色说明以二级标题组织，例如 ``## `trellis` ``；章节内部可能包含任意表格、代码块和更深层标题。
- 用户已确认默认保留目标根 `.git` 和 `node_modules`，并通过可重复的 `--preserve <path>` 配置额外保留路径。

## 需求

### R1：目标保留策略

- 执行迁移时默认保留目标根 `.git` 与根 `node_modules`。
- 支持重复传入 `--preserve <relative-path>`，将额外目标相对路径加入保留集合。
- 保留路径必须是目标根内的规范相对路径，不接受绝对路径、空值、`.`、`..` 或可逃逸目标根的路径。
- 保留项不得掩盖迁移脚本应写入的同名源内容；检测到保留路径与迁移输出冲突时，应在清理目标前失败并给出明确错误。
- `--dry-run` 应展示最终保留项，并保持源和目标均不变。

### R2：README 保真清理

- 不再通过固定模板生成 README，也不再删除 `README-zh.md`。
- 对源仓库根目录中名称匹配 `README*.md` 的常规 UTF-8 文件，在完成已有项目名及仓库链接替换后，仅删除 Trellis 角色对应的二级章节。
- Trellis 角色章节标题支持 `## trellis` 与 ``## `trellis` ``，匹配时忽略大小写并允许标题两侧常规空白。
- 删除范围从匹配的二级标题开始，到下一个一级或二级 ATX 标题之前；章节内三级及更深标题、表格、代码块和任意新增正文均属于该章节并一并删除。
- 除被删除的章节和既有项目名/仓库链接替换外，README 的其余文本结构应保持不变，包括换行风格和 UTF-8 BOM；代码围栏中的伪标题不得触发删除。
- `SKILLS_ORGANIZATION.md` 不属于 `README*.md`，继续按现有 Trellis 清理规则处理，不再重写模板。

### R3：兼容性与失败行为

- 保留现有 CLI 参数、环境变量优先级、源目录保护、名称替换、仓库链接替换和 Trellis 资产清理行为。
- 保留现有 `--yes` 破坏性确认和源/目标重叠、文件系统根、符号链接目标保护。
- README 缺失时正常迁移；README 不是常规 UTF-8 文件时，在清理目标前预检失败，避免生成半成品。
- 最终 Trellis 残留校验仍需覆盖实际被迁移的 Trellis 资产与引用，但不得扫描已确认保留的目标路径或根目录 `README*.md`；README 中 Trellis 角色章节之外的普通提及是允许内容。

## 验收标准

- AC1：目标已有根 `node_modules` 时，成功迁移后其内容保持不变，源仓库中的任意 `node_modules` 仍不会复制。
- AC2：多个 `--preserve` 参数可保留多个目标相对路径；非法路径和输出冲突在目标清理前失败。
- AC3：`--dry-run` 输出默认及自定义保留路径，且不修改任何目录。
- AC4：`README.md`、`README-en.md`、`README-zh.md` 及其他根 `README*.md` 中，仅 Trellis 二级章节被删除；前后未知内容完整保留。
- AC5：Trellis 章节包含三级标题、表格、代码围栏以及新增未知内容时仍能完整删除，不依赖章节内部固定文案。
- AC6：README 中章节外及代码围栏内的普通 `trellis` 单词不会被清理器误删，也不会被最终残留校验误报。
- AC7：README 的 CRLF/LF 与 UTF-8 BOM 保持不变。
- AC8：现有迁移专项测试继续通过，并新增上述默认保留、配置、安全拒绝、README 保真和复杂章节测试。

## 范围外

- 本次不实现完整 staging、原子目录切换或失败回滚机制。
- 不修改目标根 `.git` 的 remote。
- 不引入通用 Markdown AST 依赖；只实现本需求所需的 ATX 一级/二级章节边界识别。
- 不处理许可证文件内容或合规审计。

## 技术说明

- 主要实现文件：`scripts/migrate-project.mjs`。
- 专项测试沿用现有位置 `scripts/lib/__test__/migrate-project.test.ts`。
- 当前工作区已有用户改动 `.github/workflows/publish.yml`，本任务不得修改或还原该文件。
