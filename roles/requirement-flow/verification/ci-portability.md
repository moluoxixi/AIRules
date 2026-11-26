# 跨平台 CI 修复记录

2026-11-27，`922de10` 的 [Publish package](https://github.com/moluoxixi/AIRules/actions/runs/45859890509) 成功发布 `0.2.29`；[CI](https://github.com/moluoxixi/AIRules/actions/runs/45859890452) 的其他六项作业成功，但 Windows、macOS 安装作业失败，未将整条 CI 计为通过。

## 已定位并修复的 Windows 问题

- Git 检出将补丁及其冻结源夹具转成 CRLF，`git apply` 无法装配样例。角色内明确的文本扩展统一使用 LF；原始输出、JPEG 和 ZIP 保持原字节，使检出源码和证据输入一致。
- 阅读器测试夹具按宿主默认换行写入，却断言原始 LF 文本。改为 UTF-8 原字节写入，保留原有断言。
- 相对 `CODEX_HOME` 测试假定系统临时目录与检出目录在同一盘。改为在夹具内部的调用目录计算相对路径，RPC 仍指向另一项目目录，执行后恢复原 cwd。

本机阅读器 22 项、Ponytail 16 项回归通过。真实 Git `core.autocrlf=true` 的检出仿真保持 95 个正式角色源文件字节一致，样例准备器成功装配 25 文件；另有一份既有忽略缓存参与仿真，不属于分发源。此为 macOS 的 Git 换行仿真，不替代 Windows CI。

## macOS 超时的诊断边界

首轮阅读器子进程在 60 秒时被终止，原日志只有七个进度点，无法确认具体挂起位置或根因。本机回归未复现。保留原超时、断言和全部测试，增加逐项测试输出及每 30 秒的 faulthandler 线程堆栈。第二轮 `cf265ec` 的 [CI](https://github.com/moluoxixi/AIRules/actions/runs/45863320703) 中 Windows 与其他六项作业成功，macOS 安装测试再次超时；Vitest 将子进程 stderr 截成字节摘要，无法读到堆栈。随后补齐异常时的 stdout/stderr 原文输出并仍抛出原错误；不将这些诊断增强描述为已证明修复了某个生产缺陷。

跨平台修复提交前的本地结果见[历史执行回执](ci-portability-check.json)及[原始输出](ci-portability-check.json.output.txt)；后续诊断输出补充的本地结果见[执行回执](ci-diagnostics-check.json)及[原始输出](ci-diagnostics-check.json.output.txt)。新提交的跨平台最终状态应以对应 GitHub Actions run 为准；此记录保留首轮失败和修复依据，不预先声称新 CI 通过。
