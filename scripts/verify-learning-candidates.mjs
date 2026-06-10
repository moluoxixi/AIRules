#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const REQUIRED_SECTIONS = [
  '## 参考来源',
  '## 证据',
  '## 候选内容',
  '## 应用边界',
]
const TARGET_BY_KIND = {
  'learning-capture': 'docs/AI项目知识/待确认/',
  'skill-evolution': 'docs/skill-evolution/inbox/',
}

function collectMarkdownFiles(targetPath) {
  const absolutePath = path.resolve(targetPath)

  if (!existsSync(absolutePath))
    throw new Error(`路径不存在：${targetPath}`)

  const stat = statSync(absolutePath)
  if (stat.isFile())
    return absolutePath.endsWith('.md') ? [absolutePath] : []

  if (!stat.isDirectory())
    throw new Error(`路径必须是 Markdown 文件或目录：${targetPath}`)

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = path.join(absolutePath, entry.name)

    if (entry.isDirectory())
      return collectMarkdownFiles(childPath)

    return entry.isFile() && entry.name.endsWith('.md') ? [childPath] : []
  })
}

function splitFrontmatter(content, filePath) {
  const normalizedContent = content.replace(/\r\n/g, '\n')

  if (!normalizedContent.startsWith('---\n'))
    throw new Error(`${filePath} 必须以 YAML frontmatter 开始`)

  const frontmatterEnd = normalizedContent.indexOf('\n---\n', 4)
  if (frontmatterEnd === -1)
    throw new Error(`${filePath} 缺少 YAML frontmatter 结束标记`)

  return {
    frontmatter: normalizedContent.slice(4, frontmatterEnd),
    body: normalizedContent.slice(frontmatterEnd + 5),
  }
}

function parseFrontmatter(frontmatter, filePath) {
  const fields = new Map()

  for (const rawLine of frontmatter.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#'))
      continue

    const separator = line.indexOf(':')
    if (separator === -1)
      throw new Error(`${filePath} frontmatter 行缺少冒号：${rawLine}`)

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!key || !value)
      throw new Error(`${filePath} frontmatter 必须使用 key: value：${rawLine}`)

    fields.set(key, value)
  }

  return fields
}

function normalizeTarget(target) {
  return target.replaceAll('\\', '/').replace(/^\.\//, '')
}

function readRequiredField(fields, fieldName, filePath) {
  const value = fields.get(fieldName)
  if (!value)
    throw new Error(`${filePath} frontmatter 缺少 ${fieldName}`)

  return value
}

function verifyTarget(kind, target, filePath) {
  const normalizedTarget = normalizeTarget(target)

  if (normalizedTarget === 'vendor' || normalizedTarget.startsWith('vendor/') || normalizedTarget.includes('/vendor/'))
    throw new Error(`${filePath} target 不得指向 vendor/`)

  const requiredPrefix = TARGET_BY_KIND[kind]
  if (!requiredPrefix)
    throw new Error(`${filePath} kind 必须是 learning-capture 或 skill-evolution`)

  if (!normalizedTarget.startsWith(requiredPrefix))
    throw new Error(`${filePath} ${kind} target 必须位于 ${requiredPrefix}`)
}

function verifyBody(body, filePath) {
  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section))
      throw new Error(`${filePath} 缺少章节：${section}`)
  }

  if (!/https?:\/\/\S+/.test(body))
    throw new Error(`${filePath} 必须包含至少一个 http/https 来源链接`)
}

function verifyCandidate(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const { frontmatter, body } = splitFrontmatter(content, filePath)
  const fields = parseFrontmatter(frontmatter, filePath)
  const kind = readRequiredField(fields, 'kind', filePath)
  const status = readRequiredField(fields, 'status', filePath)
  const target = readRequiredField(fields, 'target', filePath)

  if (status !== 'PENDING_REVIEW')
    throw new Error(`${filePath} status 必须是 PENDING_REVIEW`)

  verifyTarget(kind, target, filePath)
  verifyBody(body, filePath)
}

function main(args) {
  if (args.length === 0)
    throw new Error('Usage: node scripts/verify-learning-candidates.mjs <candidate-file-or-dir> [...]')

  const files = args.flatMap(collectMarkdownFiles)
  if (files.length === 0)
    throw new Error('未发现 Markdown 学习候选文件')

  for (const filePath of files)
    verifyCandidate(filePath)

  console.log(`PASS learning candidates are valid (${files.length} checked)`)
}

try {
  main(process.argv.slice(2))
}
catch (error) {
  console.error(`FAIL ${error.message}`)
  process.exitCode = 1
}
