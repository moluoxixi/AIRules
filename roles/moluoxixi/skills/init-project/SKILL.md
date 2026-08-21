---
name: init-project
description: Initialize or extend a project with the Moluoxixi workflow runtime and supported AI coding platform integrations. Use after installing the Moluoxixi AIRules role, when adding Moluoxixi to a repository, or when replacing a direct `moluoxixi init` invocation.
---

# 初始化 Moluoxixi 项目

## 前置条件

1. 尚未安装 AIRules 时，执行：

   ```bash
   npm install --global moluoxixi-ai-rules
   ```

2. 执行 `moluoxixi --version`，确认当前环境可以直接调用 `moluoxixi`。命令不存在或执行失败时，报告错误并停止；不得自动安装缺失命令，也不得使用临时包回退。

## 操作步骤

1. 确定项目根目录，并确认解析后的目录不是符号链接。
2. 根据用户要求选择宿主；请求不明确时先询问。可用宿主以 `moluoxixi init --help` 的当前输出为准。
3. 进入项目根目录并执行：

   ```bash
   cd "<项目根目录>"
   moluoxixi init --<宿主> --yes
   ```

4. 仅在用户明确要求时添加其他参数。覆盖现有文件需要用户明确授权后添加 `--force`；保留现有文件时添加 `--skip-existing`。
5. 确认命令成功退出、`.moluoxixi/workflow.md` 已生成，并确认目标宿主的集成目录已生成。报告保留或跳过的文件。
