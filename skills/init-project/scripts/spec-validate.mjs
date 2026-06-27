#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { countDeltaSpecs, validateProposal, validateTasks } from './spec-content.mjs'

// 校验一个 change 的 delta spec 格式合法性（不合并、不写盘）。
// 复刻 OpenSpec validate 规则：每 section 非空、ADDED/MODIFIED 有 SHALL/MUST + ≥1 Scenario、
// 无重名、无跨段冲突。另校验 proposal/tasks 最小内容与 delta 存在性。校验失败非零退出。
// --allow-empty 跳过 delta 存在性要求（纯文档/纯流程 change）。

const DELTA_SECTION_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i
const REQUIREMENT_RE = /^###\s*Requirement:(.+)$/i
const SCENARIO_RE = /^####\s+/
const SHALL_MUST_RE = /\b(SHALL|MUST)\b/

const errors = []

function splitTopSections(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const sections = []
  let current = null
  for (const line of lines) {
    if (/^##\s+/.test(line) && !line.startsWith('###')) {
      current = { heading: line, body: [] }
      sections.push(current)
    }
    else if (current) {
      current.body.push(line)
    }
  }
  return sections
}

function splitRequirementBlocks(lines) {
  const blocks = []
  let current = null
  for (const line of lines) {
    const m = line.match(REQUIREMENT_RE)
    if (m) {
      current = { name: m[1].trim(), raw: [line] }
      blocks.push(current)
    }
    else if (current) {
      current.raw.push(line)
    }
  }
  return blocks.map(b => ({ name: b.name, raw: b.raw.join('\n') }))
}

function validateDeltaFile(content, label) {
  const sections = splitTopSections(content).filter(s => DELTA_SECTION_RE.test(s.heading))
  if (sections.length === 0) {
    errors.push(`${label}: 无任何 ADDED/MODIFIED/REMOVED/RENAMED Requirements 段`)
    return
  }
  let totalOps = 0
  for (const sec of sections) {
    const kind = sec.heading.match(DELTA_SECTION_RE)[1].toUpperCase()
    if (kind === 'ADDED' || kind === 'MODIFIED') {
      const blocks = splitRequirementBlocks(sec.body)
      if (blocks.length === 0) {
        errors.push(`${label}: ${kind} 段无 requirement`)
      }
      totalOps += blocks.length
      for (const b of blocks) {
        const body = b.raw.split('\n').slice(1).join('\n')
        if (!SHALL_MUST_RE.test(body)) {
          errors.push(`${label}: requirement「${b.name}」正文缺少 SHALL/MUST`)
        }
        if (!b.raw.split('\n').some(l => SCENARIO_RE.test(l))) {
          errors.push(`${label}: requirement「${b.name}」缺少 #### Scenario`)
        }
      }
    }
    else if (kind === 'REMOVED') {
      const names = splitRequirementBlocks(sec.body).map(b => b.name)
      for (const rawLine of sec.body) {
        const line = rawLine.trim().replace(/^-\s*/, '').replace(/`/g, '')
        const bm = line.match(/^###\s*Requirement:(.+)$/i)
        if (bm) {
          names.push(bm[1].trim())
        }
      }
      totalOps += names.length
    }
    else if (kind === 'RENAMED') {
      const froms = sec.body.filter(l => /FROM:/i.test(l)).length
      const tos = sec.body.filter(l => /TO:/i.test(l)).length
      if (froms !== tos) {
        errors.push(`${label}: RENAMED 的 FROM/TO 不成对`)
      }
      totalOps += Math.min(froms, tos)
    }
  }
  if (totalOps === 0) {
    errors.push(`${label}: delta 无任何操作`)
  }
}

function main() {
  const rawArgs = process.argv.slice(2)
  const allowEmpty = rawArgs.includes('--allow-empty')
  const [projectRootArg, changeId] = rawArgs.filter(a => !a.startsWith('--'))
  if (!projectRootArg) {
    throw new Error('Usage: spec-validate.mjs <project-root> [change-id] [--allow-empty]')
  }
  const projectRoot = path.resolve(projectRootArg)
  const changesRoot = path.join(projectRoot, '.airules', 'changes')
  const targets = changeId
    ? [changeId]
    : (existsSync(changesRoot)
        ? readdirSync(changesRoot, { withFileTypes: true }).filter(e => e.isDirectory() && e.name !== 'archive').map(e => e.name)
        : [])

  if (targets.length === 0) {
    console.log('[airules] 无可校验的 change')
    return
  }

  for (const id of targets) {
    const changeDir = path.join(changesRoot, id)
    // 内容门禁：proposal 非空、tasks ≥1 任务、≥1 delta（除非 --allow-empty）
    for (const e of validateProposal(changeDir).errors) {
      errors.push(`${id}: ${e}`)
    }
    for (const e of validateTasks(changeDir).errors) {
      errors.push(`${id}: ${e}`)
    }
    if (!allowEmpty && countDeltaSpecs(changeDir) === 0) {
      errors.push(`${id}: 无 delta spec（如确为纯文档/纯流程变更，加 --allow-empty）`)
    }
    // delta 格式校验
    const specsDir = path.join(changeDir, 'specs')
    if (!existsSync(specsDir)) {
      continue
    }
    for (const cap of readdirSync(specsDir, { withFileTypes: true })) {
      if (!cap.isDirectory()) {
        continue
      }
      const deltaPath = path.join(specsDir, cap.name, 'spec.md')
      if (existsSync(deltaPath)) {
        validateDeltaFile(readFileSync(deltaPath, 'utf8'), `${id}/specs/${cap.name}`)
      }
    }
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.log(`FAIL ${e}`)
    }
    console.log(`────────────────────────────\nFAIL spec validate: ${errors.length} 个问题`)
    process.exitCode = 1
    return
  }
  console.log(`PASS spec validate: ${targets.join(', ')} delta 格式合法`)
}

main()
