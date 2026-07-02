#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// 在用户项目根建立 .qoder/repowiki/wiki_plan.yaml。
// 让 Qoder wiki 生成时能感知 .airules/knowledge/ 知识库，作为背景事实源。
// 幂等：已存在则跳过，不覆盖团队已维护的配置。
// 若目标项目已存在 .qoder，则把用户根目录 .qoder/AGENTS.md 覆盖注入到项目 .qoder/rules/AGENTS.md。

const projectRoot = path.resolve(process.argv[2] ?? process.cwd())
const qoderDir = path.join(projectRoot, '.qoder')
const wikiPlanDir = path.join(projectRoot, '.qoder', 'repowiki')
const wikiPlanPath = path.join(wikiPlanDir, 'wiki_plan.yaml')
const KNOWLEDGE_INCLUDE = '.airules/knowledge/**'
const AIRULES_NOTE_TEXT = '项目知识库位于 .airules/knowledge/，生成 Wiki 时必须将 .airules/knowledge/ 的内容写入'

if (existsSync(qoderDir)) {
  const userHome = process.env.AIRULES_TEST_HOME
    ? path.resolve(process.env.AIRULES_TEST_HOME)
    : os.homedir()
  const globalAgentsPath = path.join(userHome, '.qoder', 'AGENTS.md')
  const projectRulesDir = path.join(qoderDir, 'rules')
  const projectRulesPath = path.join(projectRulesDir, 'AGENTS.md')

  if (existsSync(globalAgentsPath)) {
    mkdirSync(projectRulesDir, { recursive: true })
    copyFileSync(globalAgentsPath, projectRulesPath)
    console.log('[airules] 已覆盖注入 .qoder/rules/AGENTS.md')
  }
  else {
    console.warn('[airules] 用户根目录 .qoder/AGENTS.md 不存在，跳过 .qoder/rules 注入')
  }
}

function lineIndent(line) {
  return line.match(/^\s*/)?.[0] ?? ''
}

function appendRepowikiBlock(content, block) {
  return `${content.trimEnd()}${content.trim().length > 0 ? '\n\n' : ''}${block}\n`
}

function findSectionEnd(lines, startIndex, parentIndentLength) {
  for (let index = startIndex + 1; index < lines.length; index++) {
    const line = lines[index]
    if (line.trim().length === 0) {
      continue
    }

    if (lineIndent(line).length <= parentIndentLength) {
      return index
    }
  }

  return lines.length
}

function findKeyLine(lines, key, startIndex, endIndex, indentLength) {
  const expectedPrefix = `${' '.repeat(indentLength)}${key}:`

  for (let index = startIndex; index < endIndex; index++) {
    if (lines[index].startsWith(expectedPrefix)) {
      return index
    }
  }

  return -1
}

function ensureKnowledgeInclude(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const repowikiIndex = findKeyLine(lines, 'repowiki', 0, lines.length, 0)

  if (repowikiIndex === -1) {
    return appendRepowikiBlock(content, repowikiBlock())
  }

  const repowikiEnd = findSectionEnd(lines, repowikiIndex, 0)
  const scopeIndex = findKeyLine(lines, 'scope', repowikiIndex + 1, repowikiEnd, 2)

  if (scopeIndex === -1) {
    lines.splice(repowikiIndex + 1, 0, '  scope:', '    include:', `      - "${KNOWLEDGE_INCLUDE}"`)
    return lines.join('\n')
  }

  const scopeEnd = findSectionEnd(lines, scopeIndex, 2)
  const includeIndex = findKeyLine(lines, 'include', scopeIndex + 1, scopeEnd, 4)

  if (includeIndex === -1) {
    lines.splice(scopeIndex + 1, 0, '    include:', `      - "${KNOWLEDGE_INCLUDE}"`)
    return lines.join('\n')
  }

  const includeEnd = findSectionEnd(lines, includeIndex, 4)
  const hasKnowledgeInclude = lines
    .slice(includeIndex + 1, includeEnd)
    .some(line => line.trim().replace(/^-\s*/, '').replace(/^["']|["']$/g, '') === KNOWLEDGE_INCLUDE)

  if (!hasKnowledgeInclude) {
    lines.splice(includeEnd, 0, `      - "${KNOWLEDGE_INCLUDE}"`)
  }

  return lines.join('\n')
}

function replaceAirulesNote(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const repowikiIndex = findKeyLine(lines, 'repowiki', 0, lines.length, 0)

  if (repowikiIndex === -1) {
    return appendRepowikiBlock(content, repowikiBlock())
  }

  const repowikiEnd = findSectionEnd(lines, repowikiIndex, 0)
  const notesIndex = findKeyLine(lines, 'notes', repowikiIndex + 1, repowikiEnd, 2)

  if (notesIndex === -1) {
    lines.splice(repowikiIndex + 1, 0, '  notes:', ...airulesNoteLines())
    return lines.join('\n')
  }

  const notesEnd = findSectionEnd(lines, notesIndex, 2)
  const notes = []
  let index = notesIndex + 1

  while (index < notesEnd) {
    const line = lines[index]

    if (!line.startsWith('    - ')) {
      notes.push({ start: index, end: index + 1, hasAirulesAuthor: false })
      index++
      continue
    }

    const start = index
    index++

    while (index < notesEnd && !lines[index].startsWith('    - ')) {
      index++
    }

    notes.push({
      start,
      end: index,
      hasAirulesAuthor: lines.slice(start, index).some(noteLine => noteLine.trim() === 'author: airules'),
    })
  }

  const nextLines = [
    ...lines.slice(0, notesIndex + 1),
    ...airulesNoteLines(),
  ]

  for (const note of notes) {
    if (!note.hasAirulesAuthor) {
      nextLines.push(...lines.slice(note.start, note.end))
    }
  }

  nextLines.push(...lines.slice(notesEnd))

  return nextLines.join('\n')
}

function airulesNoteLines() {
  return [
    `    - text: "${AIRULES_NOTE_TEXT}"`,
    '      author: airules',
  ]
}

function repowikiBlock() {
  return `repowiki:
  scope:
    include:
      - "${KNOWLEDGE_INCLUDE}"
  notes:
${airulesNoteLines().join('\n')}`
}

function upsertWikiPlan(content) {
  return replaceAirulesNote(ensureKnowledgeInclude(content)).trimEnd()
}

mkdirSync(wikiPlanDir, { recursive: true })

const currentWikiPlan = existsSync(wikiPlanPath)
  ? readFileSync(wikiPlanPath, 'utf8')
  : `version: 1

repowiki:
  scope:
    include:
      - "${KNOWLEDGE_INCLUDE}"
  notes:
${airulesNoteLines().join('\n')}
`

writeFileSync(wikiPlanPath, `${upsertWikiPlan(currentWikiPlan)}\n`, 'utf8')
console.log(`[airules] 已更新 ${path.relative(projectRoot, wikiPlanPath).replace(/\\/g, '/')}`)
