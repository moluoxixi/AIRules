#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const [projectRootArg, ...referenceArgs] = process.argv.slice(2)

if (!projectRootArg) {
  throw new Error('Usage: inject-rules.mjs <project-root> [reference-file ...]')
}

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// init-project skill 根目录。下游项目规则若需要调用初始化链路脚本，必须引用
// `<init-project-skill>/scripts/...`，让脚本随 init-project skill 分发；不得把
// 用户项目规则绑到 AIRules 安装根的全局 scripts/ 目录。
const INIT_PROJECT_SKILL_PLACEHOLDER = '<init-project-skill>'
const initProjectSkillRootPosix = skillRoot.split(path.sep).join('/')
// 旧占位符保留兼容外部自定义 reference；第一方 reference 不再使用它引用脚本。
const AIRULES_PLACEHOLDER = '<AIRules>'
const airulesRootPosix = path.resolve(skillRoot, '..', '..').split(path.sep).join('/')

/** 把规则正文里的路径占位符替换成真实绝对路径（POSIX 斜杠）。 */
function resolvePathPlaceholders(content) {
  return content
    .split(INIT_PROJECT_SKILL_PLACEHOLDER)
    .join(initProjectSkillRootPosix)
    .split(AIRULES_PLACEHOLDER)
    .join(airulesRootPosix)
}
const baseReferencePath = path.join(skillRoot, 'references', 'airules-base.md')
const docsReferencePath = path.join(skillRoot, 'references', 'common', 'docs.md')
const normalizedBaseReferencePath = path.resolve(baseReferencePath)
const normalizedDocsReferencePath = path.resolve(docsReferencePath)
const projectRoot = path.resolve(projectRootArg)
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const currentContent = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : ''
const hasExistingAgentsContent = currentContent.trim().length > 0

/** 规范文件复制到目标项目内的固定目录（相对项目根） */
const RULES_DIR_REL = path.join('.airules', 'rules')
/** 路由表章节标题，用于去重判定与幂等重建 */
const ROUTING_HEADING = '## 场景规范路由'

const extraReferencePaths = referenceArgs
  .map(referencePath => path.resolve(referencePath))
  .filter(referencePath =>
    referencePath !== normalizedBaseReferencePath
    && referencePath !== normalizedDocsReferencePath,
  )

/** 始终 inline 的核心纪律（全场景常驻），顺序固定 */
const coreInlinePaths = [
  ...(hasExistingAgentsContent ? [] : [normalizedBaseReferencePath]),
  normalizedDocsReferencePath,
]

/**
 * 解析 Markdown 文件开头的最小 YAML frontmatter。
 *
 * 仅支持本项目规范文件实际使用的结构：顶层 scalar（key: value）和顶层简单数组
 * （key: 后续若干 `- item` 行）。不引入完整 YAML 依赖，因为输入是项目内受控格式，
 * 结构固定且简单；遇到无法解析的结构时显式抛错而非静默降级。
 *
 * @returns {{ data: Record<string, string | string[]>, body: string }}
 *   无 frontmatter 时 data 为空对象、body 为原文（trim 后）。
 */
function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, '\n')
  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized.trim() }
  }

  const end = normalized.indexOf('\n---', 4)
  if (end === -1) {
    throw new Error('frontmatter 未正确闭合（缺少结束 ---）')
  }

  const rawFrontmatter = normalized.slice(4, end)
  const afterMarker = normalized.indexOf('\n', end + 1)
  const body = normalized.slice(afterMarker + 1).trim()

  const data = {}
  const lines = rawFrontmatter.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim().length === 0) {
      continue
    }

    const keyMatch = line.match(/^(\w+):(.*)$/)
    if (!keyMatch) {
      throw new Error(`无法解析 frontmatter 行: ${line}`)
    }

    const key = keyMatch[1]
    const inlineValue = keyMatch[2].trim()

    if (inlineValue.length > 0) {
      data[key] = stripQuotes(inlineValue)
      continue
    }

    // 数组：收集后续缩进的 `- item` 行
    const items = []
    while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
      items.push(stripQuotes(lines[i + 1].replace(/^\s*-\s+/, '').trim()))
      i++
    }
    data[key] = items
  }

  return { data, body }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith('\'') && value.endsWith('\''))
  ) {
    return value.slice(1, -1)
  }
  return value
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

function findDuplicateHeadingTitles(currentContent, incomingContent) {
  const currentTitles = collectHeadingTitles(currentContent)
  const incomingTitles = collectHeadingTitles(incomingContent)

  return [...incomingTitles.entries()]
    .filter(([normalizedTitle]) => currentTitles.has(normalizedTitle))
    .map(([, title]) => title)
}

/**
 * 推断规范文件复制到项目内的相对目标路径片段（如 frontend/vue.md）。
 * 优先使用 references/ 之后的子路径；不在 references/ 下时退回文件名。
 */
function resolveRuleRelPath(referencePath) {
  const marker = `${path.sep}references${path.sep}`
  const index = referencePath.indexOf(marker)
  if (index !== -1) {
    return referencePath.slice(index + marker.length)
  }
  return path.basename(referencePath)
}

// 1) 分类：核心纪律 inline；带 ruleScope 的额外规范走"复制 + 路由表"，其余额外规范 inline。
const inlineSections = []
const routedRules = []

for (const referencePath of coreInlinePaths) {
  const { body } = parseFrontmatter(readFileSync(referencePath, 'utf8'))
  inlineSections.push(resolvePathPlaceholders(body))
}

for (const referencePath of extraReferencePaths) {
  const { data, body } = parseFrontmatter(readFileSync(referencePath, 'utf8'))

  // 无 ruleScope 的额外规范保持旧行为：直接 inline，确保向后兼容。
  if (!data.ruleScope) {
    inlineSections.push(resolvePathPlaceholders(body))
    continue
  }

  const ruleRelPath = resolveRuleRelPath(referencePath)
  const destAbs = path.join(projectRoot, RULES_DIR_REL, ruleRelPath)
  mkdirSync(path.dirname(destAbs), { recursive: true })
  // 复制正文（剥除 frontmatter），保持规范文件在项目内自包含、可 git 跟踪。
  writeFileSync(destAbs, `${resolvePathPlaceholders(body)}\n`, 'utf8')

  const globs = Array.isArray(data.globs) ? data.globs : (data.globs ? [data.globs] : [])
  routedRules.push({
    scope: data.ruleScope,
    description: typeof data.description === 'string' ? data.description : '',
    loadTiming: typeof data.loadTiming === 'string' ? data.loadTiming : '按需',
    globs,
    relPath: path.join(RULES_DIR_REL, ruleRelPath).split(path.sep).join('/'),
  })
}

/** 把命中的规范渲染成动态路由表；无命中规范时返回空串（不生成空表）。 */
function renderRoutingTable(rules) {
  if (rules.length === 0) {
    return ''
  }

  const header = [
    ROUTING_HEADING,
    '',
    '以下规范不常驻上下文。命中“触发场景”时，先读取对应规范文件再动手；未命中的不必读取。',
    '',
    '| 触发场景 | 匹配文件 | 规范文件 | 加载时机 |',
    '| --- | --- | --- | --- |',
  ]

  const rows = rules.map((rule) => {
    const globCell = rule.globs.length > 0 ? rule.globs.map(g => `\`${g}\``).join('、') : '—'
    const description = rule.description || rule.scope
    return `| ${description} | ${globCell} | \`${rule.relPath}\` | ${rule.loadTiming} |`
  })

  return [...header, ...rows].join('\n')
}

const routingTable = renderRoutingTable(routedRules)
const incomingSections = routingTable.length > 0
  ? [...inlineSections, routingTable]
  : inlineSections
const incomingRules = incomingSections.join('\n\n')

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
if (routedRules.length > 0) {
  console.log(`[airules] Copied ${routedRules.length} scoped rule file(s) to ${RULES_DIR_REL} and rendered routing table`)
}
