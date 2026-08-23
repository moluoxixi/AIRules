# 初始化任务：补充项目开发规范

**你（AI）正在执行此任务，开发者通常无需直接阅读本文件。**

开发者刚刚在本项目中首次运行了 `trellis init`。`.trellis/` 已包含规范模板，
本任务用于把团队真实采用的开发约定整理到 `.trellis/spec/`。后续
`trellis-implement` 与 `trellis-check` 子代理会自动读取这些规范；规范越贴近
现有代码，生成和检查结果越符合项目实际。

## 待办

{{SPEC_CHECKLIST}}
- [ ] 为每条规范补充真实代码示例

## 目标规范目录

{{SPEC_TARGETS}}

## 整理方法

1. 优先读取仓库已有的 `AGENTS.md`、`CLAUDE.md`、Cursor/Copilot 规则、
   `CONTRIBUTING.md`、`.editorconfig` 等约定文档。
2. 使用 `trellis-spec-bootstrap` 分析代码，并为每种模式寻找 2-3 个真实示例。
3. 记录代码当前采用的做法和已知技术债，不写尚未落地的理想方案。
4. 与开发者确认整理结果；遇到无法从仓库事实判断的实质歧义时再询问。

## 完成条件

目标规范已包含可执行规则和真实路径示例，并经开发者确认。然后运行：

```bash
python ./.trellis/scripts/task.py finish
python ./.trellis/scripts/task.py archive 00-bootstrap-guidelines
```

归档后，新加入项目的开发者会收到 `00-join-<slug>` 入门任务。

## 建议开场

“Trellis 已初始化完成。我会先读取仓库现有约定和真实代码，再和你确认需要补充
到项目规范中的内容；如果关键规则无法从项目中判断，我会集中提问。”
