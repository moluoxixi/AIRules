#!/usr/bin/env node
/**
 * Skill 内容校验脚本：检查单个 SKILL.md 的 frontmatter 与基础内容边界。
 */
import fs from 'node:fs'
import path from 'node:path'

const ownRoot = process.cwd()
const MAX_SKILL_LINES = 500
const DESCRIPTION_TRIGGER_PATTERN = /(用于|适用于|当|在.+时|开始前|完成后|明确要求|Use when|Triggers? on|when)/i
const TRIGGER_SECTION_PATTERN = /##\s*(触发条件|触发判断|适用时机|When to Use|使用时机)/i
const UNSUITABLE_SECTION_PATTERN = /##\s*(不适合|拒绝|不要使用|Don't use|Do not use|Non-goals?)/i
const BOUNDARY_SECTION_PATTERN = /##\s*(输出边界|应用边界|写入边界|边界|禁止|共同规则|核心规则|Output Boundary|Boundaries)/i
const BOUNDARY_MARKER_PATTERN = /(占位|仅供参考|用户确认|确认后|待审|PENDING_REVIEW|不得自动|不可直接|不要直接|字段含义|运行前提|失败|placeholder|review|confirm|not automatically)/i
const UNRESOLVED_PLACEHOLDER_PATTERN = /(TODO|FIXME|待补充|后续补充|这里写|请补充|\[补充|<待|待填写)/i

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
    body: content.slice(end + 5).trim(),
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
  if (!description) {
    fail('frontmatter 缺少 description；description 必须描述 AI 触发条件')
  }
  else if (!DESCRIPTION_TRIGGER_PATTERN.test(description)) {
    fail('frontmatter description 必须说明 AI 触发时机或触发场景')
  }

  if (actualName && actualName === expectedName) {
    pass('frontmatter required fields present')
    pass('frontmatter name matches folder')
    if (description && DESCRIPTION_TRIGGER_PATTERN.test(description)) {
      pass('frontmatter description trigger contract valid')
    }
  }
}

function checkBodyStructure(body) {
  if (!body) {
    fail('SKILL.md 正文不能为空')
    return
  }

  if (!TRIGGER_SECTION_PATTERN.test(body)) {
    fail('正文必须包含触发条件/适用时机章节')
  }
  else {
    pass('body trigger section present')
  }

  if (!UNSUITABLE_SECTION_PATTERN.test(body)) {
    fail('正文必须包含不适合场景或拒绝使用边界')
  }
  else {
    pass('body unsuitable section present')
  }

  if (!BOUNDARY_SECTION_PATTERN.test(body)) {
    fail('正文必须包含输出/应用/写入边界或禁止事项')
  }
  else {
    pass('body boundary section present')
  }

  if (UNRESOLVED_PLACEHOLDER_PATTERN.test(body)) {
    fail('正文包含未解决占位内容或 TODO')
  }
}

function checkExampleBoundaries(body) {
  const lines = body.split('\n')
  const riskyLines = []
  let inFence = false

  lines.forEach((line, index) => {
    const fence = line.trim().match(/^`{3,}/)
    if (fence) {
      inFence = !inFence
      return
    }

    if (inFence) {
      return
    }

    const trimmed = line.trim().toLowerCase()
    const isExampleHeading = trimmed.startsWith('##')
      && !trimmed.startsWith('# ')
      && ['示例', '模板', '候选', 'example', 'template', 'candidate'].some(marker => trimmed.includes(marker))

    if (!isExampleHeading) {
      return
    }

    const windowStart = Math.max(0, index - 3)
    const windowEnd = Math.min(lines.length, index + 4)
    const nearby = lines.slice(windowStart, windowEnd).join('\n')
    if (!BOUNDARY_MARKER_PATTERN.test(nearby)) {
      riskyLines.push(index + 1)
    }
  })

  if (riskyLines.length > 0) {
    fail(`示例/模板/候选内容必须说明边界或占位性质：正文行 ${riskyLines.join(', ')}`)
    return
  }

  pass('examples/templates/candidates have boundary wording')
}

function finish(fields, root) {
  console.log('────────────────────────────')
  if (errors.length > 0) {
    console.log(`FAIL ${errors.length} errors`)
    process.exitCode = 1
    return
  }

  console.log('PASS skill content contract is valid')
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
  if (parsed) {
    checkBodyStructure(parsed.body)
    checkExampleBoundaries(parsed.body)
  }

  finish(fields, root)
}

verify(parseArgs(process.argv.slice(2)).root)
