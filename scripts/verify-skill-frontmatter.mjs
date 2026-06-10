#!/usr/bin/env node
/**
 * Skill frontmatter 校验脚本：只检查单个 SKILL.md 的 YAML frontmatter。
 */
import fs from 'node:fs'
import path from 'node:path'

const ownRoot = process.cwd()
const MAX_SKILL_LINES = 500
const DESCRIPTION_TRIGGER_PATTERN = /(用于|适用于|当|在.+时|开始前|完成后|明确要求|Use when|Triggers? on|when)/i
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

function checkLineCount(content) {
  const lineCount = content.endsWith('\n')
    ? content.split('\n').length - 1
    : content.split('\n').length

  if (lineCount > MAX_SKILL_LINES) {
    fail(`SKILL.md 超过 ${MAX_SKILL_LINES} 行：${lineCount}`)
    return
  }

  pass('SKILL.md line count valid')
}

function splitFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    fail('SKILL.md 必须以 YAML frontmatter 开头')
    return undefined
  }

  const closedBeforeContent = content.indexOf('\n---\n', 4)
  const closedAtEnd = content.endsWith('\n---') ? content.length - 4 : -1
  const end = closedBeforeContent === -1 ? closedAtEnd : closedBeforeContent
  if (end === -1) {
    fail('SKILL.md 缺少 YAML frontmatter 结束标记')
    return undefined
  }

  pass('frontmatter markers valid')
  return {
    yaml: content.slice(4, end),
  }
}

function normalizeYamlScalar(value) {
  const hasSingleQuotes = value.startsWith('\'') && value.endsWith('\'')
  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"')

  return hasSingleQuotes || hasDoubleQuotes ? value.slice(1, -1) : value
}

function parseFrontmatter(yaml) {
  const fields = new Map()

  for (const rawLine of yaml.split('\n')) {
    if (rawLine.startsWith(' ') || rawLine.startsWith('\t')) {
      continue
    }

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

    fields.set(key, normalizeYamlScalar(value))
  }

  return fields
}

function checkFrontmatterFields(fields, root) {
  const actualName = fields.get('name')
  if (!actualName) {
    fail('frontmatter 缺少 name')
  }

  const expectedName = path.basename(root)
  if (actualName && actualName !== expectedName) {
    fail(`frontmatter name 必须等于目录名：${expectedName}`)
  }

  const description = fields.get('description')
  if (description && !DESCRIPTION_TRIGGER_PATTERN.test(description)) {
    fail('frontmatter description 必须说明触发时机或触发场景')
  }

  if (actualName && actualName === expectedName) {
    pass('frontmatter required fields present')
    pass('frontmatter name matches folder')
    if (description) {
      pass('frontmatter description trigger contract valid')
    }
    else {
      pass('frontmatter description omitted')
    }
  }
}

function finish(fields, root) {
  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL ${errors.length} errors`)
    process.exitCode = 1
    return
  }

  console.log('PASS skill YAML frontmatter is valid')
  console.log(`  name: ${fields.get('name')}`)
  console.log(`  root: ${root}`)
}

function verify(root) {
  const content = readSkillFile(root)
  if (content) {
    checkLineCount(content)
  }

  const parsed = content ? splitFrontmatter(content) : undefined
  const fields = parsed ? parseFrontmatter(parsed.yaml) : new Map()

  checkFrontmatterFields(fields, root)

  finish(fields, root)
}

verify(parseArgs(process.argv.slice(2)).root)
