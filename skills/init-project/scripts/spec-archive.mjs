#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { countDeltaSpecs } from './spec-content.mjs'

// 第一方 spec 归档：把 change 的 delta spec 合并进 .airules/specs/，再归档 change 目录。
// 确定性逻辑复刻自 OpenSpec（src/core/specs-apply.ts + requirement-blocks.ts），零外部依赖。
// 应用顺序 RENAMED → REMOVED → MODIFIED → ADDED，冲突硬失败、两阶段（全构建+校验后才写盘）。
// 前置门禁：默认要求 ≥1 delta（--allow-empty 例外），delta 格式合法。
// proposal 内容由 .airules/requirements/<id>.md 承载；tasks 由 .airules/tasks/<id>.md 承载，
// 不再在 changes/ 目录内维护，archive 不检查两者。

const DELTA_SECTION_RE = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/i
const REQUIREMENT_RE = /^###\s*Requirement:(.+)$/i
const SCENARIO_RE = /^####\s+/
const SHALL_MUST_RE = /\b(SHALL|MUST)\b/

/** 把文本按顶层 ## 段切块，返回 [{title, lines}]。 */
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

/** 把一段文本按 ### Requirement: 切成块，返回 [{name, raw}]（raw 含 header 行）。 */
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
  return blocks.map(b => ({ name: b.name, raw: b.raw.join('\n').replace(/\n+$/, '') }))
}

/** 解析 delta spec 文件 → {added:[], modified:[], removed:[names], renamed:[{from,to}]}。 */
function parseDeltaSpec(content) {
  const plan = { added: [], modified: [], removed: [], renamed: [] }
  for (const sec of splitTopSections(content)) {
    const m = sec.heading.match(DELTA_SECTION_RE)
    if (!m) {
      continue
    }
    const kind = m[1].toUpperCase()
    if (kind === 'ADDED') {
      plan.added.push(...splitRequirementBlocks(sec.body))
    }
    else if (kind === 'MODIFIED') {
      plan.modified.push(...splitRequirementBlocks(sec.body))
    }
    else if (kind === 'REMOVED') {
      for (const b of splitRequirementBlocks(sec.body)) {
        plan.removed.push(b.name)
      }
      // 也支持 `- \`### Requirement: Name\`` 这种 bullet 写法
      for (const rawLine of sec.body) {
        const line = rawLine.trim().replace(/^-\s*/, '').replace(/`/g, '')
        const bm = line.match(/^###\s*Requirement:(.+)$/i)
        if (bm && !plan.removed.includes(bm[1].trim())) {
          plan.removed.push(bm[1].trim())
        }
      }
    }
    else if (kind === 'RENAMED') {
      let from = null
      for (const rawLine of sec.body) {
        const line = rawLine.trim().replace(/^-\s*/, '').replace(/`/g, '')
        const fm = line.match(/^FROM:\s*###\s*Requirement:(.+)$/i)
        const tm = line.match(/^TO:\s*###\s*Requirement:(.+)$/i)
        if (fm) {
          from = fm[1].trim()
        }
        else if (tm && from) {
          plan.renamed.push({ from, to: tm[1].trim() })
          from = null
        }
      }
    }
  }
  return plan
}

/** 从主 spec 提取 ## Requirements 段的 [{name, raw}] 块，及段前 preamble、段后尾部。 */
function extractMainRequirements(content) {
  const text = content.replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const reqHeadingIdx = lines.findIndex(l => /^##\s+Requirements\s*$/i.test(l))
  if (reqHeadingIdx === -1) {
    return null
  }
  // Requirements 段从 reqHeadingIdx+1 到下一个顶层 ## 或文件尾
  let endIdx = lines.length
  for (let i = reqHeadingIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]) && !lines[i].startsWith('###')) {
      endIdx = i
      break
    }
  }
  const preamble = lines.slice(0, reqHeadingIdx + 1).join('\n')
  const reqLines = lines.slice(reqHeadingIdx + 1, endIdx)
  const tail = lines.slice(endIdx).join('\n')
  const blocks = splitRequirementBlocks(reqLines)
  return { preamble, blocks, tail }
}

function skeletonSpec(capability, changeId) {
  return `# ${capability} Specification\n\n## Purpose\nTBD - created by archiving change ${changeId}. Update Purpose after archive.\n\n## Requirements\n`
}

/** 校验 delta plan 自洽（重名/跨段冲突/空操作），冲突 throw。 */
function validatePlan(plan, capability) {
  const dupCheck = (arr, label) => {
    const seen = new Set()
    for (const n of arr) {
      if (seen.has(n)) {
        throw new Error(`[${capability}] ${label} 重复 requirement：${n}`)
      }
      seen.add(n)
    }
  }
  const addedNames = plan.added.map(b => b.name)
  const modNames = plan.modified.map(b => b.name)
  dupCheck(addedNames, 'ADDED')
  dupCheck(modNames, 'MODIFIED')
  dupCheck(plan.removed, 'REMOVED')
  dupCheck(plan.renamed.map(r => r.from), 'RENAMED FROM')
  dupCheck(plan.renamed.map(r => r.to), 'RENAMED TO')
  const inter = (a, b) => a.filter(x => b.includes(x))
  for (const [pair, label] of [[inter(modNames, plan.removed), 'MODIFIED+REMOVED'], [inter(modNames, addedNames), 'MODIFIED+ADDED'], [inter(addedNames, plan.removed), 'ADDED+REMOVED']]) {
    if (pair.length > 0) {
      throw new Error(`[${capability}] 跨段冲突 ${label}：${pair.join(', ')}`)
    }
  }
  // ADDED/MODIFIED 必须有 SHALL/MUST 正文 + ≥1 Scenario
  for (const b of [...plan.added, ...plan.modified]) {
    const body = b.raw.split('\n').slice(1).join('\n')
    if (!SHALL_MUST_RE.test(body)) {
      throw new Error(`[${capability}] requirement「${b.name}」正文缺少 SHALL/MUST`)
    }
    if (!b.raw.split('\n').some(l => SCENARIO_RE.test(l))) {
      throw new Error(`[${capability}] requirement「${b.name}」缺少 #### Scenario`)
    }
  }
  if (plan.added.length + plan.modified.length + plan.removed.length + plan.renamed.length === 0) {
    throw new Error(`[${capability}] delta 无任何操作`)
  }
}

/** 把 delta 合并进主 spec 内容，返回新内容；冲突 throw。新 spec 仅允许 ADDED。 */
function buildUpdatedSpec(mainContent, plan, capability, changeId) {
  validatePlan(plan, capability)
  const isNew = mainContent === null
  if (isNew) {
    if (plan.modified.length > 0 || plan.renamed.length > 0) {
      throw new Error(`[${capability}] 新 capability 无主 spec，只允许 ADDED（不能 MODIFIED/RENAMED）`)
    }
    mainContent = skeletonSpec(capability, changeId)
  }
  const extracted = extractMainRequirements(mainContent)
  if (!extracted) {
    throw new Error(`[${capability}] 主 spec 缺少 ## Requirements 段，无法合并`)
  }
  // 用 Map 保序索引（trimmed name）
  const order = extracted.blocks.map(b => b.name)
  const byName = new Map(extracted.blocks.map(b => [b.name, b.raw]))

  // RENAMED
  for (const { from, to } of plan.renamed) {
    if (!byName.has(from)) {
      throw new Error(`[${capability}] RENAMED FROM 未找到：${from}`)
    }
    if (byName.has(to)) {
      throw new Error(`[${capability}] RENAMED TO 已存在：${to}`)
    }
    const raw = byName.get(from)
    // 仅替换首行 header（raw 是多行，REQUIREMENT_RE 无 m flag 不能直接 replace 整串）。
    const rawLines = raw.split('\n')
    rawLines[0] = `### Requirement: ${to}`
    byName.delete(from)
    byName.set(to, rawLines.join('\n'))
    order[order.indexOf(from)] = to
  }
  // REMOVED
  for (const name of plan.removed) {
    if (!byName.has(name)) {
      if (isNew) {
        continue
      }
      throw new Error(`[${capability}] REMOVED 未找到：${name}`)
    }
    byName.delete(name)
    order.splice(order.indexOf(name), 1)
  }
  // MODIFIED（整块替换）
  for (const b of plan.modified) {
    if (!byName.has(b.name)) {
      throw new Error(`[${capability}] MODIFIED 未找到：${b.name}`)
    }
    byName.set(b.name, b.raw)
  }
  // ADDED（末尾追加）
  for (const b of plan.added) {
    if (byName.has(b.name)) {
      throw new Error(`[${capability}] ADDED 已存在：${b.name}`)
    }
    byName.set(b.name, b.raw)
    order.push(b.name)
  }

  const reqBody = order.map(n => byName.get(n)).join('\n\n')
  const out = `${extracted.preamble}\n${reqBody}\n${extracted.tail ? `\n${extracted.tail}` : ''}`
  return out.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n')
}

function today() {
  return new Date().toISOString().split('T')[0]
}

function main() {
  const rawArgs = process.argv.slice(2)
  const allowEmpty = rawArgs.includes('--allow-empty')
  const [projectRootArg, changeId] = rawArgs.filter(a => !a.startsWith('--'))
  if (!projectRootArg || !changeId) {
    throw new Error('Usage: spec-archive.mjs <project-root> <change-id> [--allow-empty]')
  }
  const projectRoot = path.resolve(projectRootArg)
  const changeDir = path.join(projectRoot, '.airules', 'changes', changeId)
  const specsRoot = path.join(projectRoot, '.airules', 'specs')
  const changeSpecsDir = path.join(changeDir, 'specs')

  if (!existsSync(changeDir)) {
    throw new Error(`change 不存在：${path.relative(projectRoot, changeDir).replace(/\\/g, '/')}`)
  }

  // 前置门禁：delta 存在（--allow-empty 例外）。
  // proposal/tasks 门禁已移除——由流程门禁（主代理基于阶段证据负责）在外部保障。
  const gateErrors = []
  if (!allowEmpty && countDeltaSpecs(changeDir) === 0) {
    gateErrors.push('无 delta spec；如确为纯文档/纯流程变更，加 --allow-empty')
  }
  if (gateErrors.length > 0) {
    for (const e of gateErrors) {
      console.log(`FAIL ${e}`)
    }
    console.log(`────────────────────────────\nFAIL spec archive 前置条件未满足：${gateErrors.length} 个问题`)
    process.exitCode = 1
    return
  }

  // 收集 delta spec：changes/<id>/specs/<capability>/spec.md
  const prepared = []
  if (existsSync(changeSpecsDir)) {
    for (const cap of readdirSync(changeSpecsDir, { withFileTypes: true })) {
      if (!cap.isDirectory()) {
        continue
      }
      const deltaPath = path.join(changeSpecsDir, cap.name, 'spec.md')
      if (!existsSync(deltaPath)) {
        continue
      }
      const plan = parseDeltaSpec(readFileSync(deltaPath, 'utf8'))
      const mainPath = path.join(specsRoot, cap.name, 'spec.md')
      const mainContent = existsSync(mainPath) ? readFileSync(mainPath, 'utf8') : null
      // 两阶段：先全部构建+校验
      const updated = buildUpdatedSpec(mainContent, plan, cap.name, changeId)
      prepared.push({ mainPath, updated, capability: cap.name })
    }
  }

  // 全部构建成功后才写盘
  for (const p of prepared) {
    mkdirSyncSafe(path.dirname(p.mainPath))
    writeFileSync(p.mainPath, p.updated, 'utf8')
  }

  // 归档：移动 change 目录到 archive/<date>-<id>/
  const archiveDir = path.join(projectRoot, '.airules', 'changes', 'archive', `${today()}-${changeId}`)
  if (existsSync(archiveDir)) {
    throw new Error(`归档目标已存在：${path.relative(projectRoot, archiveDir).replace(/\\/g, '/')}`)
  }
  mkdirSyncSafe(path.dirname(archiveDir))
  renameSync(changeDir, archiveDir)

  const merged = prepared.map(p => p.capability).join(', ') || '(无 delta spec)'
  console.log(`[airules] 已合并 delta 到 .airules/specs/：${merged}`)
  console.log(`[airules] 已归档：${path.relative(projectRoot, archiveDir).replace(/\\/g, '/')}`)
}

function mkdirSyncSafe(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

main()
