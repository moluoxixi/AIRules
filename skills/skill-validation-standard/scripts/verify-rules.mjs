#!/usr/bin/env node
/**
 * Skill 最小校验脚本：只检查 SKILL.md 的 YAML frontmatter 和正文结构。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REQUIRED_FIELDS = ['name', 'description']
const errors = []

function fail(message) {
  errors.push(message)
  console.log(`FAIL ${message}`)
}

function pass(message) {
  console.log(`PASS ${message}`)
}

function parseArgs(args) {
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--root') {
      index++
      continue
    }

    fail(`未知参数：${args[index]}`)
  }

  const rootIndex = args.indexOf('--root')
  const rootValue = args[rootIndex + 1]
  if (rootIndex !== -1 && (!rootValue || rootValue.startsWith('--'))) {
    fail('参数 --root 必须提供值')
    return { root: ownRoot }
  }

  const root = rootIndex === -1
    ? ownRoot
    : path.resolve(process.cwd(), rootValue)

  return { root }
}

function readSkillFile(root) {
  const skillPath = path.join(root, 'SKILL.md')
  if (!fs.existsSync(skillPath)) {
    fail('缺少 SKILL.md')
    return ''
  }

  pass('SKILL.md exists')
  return fs.readFileSync(skillPath, 'utf8').replace(/\r\n/g, '\n')
}

function splitFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    fail('SKILL.md 必须以 YAML frontmatter 开头')
    return undefined
  }

  const end = content.indexOf('\n---\n', 4)
  if (end === -1) {
    fail('SKILL.md 缺少 YAML frontmatter 结束标记')
    return undefined
  }

  pass('frontmatter markers valid')
  return {
    yaml: content.slice(4, end),
    body: content.slice(end + 5),
  }
}

function parseFrontmatter(yaml) {
  const fields = new Map()

  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separator = line.indexOf(':')
    if (separator === -1) {
      fail(`YAML 行缺少冒号：${rawLine}`)
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()

    if (!key || !value) {
      fail(`YAML 行缺少 key 或 value：${rawLine}`)
      continue
    }

    fields.set(key, value)
  }

  return fields
}

function checkRequiredFields(fields) {
  for (const field of REQUIRED_FIELDS) {
    if (!fields.get(field)) {
      fail(`frontmatter 缺少 ${field}`)
    }
  }

  if (REQUIRED_FIELDS.every(field => fields.get(field))) {
    pass('frontmatter required fields present')
  }
}

function checkBody(body) {
  const normalizedBody = body.trim()
  if (!normalizedBody) {
    fail('正文不能为空')
    return
  }

  pass('body exists')

  if (!normalizedBody.split('\n').some(line => line.trim().startsWith('#'))) {
    fail('正文必须包含 Markdown 标题')
    return
  }

  pass('body heading exists')
}

function finish(fields, root) {
  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL ${errors.length} errors`)
    process.exitCode = 1
    return
  }

  console.log('PASS skill body and YAML are valid')
  console.log(`  name: ${fields.get('name')}`)
  console.log(`  root: ${root}`)
}

function verify(root) {
  const content = readSkillFile(root)
  const parsed = content ? splitFrontmatter(content) : undefined
  const fields = parsed ? parseFrontmatter(parsed.yaml) : new Map()

  checkRequiredFields(fields)
  if (parsed) {
    checkBody(parsed.body)
  }

  finish(fields, root)
}

verify(parseArgs(process.argv.slice(2)).root)
