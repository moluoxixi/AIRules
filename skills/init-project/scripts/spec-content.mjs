#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// spec-workflow 内容门禁的共享纯函数（零依赖）：校验 proposal/tasks 的最小内容、
// 统计 delta spec 数量。被 spec-validate.mjs 与 spec-archive.mjs 复用。

/** 去掉 HTML 注释后的文本。 */
function stripHtmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

/** 取某个顶层 `## <name>` 段的正文（到下一个顶层 ## 或文件尾），去注释。 */
function sectionBody(content, name) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const startIdx = lines.findIndex(l => new RegExp(`^##\\s+${name}\\s*$`, 'i').test(l))
  if (startIdx === -1) {
    return null
  }
  let endIdx = lines.length
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) && !lines[i].startsWith('###')) {
      endIdx = i
      break
    }
  }
  return stripHtmlComments(lines.slice(startIdx + 1, endIdx).join('\n'))
}

/** 判定一段正文去掉注释、空 bullet（裸 `-`）与空白后是否还有实质内容。 */
function hasMeaningfulContent(body) {
  if (body === null) {
    return false
  }
  const meaningful = body
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && l !== '-' && l !== '*')
  return meaningful.length > 0
}

/**
 * 校验 proposal.md：存在；`## Why` 与 `## What Changes` 去注释/空 bullet 后非空。
 * 返回 { ok, errors:[] }。
 */
export function validateProposal(changeDir) {
  const errors = []
  const proposalPath = path.join(changeDir, 'proposal.md')
  if (!existsSync(proposalPath)) {
    return { ok: false, errors: ['proposal.md 不存在'] }
  }
  const content = readFileSync(proposalPath, 'utf8')
  if (!hasMeaningfulContent(sectionBody(content, 'Why'))) {
    errors.push('proposal.md 的 ## Why 为空')
  }
  if (!hasMeaningfulContent(sectionBody(content, 'What Changes'))) {
    errors.push('proposal.md 的 ## What Changes 为空')
  }
  return { ok: errors.length === 0, errors }
}

/**
 * 校验 tasks.md：存在且至少 1 个复选框任务（`- [ ]` 或 `- [x]`）。
 * 返回 { ok, errors:[], total, done, allDone }。
 */
export function validateTasks(changeDir) {
  const errors = []
  const tasksPath = path.join(changeDir, 'tasks.md')
  if (!existsSync(tasksPath)) {
    return { ok: false, errors: ['tasks.md 不存在'], total: 0, done: 0, allDone: false }
  }
  const content = readFileSync(tasksPath, 'utf8')
  const checkboxes = [...content.matchAll(/^\s*-\s*\[([ x])\]/gim)]
  const total = checkboxes.length
  const done = checkboxes.filter(m => m[1].toLowerCase() === 'x').length
  if (total === 0) {
    errors.push('tasks.md 无任何复选框任务')
  }
  return { ok: errors.length === 0, errors, total, done, allDone: total > 0 && done === total }
}

/** 统计 change 下 specs/<capability>/spec.md 的 delta 文件数。 */
export function countDeltaSpecs(changeDir) {
  const specsDir = path.join(changeDir, 'specs')
  if (!existsSync(specsDir)) {
    return 0
  }
  let count = 0
  for (const cap of readdirSync(specsDir, { withFileTypes: true })) {
    if (cap.isDirectory() && existsSync(path.join(specsDir, cap.name, 'spec.md'))) {
      count++
    }
  }
  return count
}
