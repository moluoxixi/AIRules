#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ownRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const forbiddenDocs = new Set([
  'README.md',
  'INSTALLATION_GUIDE.md',
  'QUICK_REFERENCE.md',
  'CHANGELOG.md',
])

function fail(message) {
  throw new Error(message)
}

function printPass(message, details = {}) {
  console.log(`PASS ${message}`)

  for (const [key, value] of Object.entries(details))
    console.log(`${key}: ${value}`)
}

function getOption(args, name) {
  const index = args.indexOf(name)

  if (index === -1)
    return undefined

  const value = args[index + 1]

  if (!value || value.startsWith('--'))
    fail(`参数 ${name} 必须提供值`)

  return value
}

function parseArgs(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--root') {
      index += 1
      continue
    }

    fail(`未知参数：${arg}`)
  }

  const rootArg = getOption(args, '--root')

  return {
    root: rootArg ? path.resolve(process.cwd(), rootArg) : ownRoot,
  }
}

function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')
}

function normalizeSlash(value) {
  return value.split(path.sep).join('/')
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n'))
    fail('SKILL.md 必须以 YAML frontmatter 开头')

  const end = content.indexOf('\n---\n', 4)

  if (end === -1)
    fail('SKILL.md 缺少 YAML frontmatter 结束标记')

  const frontmatter = content.slice(4, end)
  const body = content.slice(end + '\n---\n'.length).trim()
  const fields = new Map()
  const lines = frontmatter.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = /^([a-z][\w-]*): ?(.*)$/i.exec(line)

    if (!match)
      continue

    const [, key, rawValue] = match
    const value = rawValue.trim()

    if (value) {
      fields.set(key, value)
      continue
    }

    const blockLines = []

    for (const nextLine of lines.slice(index + 1)) {
      if (!nextLine.startsWith(' ') && !nextLine.startsWith('\t'))
        break

      const blockValue = nextLine.trim()

      if (blockValue)
        blockLines.push(blockValue)
    }

    fields.set(key, blockLines.join(' ').trim())
  }

  return { fields, body }
}

function listFilesRecursive(root) {
  const results = []

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules')
      continue

    const entryPath = path.join(root, entry.name)

    if (entry.isDirectory())
      results.push(...listFilesRecursive(entryPath))
    else
      results.push(entryPath)
  }

  return results
}

function markdownLinks(content) {
  const links = []
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g

  for (const match of content.matchAll(pattern)) {
    const target = match[1].trim()

    if (
      !target
      || target.startsWith('#')
      || target.startsWith('mailto:')
      || /^[a-z][a-z\d+.-]*:\/\//i.test(target)
    ) {
      continue
    }

    links.push(target.split('#')[0])
  }

  return links.filter(Boolean)
}

function assertNoForbiddenDocs(root) {
  for (const file of listFilesRecursive(root)) {
    const filename = path.basename(file)

    if (forbiddenDocs.has(filename))
      fail(`skill 不得包含杂项文档：${normalizeSlash(path.relative(root, file))}`)
  }
}

function assertLinksExist(root, skillContent) {
  for (const link of markdownLinks(skillContent)) {
    const target = path.resolve(root, link)

    if (!fs.existsSync(target))
      fail(`SKILL.md 引用的资源不存在：${link}`)
  }
}

function assertDescription(description) {
  if (description.length < 24)
    fail('frontmatter description 过短，无法提供可靠触发条件')

  if (/(服务所有\s+skills|不属于\s*`?workflow`?|workflow\s+namespace|内部投影|安装投影|投影入口|分类自述|自身位置|本\s*Skill\s*(是|服务|用于服务))/i.test(description))
    fail('frontmatter description 不得描述内部投影、分类或自身位置')

  if (!/(用[于来]|适用于|当|when|Use when|在.+时|需要|生成|创建|修改|评审|校验|检查|debug|fix|review|create|edit|validate)/i.test(description))
    fail('frontmatter description 必须描述何时使用 skill')
}

function assertScriptSemantics(root) {
  const scriptsPath = path.join(root, 'scripts')

  if (!fs.existsSync(scriptsPath))
    return

  for (const file of listFilesRecursive(scriptsPath)) {
    if (!/\.(?:mjs|js|cjs|ts|py|sh|ps1)$/.test(file))
      continue

    const content = readFile(file)

    if (/verify|validate|check/.test(path.basename(file)) && (!/PASS /.test(content) || !/FAIL /.test(content)))
      fail(`校验脚本必须具备 PASS/FAIL 输出语义：${normalizeSlash(path.relative(root, file))}`)
  }
}

function verifySkill(root) {
  const skillPath = path.join(root, 'SKILL.md')

  if (!fs.existsSync(skillPath))
    fail('缺少 SKILL.md')

  const skillContent = readFile(skillPath)
  const { fields, body } = parseFrontmatter(skillContent)
  const name = fields.get('name')
  const description = fields.get('description')
  const directoryName = path.basename(root)

  if (!name)
    fail('frontmatter 缺少非空 name')

  if (!description)
    fail('frontmatter 缺少非空 description')

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
    fail('frontmatter name 必须使用小写字母、数字和连字符')

  if (name !== directoryName)
    fail(`frontmatter name 必须与目录名一致：${directoryName}`)

  assertDescription(description)

  if (!body || !/^#\s+/m.test(body))
    fail('SKILL.md frontmatter 后必须包含 Markdown 指令主体')

  assertLinksExist(root, skillContent)
  assertNoForbiddenDocs(root)
  assertScriptSemantics(root)

  printPass('skill is valid', { name, root })
}

try {
  verifySkill(parseArgs(process.argv.slice(2)).root)
}
catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
