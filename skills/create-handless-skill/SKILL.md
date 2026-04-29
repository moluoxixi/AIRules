---
name: headless-skill-architect
version: 2.0.0
description: 逻辑驱动型 Skill 架构协议：强制将业务需求解耦为“状态机+数据契约”的无头架构，消除 AI 执行中的随机性与幻觉。
---

# Skill: Headless Skill Architect

## 🛡️ Global Protocol: Logic-Core Primacy
**【最高准则】逻辑与表现分离 (Separation of Logic and Presentation)：**
- **严禁描述语气**：禁止在输出的 Skill 中使用“友好地”、“请”或“详细地”等感性修饰词。
- **协议化输出**：所有指令必须定义为“触发 -> 判定 -> 执行 -> 产出”的原子逻辑。
- **状态持久化**：必须设计物理状态文件（如 JSON）作为“唯一事实来源”，而非依赖 AI 上下文记忆。

## ⚙️ Phase 0: Readiness & Probes (环境探针)
在定义任何业务逻辑前，必须在生成的 Skill 中注入环境检查：
1. **工具可用性断言**：显式检查所需的 MCP 工具（如 Playwright, FileSystem）是否就绪。
2. **沙箱重置**：定义任务启动前的目录清理与物理环境初始化逻辑。

## 契约定义：Data Contract (I/O)
生成的 Skill 必须包含明确的数据交换契约：
- **Input**: 明确定义前置阶段传递的参数或文件。
- **Execution**: 核心状态机逻辑。
- **Output**: 强制落盘的文件格式（Schema）与路径。

## 🔄 Execution Pipeline (State Machine)
将业务流程拆解为受控的状态迁移，每一步必须包含：
- **Logic Gates (护栏)**：进入该阶段的前提条件（Pre-check）。
- **In-process Guard**：执行中的异常拦截（例如：若 DOM 结构不匹配，立即熔断）。
- **Terminal State**：阶段完成的判定标准，严禁模糊结束。

## 🩹 Recovery & Persistence (热启动协议)
所有 Headless Skill 必须内置“断点续传”能力：
- **状态落盘**：每批次任务完成后，强制更新本地 `_state.json` 或 `_queue.json`。
- **回溯逻辑**：启动时优先读取状态文件，若存在 `pending` 任务，则自动跳过已完成部分。

## 📏 Output Template (输出模板规范)
生成的 `SKILL.md` 结构强制如下：

```markdown
# [Skill Name] (Logic-Core)

## 1. Environment Guard (物理探针)
- 依赖项校验...
- 目录重置协议...

## 2. Pipeline Architecture (状态机)
### Phase N: [Name]
- **Input**: ...
- **Action**: ...
- **Assertion/Guard**: ...
- **Terminal Output**: ...

## 3. Recovery Protocol (自愈协议)
- 状态读取逻辑...
- 异常熔断处理...
```

## ⚠️ Anti-Hallucination Guardrail
- **禁止补全**：若网页或源码中缺失预期字段（如缺失 `v-model` 说明），严禁基于先验知识捏造，必须输出 `N/A` 或标记缺失。

- **物理隔离**：在同步文档等任务中，强制禁止读取本地无关代码库，保持上下文纯净。