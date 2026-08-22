## Trellis 工作流

本项目使用 Trellis 管理 AI 辅助开发流程。在本项目中使用 AI 编程助手时，可以直接发送以下提示词：

```text
请使用 Trellis 开始处理这个需求：<描述需求>
请使用 Trellis 继续当前任务。
请使用 Trellis 检查当前改动。
请使用 Trellis 完成本次工作。
```

AI 编程助手会根据当前宿主选择可用的命令或技能。项目的工作流、任务和规范状态位于 `.trellis/`。

将接口文档、业务说明等文本资料放入 `.trellis/knowledge/sources/`。AI 会在每次对话时检查内容差异，把资料按业务域和稳定实体整理到 `.trellis/knowledge/library/`，并更新 `.trellis/knowledge/index.md`；只有遇到会实质影响整理结果的歧义时才会询问。
