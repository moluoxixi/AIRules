#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { assertProjectRoot } from './core/extension-transaction.mjs'

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TASK_PATH = '.trellis/tasks/00-bootstrap-guidelines/task.json'
const PRD_PATH = '.trellis/tasks/00-bootstrap-guidelines/prd.md'
const DEFAULT_TITLE = 'Bootstrap Guidelines'
const DEFAULT_DESCRIPTION = 'Fill in project development guidelines for AI agents'
const DEFAULT_PRD_HEADING = '# Bootstrap Task: Fill Project Development Guidelines'
const DEFAULT_REASON = 'Repository-wide knowledge bootstrap requires reviewed proposals'
const DEFAULT_NOTES = /^First-time setup task created by trellis init \((backend|frontend|fullstack|unknown) project\)$/u

const PROJECT_TYPE_LABELS = {
  backend: '后端项目',
  frontend: '前端项目',
  fullstack: '全栈项目',
  unknown: '未识别项目',
}

export function localizeBootstrapTask({ project, enabled = true } = {}) {
  const projectRoot = assertProjectRoot(project ?? process.cwd())
  if (!enabled) {
    return { status: 'preserved', reason: 'preexisting-task' }
  }

  const taskPath = path.join(projectRoot, ...TASK_PATH.split('/'))
  const prdPath = path.join(projectRoot, ...PRD_PATH.split('/'))
  if (!fs.statSync(taskPath, { throwIfNoEntry: false })?.isFile()
    || !fs.statSync(prdPath, { throwIfNoEntry: false })?.isFile()) {
    return { status: 'absent', reason: 'bootstrap-files-missing' }
  }

  let task
  try {
    task = JSON.parse(fs.readFileSync(taskPath, 'utf8'))
  }
  catch {
    return { status: 'preserved', reason: 'task-json-invalid' }
  }
  const prd = fs.readFileSync(prdPath, 'utf8')
  const noteMatch = typeof task.notes === 'string' ? DEFAULT_NOTES.exec(task.notes) : null
  if (task.id !== '00-bootstrap-guidelines'
    || task.name !== '00-bootstrap-guidelines'
    || task.title !== DEFAULT_TITLE
    || task.description !== DEFAULT_DESCRIPTION
    || !noteMatch
    || !prd.startsWith(DEFAULT_PRD_HEADING)) {
    return { status: 'preserved', reason: 'customized-bootstrap' }
  }

  task.title = '初始化项目规范'
  task.description = '为 AI 代理补充项目开发规范'
  task.notes = `由 trellis init 创建的首次初始化任务（${PROJECT_TYPE_LABELS[noteMatch[1]]}）`
  if (task.complexity?.reason === DEFAULT_REASON)
    task.complexity.reason = '初始化全仓库规范需要经过审查的提案'

  const targets = Array.isArray(task.relatedFiles)
    ? task.relatedFiles.filter(value => typeof value === 'string' && value.trim())
    : []
  const checklist = targets.length > 0
    ? targets.map(target => `- [ ] 补充 \`${target}\` 的真实项目规范`).join('\n')
    : '- [ ] 补充 `.trellis/spec/` 中的真实项目规范'
  const targetList = targets.length > 0
    ? targets.map(target => `- \`${target}\``).join('\n')
    : '- `.trellis/spec/`'
  const templatePath = path.join(SKILL_ROOT, 'assets', 'project-extension', 'bootstrap-prd.md')
  const localizedPrd = fs.readFileSync(templatePath, 'utf8')
    .replace('{{SPEC_CHECKLIST}}', checklist)
    .replace('{{SPEC_TARGETS}}', targetList)

  replacePair(taskPath, Buffer.from(`${JSON.stringify(task, null, 2)}\n`), prdPath, Buffer.from(localizedPrd))
  return { status: 'updated', paths: [TASK_PATH, PRD_PATH] }
}

function replacePair(firstPath, firstContent, secondPath, secondContent) {
  const nonce = `${process.pid}-${Date.now()}`
  const entries = [
    { target: firstPath, content: firstContent },
    { target: secondPath, content: secondContent },
  ]
  const journal = []
  try {
    for (const entry of entries) {
      entry.temporary = `${entry.target}.airules-new-${nonce}`
      entry.backup = `${entry.target}.airules-old-${nonce}`
      fs.writeFileSync(entry.temporary, entry.content, { flag: 'wx' })
      journal.push(entry)
      fs.renameSync(entry.target, entry.backup)
      entry.moved = true
      fs.renameSync(entry.temporary, entry.target)
      entry.installed = true
    }
  }
  catch (error) {
    for (const entry of [...journal].reverse()) {
      if (entry.installed)
        fs.rmSync(entry.target, { force: true })
      if (entry.moved && fs.existsSync(entry.backup))
        fs.renameSync(entry.backup, entry.target)
    }
    for (const entry of entries)
      fs.rmSync(entry.temporary, { force: true })
    throw new Error(`Bootstrap localization failed and was rolled back: ${String(error)}`)
  }
  for (const entry of entries)
    fs.rmSync(entry.backup, { force: true })
}

function parseProject(argv) {
  const index = argv.indexOf('--project')
  if (index === -1 || !argv[index + 1])
    throw new Error('--project requires a value')
  return argv[index + 1]
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.stdout.write(`${JSON.stringify(localizeBootstrapTask({ project: parseProject(process.argv.slice(2)) }), null, 2)}\n`)
  }
  catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
