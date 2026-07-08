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
const MANAGED_BLOCK_BEGIN = '< airules start: init-project-rules !>'
const MANAGED_BLOCK_END = '< airules end: init-project-rules !>'
const LEGACY_MANAGED_BLOCK_BEGIN = '<!-- AIRULES:BEGIN init-project-rules -->'
const LEGACY_MANAGED_BLOCK_END = '<!-- AIRULES:END init-project-rules -->'
const MANAGED_BLOCK_MARKER_PAIRS = [
  { begin: MANAGED_BLOCK_BEGIN, end: MANAGED_BLOCK_END },
  { begin: LEGACY_MANAGED_BLOCK_BEGIN, end: LEGACY_MANAGED_BLOCK_END },
]

/** 把规则正文里的 init-project skill 占位符替换成真实绝对路径（POSIX 斜杠）。 */
function resolvePathPlaceholders(content) {
  return content
    .split(INIT_PROJECT_SKILL_PLACEHOLDER)
    .join(initProjectSkillRootPosix)
}

const baseReferencePath = path.join(skillRoot, 'references', 'airules-base.md')

const projectRoot = path.resolve(projectRootArg)
const agentsPath = path.join(projectRoot, 'AGENTS.md')
const currentContent = existsSync(agentsPath) ? readFileSync(agentsPath, 'utf8') : ''

// 注入顺序固定：OpenSpec 项目规则只注入 baseline；前端纪律由 frontend-superpowers-bridge schema 承载。
const inlineReferencePaths = [baseReferencePath]

/**
 * 解析 Markdown 文件开头的最小 YAML frontmatter，返回去除 frontmatter 的正文。
 * 输入是项目内受控格式；无 frontmatter 时返回原文（trim 后）。
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

const inlineSections = inlineReferencePaths.map(referencePath =>
  resolvePathPlaceholders(stripFrontmatter(readFileSync(referencePath, 'utf8'))),
).filter(section => section.length > 0)
const incomingRules = inlineSections.join('\n\n')
const managedRulesBlock = incomingRules.length === 0
  ? ''
  : `${MANAGED_BLOCK_BEGIN}\n${incomingRules}\n${MANAGED_BLOCK_END}`

function replaceManagedBlock(content, replacement) {
  let matchedBlock = null

  for (const markerPair of MANAGED_BLOCK_MARKER_PAIRS) {
    const beginIndex = content.indexOf(markerPair.begin)
    const endIndex = content.indexOf(markerPair.end)
    const secondBeginIndex = beginIndex === -1 ? -1 : content.indexOf(markerPair.begin, beginIndex + markerPair.begin.length)
    const secondEndIndex = endIndex === -1 ? -1 : content.indexOf(markerPair.end, endIndex + markerPair.end.length)

    if (beginIndex === -1 && endIndex === -1) {
      continue
    }

    if (beginIndex === -1 || endIndex === -1 || endIndex < beginIndex) {
      throw new Error('AGENTS.md contains an incomplete AIRules managed block; fix markers before reinjecting rules.')
    }

    if (matchedBlock !== null || secondBeginIndex !== -1 || secondEndIndex !== -1) {
      throw new Error('AGENTS.md contains multiple AIRules managed blocks; keep one block before reinjecting rules.')
    }

    matchedBlock = {
      beginIndex,
      afterEndIndex: endIndex + markerPair.end.length,
    }
  }

  if (matchedBlock === null) {
    return null
  }

  const before = content.slice(0, matchedBlock.beginIndex).trimEnd()
  const after = content.slice(matchedBlock.afterEndIndex).trimStart()

  return [before, replacement, after].filter(section => section.length > 0).join('\n\n')
}

const replacedContent = replaceManagedBlock(currentContent, managedRulesBlock)

if (incomingRules.length === 0) {
  writeFileSync(agentsPath, replacedContent ?? currentContent, 'utf8')
  console.log(`[airules] Updated ${agentsPath}`)
  process.exit(0)
}

const nextContent = currentContent.trim().length === 0
  ? `${managedRulesBlock}\n`
  : `${replacedContent ?? `${currentContent}${currentContent.endsWith('\n') ? '\n' : '\n\n'}${managedRulesBlock}`}\n`

writeFileSync(agentsPath, nextContent, 'utf8')
console.log(`[airules] Updated ${agentsPath}`)
