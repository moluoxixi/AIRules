#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// 在 .airules/changes/<change-id>/ 建立一个新变更的骨架文件（proposal/tasks）。
// AI 随后填写内容；delta spec 由 AI 在 specs/<capability>/spec.md 写。
// change-id 已存在则报错，避免覆盖。

const [projectRootArg, changeId] = process.argv.slice(2)

if (!projectRootArg || !changeId) {
  throw new Error('Usage: spec-new-change.mjs <project-root> <change-id>')
}

if (!/^[a-z0-9][a-z0-9-]*$/.test(changeId)) {
  throw new Error(`change-id 必须是小写字母数字与连字符：${changeId}`)
}

const projectRoot = path.resolve(projectRootArg)
const changeDir = path.join(projectRoot, '.airules', 'changes', changeId)

if (existsSync(changeDir)) {
  throw new Error(`change 已存在：${path.relative(projectRoot, changeDir).replace(/\\/g, '/')}；换 id 或先归档。`)
}

mkdirSync(path.join(changeDir, 'specs'), { recursive: true })

const proposalTemplate = `## Why

<!-- 1-2 句：要解决什么问题、为什么现在做。本节必填。 -->

## What Changes

<!-- 变更点列表。破坏性变更标 **BREAKING**。本节必填且非空。 -->

-

## Impact

<!-- 受影响的代码、接口、依赖、系统 -->
`

const tasksTemplate = `## 1. <任务组>

- [ ] 1.1 <可执行任务>
- [ ] 1.2 <可执行任务>
`

writeFileSync(path.join(changeDir, 'proposal.md'), proposalTemplate, 'utf8')
writeFileSync(path.join(changeDir, 'tasks.md'), tasksTemplate, 'utf8')

console.log(`[airules] 已建立变更骨架：${path.relative(projectRoot, changeDir).replace(/\\/g, '/')}`)
console.log('[airules] 下一步：填写 proposal.md（Why + What Changes）、tasks.md，并在 specs/<capability>/spec.md 写 delta（## ADDED/MODIFIED/REMOVED Requirements）。')
