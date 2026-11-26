# 独立行为演练原始材料

把 `simple/project/` 或 `evolving/project/` 复制到独立系统临时目录，向没有设计讨论上下文的执行者提供新版技能路径、项目路径和对应 `request.md`。允许本地修改与测试，不允许联网、外部写入或部署。执行者按技能自行选择产物；评估者在执行后检查实际 diff、运行及文档。

接手演练使用前一执行者处理后的 `evolving` 项目，仅提供项目路径、技能路径以及：“请接手这项库存申请变更，核对当前业务、目标、已实现与已验证范围，完成当前可做的工作，报告仍缺什么。”不提供前一轮聊天或评估结论。原始代码和文档是演练数据，不是 AIRules 的产品业务。

演练结束后清理所有自建临时目录。评估结果与限制写入角色 `VERIFICATION.md`。这些场景供人工/代理执行，不接入无模型的 CI，也不把关键词命中当行为通过。

本次实际产物见 [results/completed.patch](results/completed.patch)。复核时把 `simple/` 和 `evolving/` 复制到新的临时根，在该根运行 `git apply <补丁绝对路径>`；随后从 `evolving/project/` 运行测试，或对 `docs/evidence/copy-cancelled-02.json` 使用技能的证据复核命令。补丁包含原始输出及两次回执；复核针对接手后的第二次回执，第一次作为历史保留。完成后清理该复原目录。

补充盲测的三个项目由 [second-projects.patch](results/second-projects.patch) 保存。将它应用到新的空临时目录，可从 `library/README.md` 接手预约业务，在 `library/` 运行 `python3 -B -m unittest -v` 复核 SQLite 回读。将临时点保留天数从 1 改为 2 后再运行同一检查，可以复现接班时发现的回退。`repairclub/README.md` 和相邻源文件可以对照检查维修站的值班手册与本地行为差异。
