#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// 在 .airules/changes/<change-id>/specs/ 建立新变更的 delta spec 骨架目录。
// proposal 内容由 brainstorming 落盘到 .airules/requirements/<id>.md 的"契约影响摘要"节；
// tasks 由 writing-plans 落盘到 .airules/tasks/<id>.md，通过 change-id 字段关联。
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

console.log(`[airules] 已建立变更骨架：${path.relative(projectRoot, changeDir).replace(/\\/g, '/')}`)
console.log('[airules] 下一步：')
console.log('  1. 在 .airules/requirements/<id>.md 的"## 契约影响摘要"节填写变更类型与涉及契约')
console.log('  2. 在 .airules/tasks/<id>.md 填写实现计划（change-id 字段引用本 change-id）')
console.log('  3. 在 specs/<capability>/spec.md 写 delta（## ADDED/MODIFIED/REMOVED Requirements）')
