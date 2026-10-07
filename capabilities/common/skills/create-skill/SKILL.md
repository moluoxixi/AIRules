---
name: create-skill
description: Create or revise reusable agent skills with a standards-compliant SKILL.md, focused instructions, and optional scripts, references, assets, or UI metadata. Use when creating, scaffolding, restructuring, or validating a skill.
---

# Create Skill

创建或更新一个自包含、可发现且可验证的 skill。

## 工作流

### 1. 明确使用方式

收集能够代表真实用法的用户请求，确认：

- skill 要完成的任务和不处理的边界；
- 哪些请求应触发它；
- 预期产物和验收方式；
- skill 的目标目录。用户未指定时，存在项目上下文则使用项目根目录下的 `.agents/skills`；没有项目上下文时使用 `~/.agents/skills`。

只有会显著改变实现方向的信息缺失时才向用户追问。完成本步时，至少应有两个具体使用示例和明确的目标目录。

### 2. 规划可复用内容

逐个分析使用示例，识别每次执行都会重复获取或重写的内容：

- `SKILL.md`：必需，保存核心工作流和必要规则；
- `scripts/`：保存需要确定性执行或反复编写的程序；
- `references/`：保存仅在特定分支需要加载的详细资料；
- `assets/`：保存会被复制、转换或嵌入最终产物的文件；
- `agents/openai.yaml`：宿主支持时，用于展示名称、简短说明和默认提示词。

只创建任务实际需要的资源。不要添加 `README.md`、`CHANGELOG.md`、安装指南或其它过程性文档。

### 3. 命名并初始化

使用小写字母、数字和连字符命名，名称不超过 64 个字符，并让目录名与 frontmatter 的 `name` 完全一致。优先使用简短、以动词开头的名称。

如果当前环境提供 `skill-creator` 的初始化脚本，先查看其 `--help`，再用它创建结构：

```bash
python <skill-creator-dir>/scripts/init_skill.py <skill-name> --path <parent-directory> [--resources scripts,references,assets]
```

若该脚本不可用，手动创建目录和必需的 `SKILL.md`。不要为了填满模板而创建空目录或占位文件。

### 4. 编写 frontmatter

让 `SKILL.md` 以 YAML frontmatter 开头，并只写 `name` 和 `description`：

```yaml
---
name: <skill-name>
description: <skill 做什么>. Use when <应触发该 skill 的具体请求或场景>.
---
```

把所有触发条件写进 `description`，因为正文只会在 skill 被触发后加载。避免只写抽象摘要，也不要在正文另设“何时使用”章节。

### 5. 编写执行说明

使用祈使句组织代理实际要执行的步骤，并为关键步骤写出可检查的完成条件。正文应：

- 只保留会改变代理行为且无法从环境直接查到的信息；
- 先写所有任务分支都会执行的主流程；
- 把特定分支的细节放入 `references/`，并在 `SKILL.md` 中明确何时读取；
- 让引用文件与 `SKILL.md` 最多相隔一层，长引用文件提供目录；
- 让命令和路径可参数化，不嵌入无关仓库的目录布局或分发机制；
- 将 `SKILL.md` 控制在 500 行以内，并确保同一规则只有一个权威来源。

脚本必须说明输入、输出和调用方式；复杂或易错的操作优先固化为脚本，而不是在正文重复生成代码。

### 6. 验证

如果当前环境提供 `skill-creator` 的校验脚本，运行：

```bash
python <skill-creator-dir>/scripts/quick_validate.py <path-to-skill>
```

随后完成以下检查：

- frontmatter 可解析，且 `name` 与目录名一致；
- `description` 同时说明能力与触发场景；
- 所有正文链接和资源路径有效；
- 每个新增脚本至少执行一个代表性用例；
- 没有未使用的目录、占位内容或重复文档；
- 用一个真实请求试运行复杂 skill，并根据结果收紧说明。

完成条件是结构校验通过、资源可用，并且真实请求可以仅依赖该 skill 的内容走完整个工作流。
