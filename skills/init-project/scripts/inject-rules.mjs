#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [projectRootArg] = process.argv.slice(2)

if (!projectRootArg) {
  throw new Error('Usage: inject-rules.mjs <project-root>')
}

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// init-project skill 根目录。下游项目规则若需要调用初始化链路脚本，必须引用
// `<init-project-skill>/scripts/...`，让脚本随 init-project skill 分发；不得把
// 用户项目规则绑到 AIRules 安装根的全局 scripts/ 目录。
const INIT_PROJECT_SKILL_PLACEHOLDER = '<init-project-skill>'
const initProjectSkillRootPosix = skillRoot.split(path.sep).join('/')

/** 把规则正文里的 init-project skill 占位符替换成真实绝对路径（POSIX 斜杠）。 */
function resolvePathPlaceholders(content) {
  return content
    .split(INIT_PROJECT_SKILL_PLACEHOLDER)
    .join(initProjectSkillRootPosix)
}

const baseReferencePath = path.join(skillRoot, 'references', 'airules-base.md')
const codeCoreReferencePath = path.join(skillRoot, 'references', 'code-core.md')

const projectRoot = path.resolve(projectRootArg)
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const currentContent = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : ''
const hasExistingAgentsContent = currentContent.trim().length > 0

// 注入顺序固定：项目规则骨架（仅在 AGENTS.md 为空/新建时）+ 代码核心纪律。
const inlineReferencePaths = [
  ...(hasExistingAgentsContent ? [] : [baseReferencePath]),
  codeCoreReferencePath,
]

/**
 * 解析 Markdown 文件开头的最小 YAML frontmatter，返回去除 frontmatter 的正文。
 * 输入是项目内受控格式（仅 code-core.md 带 frontmatter），结构固定；
 * 无 frontmatter 时返回原文（trim 后）。
 */
function stripFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return normalized.trim()
  }

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    throw new Error('frontmatter 未正确闭合（缺少结束 ---）')
  }

  const afterMarker = normalized.indexOf('\n', end + 1)
  return normalized.slice(afterMarker + 1).trim()
}

function normalizeHeadingTitle(title) {
  return title.trim().toLowerCase()
}

function parseHeadingTitle(line) {
  const trimmedLine = line.trimStart()
  let markerLength = 0

  while (trimmedLine[markerLength] === '#') {
    markerLength++
  }

  if (markerLength === 0 || markerLength > 6) {
    return ''
  }

  const nextCharacter = trimmedLine[markerLength]
  if (nextCharacter !== ' ' && nextCharacter !== '\t') {
    return ''
  }

  let title = trimmedLine.slice(markerLength).trim()
  while (title.endsWith('#')) {
    title = title.slice(0, -1).trimEnd()
  }

  return title.trim()
}

function collectHeadingTitles(content) {
  const titles = new Map()
  let insideFence = false

  for (const rawLine of content.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    const trimmedLine = line.trimStart()

    if (trimmedLine.startsWith('```') || trimmedLine.startsWith('~~~')) {
      insideFence = !insideFence
      continue
    }

    if (insideFence) {
      continue
    }

    const title = parseHeadingTitle(line)
    const normalizedTitle = normalizeHeadingTitle(title)
    if (normalizedTitle) {
      titles.set(normalizedTitle, title)
    }
  }

  return titles
}

function findDuplicateHeadingTitles(existingContent, incomingContent) {
  const currentTitles = collectHeadingTitles(existingContent)
  const incomingTitles = collectHeadingTitles(incomingContent)

  return [...incomingTitles.entries()]
    .filter(([normalizedTitle]) => currentTitles.has(normalizedTitle))
    .map(([, title]) => title)
}

const inlineSections = inlineReferencePaths.map(referencePath =>
  resolvePathPlaceholders(stripFrontmatter(readFileSync(referencePath, 'utf8'))),
)
const incomingRules = inlineSections.join('\n\n')

const duplicateTitles = findDuplicateHeadingTitles(currentContent, incomingRules)

if (duplicateTitles.length > 0) {
  console.error('[airules] AGENTS.md contains duplicate headings that require AI review:')
  for (const title of duplicateTitles) {
    console.error(`- ${title}`)
  }

  throw new Error('Duplicate AGENTS.md headings detected; review the existing file and merge the incoming rules manually.')
}

const nextContent = currentContent.trim().length === 0
  ? `${incomingRules}\n`
  : `${currentContent}${currentContent.endsWith('\n') ? '\n' : '\n\n'}${incomingRules}\n`

writeFileSync(agentsPath, nextContent, 'utf8')
console.log(`[airules] Updated ${agentsPath}`)
